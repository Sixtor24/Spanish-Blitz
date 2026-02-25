/**
 * Custom hook for audio recording with MediaRecorder
 */
import { useRef, useCallback } from 'react';
import { AUDIO_CONFIG, TIMING } from '../constants';

interface UseAudioRecordingProps {
  onAudioChunk: (blob: Blob) => void;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onError: (error: Error) => void;
}

export function useAudioRecording({
  onAudioChunk,
  onRecordingStart,
  onRecordingStop,
  onError,
}: UseAudioRecordingProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) {
      console.warn('[Speech] Already recording');
      return null;
    }

    try {
      // Get microphone access — use Safari-safe audio constraints
      // Safari ignores sampleRate and may reject unsupported constraints
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const audioConstraints = isSafari
        ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : AUDIO_CONFIG;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      streamRef.current = stream;

      // Create MediaRecorder — pick a supported MIME type
      // Safari: no webm support, use mp4 or let browser choose
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : undefined;
      const mediaRecorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
      });
      mediaRecorderRef.current = mediaRecorder;

      // Handle audio chunks
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          onAudioChunk(e.data);
        }
      };

      // Handle stop
      mediaRecorder.onstop = () => {
        console.log('📦 [Speech] MediaRecorder stopped');
        onRecordingStop();
      };

      // Start recording
      mediaRecorder.start(TIMING.AUDIO_CHUNK_INTERVAL);
      isRecordingRef.current = true;
      onRecordingStart();

      return stream;
    } catch (err) {
      const error = err as Error;
      console.error('[Speech] Microphone error:', error);
      onError(error);
      return null;
    }
  }, [onAudioChunk, onRecordingStart, onRecordingStop, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks
    streamRef.current?.getTracks().forEach((track) => track.stop());

    // Reset refs
    mediaRecorderRef.current = null;
    streamRef.current = null;
    isRecordingRef.current = false;
  }, []);

  const isRecording = useCallback(() => {
    return isRecordingRef.current;
  }, []);

  return {
    startRecording,
    stopRecording,
    isRecording,
  };
}
