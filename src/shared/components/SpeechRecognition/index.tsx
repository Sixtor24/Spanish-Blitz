/**
 * Speech Recognition Component
 * Push-to-talk microphone with Deepgram streaming via WebSocket.
 * Optimized for a language learning platform where students speak
 * at different speeds — from slow syllable-by-syllable to fast fluent speech.
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
    // ─── UI State ─────────────────────────────────────────────────
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [currentTranscript, setCurrentTranscript] = useState<string>('');
    const [finalTranscript, setFinalTranscript] = useState<string>('');

    // ─── Refs ─────────────────────────────────────────────────────
    const sessionIdRef = useRef<string | null>(null);
    const audioBufferRef = useRef<Blob[]>([]);
    const maxDurationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isStartingRef = useRef(false);
    const receivedFinalRef = useRef(false);

    // ─── Custom Hooks ─────────────────────────────────────────────
    const { audioLevel, setupVisualizer, stopVisualizer } = useAudioVisualizer();

    // ─── Session Cleanup ──────────────────────────────────────────
    // Single source of truth for cleaning up a session.
    // Safe to call multiple times — idempotent.
    const resetSession = useCallback(() => {
      if (maxDurationRef.current) { clearTimeout(maxDurationRef.current); maxDurationRef.current = null; }
      if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }
      if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
      audioBufferRef.current = [];
      isStartingRef.current = false;
      setIsListening(false);
      setIsProcessing(false);
      setCurrentTranscript('');
    }, []);

    // ─── WebSocket Handlers ───────────────────────────────────────
    const handleStreamReady = useCallback(() => {
      const buffered = audioBufferRef.current;
      audioBufferRef.current = [];
      buffered.forEach((blob) => {
        blobToBase64(blob).then((base64) => {
          sendMessage({
            type: 'speech:audio',
            sessionId: sessionIdRef.current!,
            audio: base64,
          });
        });
      });
    }, []);

    const handleTranscriptMessage = useCallback(
      (data: TranscriptMessage) => {
        const { transcript, isFinal, confidence } = data;

        if (isFinal && transcript.trim()) {
          receivedFinalRef.current = true;

          // Cancel processing timeout — we got our answer
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }

          const filtered = filterEvaluationKeywords(transcript);
          setFinalTranscript(filtered);
          setIsProcessing(false);
          setCurrentTranscript('');
          onTranscript(filtered, confidence);

          if (autoStop) {
            // Full cleanup — session is done
            stopRecording();
            stopVisualizer();
            if (sessionIdRef.current) stopSession(sessionIdRef.current);
            if (maxDurationRef.current) { clearTimeout(maxDurationRef.current); maxDurationRef.current = null; }
            sessionIdRef.current = null;
            setIsListening(false);
          }
        } else if (!isFinal) {
          // Show interim results so student sees their words appearing
          setCurrentTranscript(transcript);
        }
      },
      [autoStop, onTranscript]
    );

    const handleErrorMessage = useCallback(
      (data: ErrorMessage) => {
        // Cancel processing timeout
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }

        if (isSilenceError(data.message)) {
          setErrorMessage('No escuché nada.\nMantén presionado e intenta de nuevo.');
        } else {
          setErrorMessage(data.message || 'Error de transcripción');
          if (onError) onError('transcription-failed');
        }

        setTimeout(() => setErrorMessage(null), TIMING.ERROR_DISPLAY_DURATION);

        // Full cleanup
        stopRecording();
        stopVisualizer();
        if (sessionIdRef.current) stopSession(sessionIdRef.current);
        resetSession();
        sessionIdRef.current = null;
      },
      [onError, resetSession]
    );

    const { sendMessage, startSession, stopSession, wsReadyRef } = useWebSocketConnection({
      locale,
      onTranscriptMessage: handleTranscriptMessage,
      onErrorMessage: handleErrorMessage,
      onStreamReady: handleStreamReady,
    });

    // ─── Audio Recording Handlers ─────────────────────────────────
    const handleAudioChunk = useCallback(
      (blob: Blob) => {
        if (wsReadyRef.current && sessionIdRef.current) {
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
      setCurrentTranscript('Habla ahora...');
      setFinalTranscript('');
      setErrorMessage(null);
      audioBufferRef.current = [];
    }, []);

    const handleRecordingStop = useCallback(() => {
      // MediaRecorder stopped — audio chunks flushed
    }, []);

    const handleRecordingError = useCallback(
      (error: Error) => {
        setErrorMessage(getMicrophoneErrorMessage(error));
        if (onError) onError('microphone-denied');
        resetSession();
      },
      [onError, resetSession]
    );

    const { startRecording, stopRecording } = useAudioRecording({
      onAudioChunk: handleAudioChunk,
      onRecordingStart: handleRecordingStart,
      onRecordingStop: handleRecordingStop,
      onError: handleRecordingError,
    });

    // ─── Core Functions ───────────────────────────────────────────
    const startListening = useCallback(async () => {
      // Create unique session ID per student per recording
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const userPrefix = userId ? `${userId.substr(0, 8)}-` : '';
      const sessionId = `speech-${userPrefix}${timestamp}-${randomId}`;
      sessionIdRef.current = sessionId;
      receivedFinalRef.current = false;

      // Start WebSocket session (Deepgram)
      startSession(sessionId);

      // Start recording and get audio stream
      const stream = await startRecording();
      if (stream) {
        setupVisualizer(stream);

        // Safety: auto-stop after MAX_DURATION so mic doesn't stay on forever
        maxDurationRef.current = setTimeout(() => {
          if (sessionIdRef.current) {
            // Trigger the same flow as user releasing the button
            handlePressEnd();
          }
        }, TIMING.MAX_DURATION);
      }
    }, [startRecording, startSession, setupVisualizer, userId]);

    // ─── Event Handlers ───────────────────────────────────────────
    const handlePressStart = useCallback(() => {
      // Clear any previous error immediately
      if (errorMessage) setErrorMessage(null);

      // If stuck in processing, reset so student can try again
      if (isProcessing) {
        stopRecording();
        stopVisualizer();
        if (sessionIdRef.current) stopSession(sessionIdRef.current);
        resetSession();
        sessionIdRef.current = null;
        return;
      }

      // Start listening with debounce to prevent accidental double-taps
      if (!isListening && !isStartingRef.current) {
        isStartingRef.current = true;
        debounceTimerRef.current = setTimeout(() => {
          if (isStartingRef.current) {
            startListening();
          }
        }, TIMING.DEBOUNCE_DELAY);
      }
    }, [isProcessing, isListening, errorMessage, startListening, resetSession, stopRecording, stopVisualizer, stopSession]);

    const handlePressEnd = useCallback(() => {
      // Cancel debounce if released before recording started
      if (isStartingRef.current && !isListening) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        isStartingRef.current = false;
        return;
      }

      // User released the mic button while recording
      if (isListening) {
        isStartingRef.current = false;
        setIsListening(false);
        setIsProcessing(true);
        setCurrentTranscript('');

        // Stop the MediaRecorder and audio visualizer
        stopRecording();
        stopVisualizer();

        // Clear max duration timeout (user stopped manually)
        if (maxDurationRef.current) {
          clearTimeout(maxDurationRef.current);
          maxDurationRef.current = null;
        }

        // Send stop signal to backend with delay so remaining audio chunks flush first
        setTimeout(() => {
          if (sessionIdRef.current) {
            stopSession(sessionIdRef.current);
          }
        }, TIMING.STOP_SIGNAL_DELAY);

        // Processing timeout — if backend doesn't respond, show friendly error
        processingTimeoutRef.current = setTimeout(() => {
          // Only show error if we never received a final transcript
          if (!receivedFinalRef.current) {
            setErrorMessage('No escuché bien.\nMantén presionado e intenta de nuevo.');
            setTimeout(() => setErrorMessage(null), TIMING.ERROR_DISPLAY_DURATION);
            if (onError) onError('timeout');
          }
          // Clean up
          sessionIdRef.current = null;
          audioBufferRef.current = [];
          setIsProcessing(false);
        }, TIMING.PROCESSING_TIMEOUT);
      }
    }, [isListening, stopRecording, stopVisualizer, stopSession, onError]);

    // ─── Imperative Handle ────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      stop: () => {
        if (isListening || isProcessing) {
          stopRecording();
          stopVisualizer();
          if (sessionIdRef.current) stopSession(sessionIdRef.current);
          resetSession();
          sessionIdRef.current = null;
        }
      },
      isListening: () => isListening,
    }));

    // ─── UI ───────────────────────────────────────────────────────
    const buttonColor = errorMessage
      ? 'bg-orange-500 hover:bg-orange-600'
      : isListening
      ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-2xl ring-4 ring-red-300'
      : isProcessing
      ? 'bg-yellow-500 hover:bg-yellow-600 cursor-pointer animate-pulse'
      : 'bg-blue-500 hover:bg-blue-600';

    const instructionText = errorMessage
      ? ''
      : isListening
      ? 'Grabando... Suelta para enviar'
      : isProcessing
      ? 'Procesando tu respuesta...'
      : 'Mantén presionado para hablar';

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
            aria-label={isListening ? 'Grabando' : 'Mantén para grabar'}
            disabled={!!errorMessage}
          >
            <ButtonIcon className="w-12 h-12" />
          </button>
        </div>

        {/* Instruction text */}
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-xs font-medium">{instructionText}</p>

        {/* Final transcript */}
        {showTranscript && finalTranscript && !isListening && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm max-w-md text-center font-medium">
            {finalTranscript}
          </div>
        )}

        {/* Current transcript (interim) */}
        {showTranscript && currentTranscript && isListening && currentTranscript !== 'Habla ahora...' && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm max-w-md text-center">
            {currentTranscript}
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="px-4 py-2 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg text-sm max-w-md text-center whitespace-pre-line">
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
