/**
 * Speech Recognition Component (Refactored)
 * Uses Deepgram backend streaming with persistent WebSocket
 * Provides real-time transcription with visual feedback
 */
import { useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useWebSocketConnection } from './hooks/useWebSocketConnection';
import { useAudioRecording } from './hooks/useAudioRecording';
import { useAudioVisualizer } from './hooks/useAudioVisualizer';
import { filterEvaluationKeywords, blobToBase64, isSilenceError, getMicrophoneErrorMessage } from './utils';
import { TIMING } from './constants';
import type { SpeechRecognitionHandle, SpeechRecognitionProps, TranscriptMessage, ErrorMessage } from './types';

const SpeechRecognition = forwardRef<SpeechRecognitionHandle, SpeechRecognitionProps>(
  ({ onTranscript, locale = 'es-ES', onError, autoStop = true, showTranscript = true, userId }, ref) => {
    // UI State
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [currentTranscript, setCurrentTranscript] = useState<string>('');
    const [finalTranscript, setFinalTranscript] = useState<string>('');

    // Refs
    const sessionIdRef = useRef<string | null>(null);
    const audioBufferRef = useRef<Blob[]>([]);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isStartingRef = useRef(false);

    // Custom Hooks
    const { audioLevel, setupVisualizer, stopVisualizer } = useAudioVisualizer();

    // WebSocket message handlers
    const handleStreamReady = useCallback(() => {
      console.log('✅ [Speech] Stream ready, sending buffered audio');
      audioBufferRef.current.forEach((blob) => {
        blobToBase64(blob).then((base64) => {
          sendMessage({
            type: 'speech:audio',
            sessionId: sessionIdRef.current!,
            audio: base64,
          });
        });
      });
      audioBufferRef.current = [];
    }, []);

    const handleTranscriptMessage = useCallback(
      (data: TranscriptMessage) => {
        const { transcript, isFinal, confidence } = data;

        if (isFinal) {
          console.log(`✅ [Speech] Final: "${transcript}" (${(confidence * 100).toFixed(1)}%)`);
          const filtered = filterEvaluationKeywords(transcript);
          setFinalTranscript(filtered);
          onTranscript(filtered, confidence);

          if (autoStop) {
            setTimeout(() => stopListening(), TIMING.STOP_SIGNAL_DELAY);
          }
        } else {
          setCurrentTranscript(transcript);
        }
      },
      [autoStop, onTranscript]
    );

    const handleErrorMessage = useCallback(
      (data: ErrorMessage) => {
        if (!isSilenceError(data.message)) {
          setErrorMessage(data.message || 'Error');
          if (onError) onError('transcription-failed');
        } else {
          console.log('[Speech] Silence detected - waiting for user voice');
        }
        setIsProcessing(false);
        stopListening();
      },
      [onError]
    );

    const { sendMessage, startSession, stopSession, wsReadyRef } = useWebSocketConnection({
      locale,
      onTranscriptMessage: handleTranscriptMessage,
      onErrorMessage: handleErrorMessage,
      onStreamReady: handleStreamReady,
    });

    // Audio recording handlers
    const handleAudioChunk = useCallback(
      (blob: Blob) => {
        if (wsReadyRef.current) {
          blobToBase64(blob).then((base64) => {
            sendMessage({
              type: 'speech:audio',
              sessionId: sessionIdRef.current!,
              audio: base64,
            });
          });
        } else {
          audioBufferRef.current.push(blob);
        }
      },
      [sendMessage, wsReadyRef]
    );

    const handleRecordingStart = useCallback(() => {
      setIsListening(true);
      setCurrentTranscript('Speak Now');
      setFinalTranscript('');
      setErrorMessage(null);
      audioBufferRef.current = [];
    }, []);

    const handleRecordingStop = useCallback(() => {
      console.log('📦 [Speech] Recording stopped');
    }, []);

    const handleRecordingError = useCallback(
      (error: Error) => {
        setErrorMessage(getMicrophoneErrorMessage(error));
        if (onError) onError('microphone-denied');
        setIsListening(false);
        setIsProcessing(false);
      },
      [onError]
    );

    const { startRecording, stopRecording } = useAudioRecording({
      onAudioChunk: handleAudioChunk,
      onRecordingStart: handleRecordingStart,
      onRecordingStop: handleRecordingStop,
      onError: handleRecordingError,
    });

    // Core functions
    const startListening = useCallback(async () => {
      // Create new session with userId to prevent collisions between students
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const userPrefix = userId ? `${userId.substr(0, 8)}-` : '';
      const sessionId = `speech-${userPrefix}${timestamp}-${randomId}`;
      sessionIdRef.current = sessionId;

      // Start WebSocket session
      startSession(sessionId);

      // Start recording and get stream
      const stream = await startRecording();
      if (stream) {
        setupVisualizer(stream);

        // Safety timeout
        timeoutRef.current = setTimeout(() => {
          stopListening();
        }, TIMING.MAX_DURATION);
      }
    }, [startRecording, startSession, setupVisualizer]);

    const stopListening = useCallback(() => {
      console.log('📦 [Speech] Stopping listening');

      // Stop recording
      stopRecording();
      stopVisualizer();

      // Send stop signal to backend
      if (sessionIdRef.current) {
        stopSession(sessionIdRef.current);
      }

      // Clear timeouts
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);

      // Reset state
      sessionIdRef.current = null;
      audioBufferRef.current = [];
      setIsListening(false);
      setIsProcessing(false);
      setCurrentTranscript('');
    }, [stopRecording, stopVisualizer, stopSession]);

    // Event handlers
    const handlePressStart = useCallback(() => {
      if (isProcessing) {
        console.log('🔄 [Speech] Resetting stuck processing');
        stopListening();
        setErrorMessage(null);
        return;
      }

      if (!isListening && !isStartingRef.current && !errorMessage) {
        isStartingRef.current = true;
        debounceTimerRef.current = setTimeout(() => {
          if (isStartingRef.current) {
            startListening();
          }
        }, TIMING.DEBOUNCE_DELAY);
      }
    }, [isProcessing, isListening, errorMessage, startListening, stopListening]);

    const handlePressEnd = useCallback(() => {
      // Cancel debounce if released early
      if (isStartingRef.current && !isListening) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        isStartingRef.current = false;
        return;
      }

      // Stop recording if active
      if (isListening) {
        isStartingRef.current = false;
        setIsListening(false);
        setIsProcessing(true);
        setCurrentTranscript('');

        // Stop recording
        stopRecording();

        // Send stop signal with delay
        setTimeout(() => {
          if (sessionIdRef.current) {
            stopSession(sessionIdRef.current);
          }
        }, TIMING.STOP_SIGNAL_DELAY);

        // Processing timeout
        processingTimeoutRef.current = setTimeout(() => {
          console.warn('⚠️ [Speech] Processing timeout');
          stopListening();
          setErrorMessage('Oops! I didn\'t hear anything.\nPlease try again.');
          setTimeout(() => setErrorMessage(null), TIMING.ERROR_DISPLAY_DURATION);
        }, TIMING.PROCESSING_TIMEOUT);
      }
    }, [isListening, stopRecording, stopSession, stopListening]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      stop: () => {
        if (isListening || isProcessing) {
          console.log('🛑 [Speech] External stop call');
          stopListening();
        }
      },
      isListening: () => isListening,
    }));

    // UI rendering
    const buttonColor = errorMessage
      ? 'bg-orange-500 hover:bg-orange-600'
      : isListening
      ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-2xl ring-4 ring-red-300'
      : isProcessing
      ? 'bg-yellow-500 hover:bg-yellow-600 cursor-pointer animate-pulse'
      : 'bg-blue-500 hover:bg-blue-600';

    const instructionText = errorMessage
      ? 'Try again'
      : isListening
      ? 'Recording... Release to stop'
      : isProcessing
      ? 'Processing your answer...'
      : 'Press and hold to speak';

    const ButtonIcon = errorMessage ? MicOff : Mic;

    return (
      <div className="flex flex-col items-center gap-4">
        {/* Microphone button with audio visualization */}
        <div className="relative flex items-center justify-center">
          {/* Audio level rings */}
          {isListening && audioLevel > 10 && (
            <>
              <div
                className="absolute inset-0 rounded-full bg-blue-400 opacity-30 animate-ping"
                style={{
                  animationDuration: '1s',
                  transform: `scale(${1 + audioLevel / 200})`,
                }}
              />
              <div
                className="absolute inset-0 rounded-full bg-blue-300 opacity-20"
                style={{
                  transform: `scale(${1 + audioLevel / 150})`,
                  transition: 'transform 0.1s ease-out',
                }}
              />
            </>
          )}

          <button
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            className={`relative flex items-center justify-center w-24 h-24 rounded-full font-medium transition-all duration-200 ${buttonColor} text-white shadow-2xl active:scale-95 select-none touch-none z-10`}
            style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none', userSelect: 'none' }}
            aria-label={isListening ? 'Recording' : 'Hold to Record'}
            disabled={!!errorMessage}
          >
            <ButtonIcon className="w-12 h-12" />
          </button>
        </div>

        {/* Instruction text */}
        <p className="text-sm text-gray-600 text-center max-w-xs font-medium">{instructionText}</p>

        {/* Final transcript */}
        {showTranscript && finalTranscript && !isListening && (
          <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm max-w-md text-center font-medium">
            {finalTranscript}
          </div>
        )}

        {/* Current transcript */}
        {showTranscript && currentTranscript && isListening && currentTranscript !== 'Speak Now' && (
          <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm max-w-md text-center">
            {currentTranscript}
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="px-4 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm max-w-md text-center">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }
);

SpeechRecognition.displayName = 'SpeechRecognition';

export default SpeechRecognition;
export type { SpeechRecognitionHandle, SpeechRecognitionProps };
