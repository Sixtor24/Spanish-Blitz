/**
 * Speech Recognition Component
 * Uses Deepgram backend streaming for all platforms (web and mobile)
 * Provides real-time transcription with interim results
 */
import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { createWebSocket } from '@/config/api';

export interface SpeechRecognitionHandle {
  stop: () => void;
  isListening: () => boolean;
}

type SpeechRecognitionProps = {
  onTranscript: (transcript: string, confidence?: number) => void;
  locale?: string;
  onError?: (error: string) => void;
  autoStop?: boolean; // If true, stops after receiving a final transcript
  stopOnCorrect?: boolean; // If true, parent can call stop() when answer is correct
  showTranscript?: boolean; // If false, don't show transcript in component (let parent handle it)
};

// ============================================
// CONSTANTS
// ============================================
const MAX_DURATION = 8000; // 8s max recording (reduced for faster feedback)
const AUDIO_CHUNK_INTERVAL = 250; // 250ms chunks for optimal processing
const DEBOUNCE_DELAY = 100; // 100ms debounce (reduced for instant response)
const STOP_SIGNAL_DELAY = 150; // 150ms delay (ultra fast like Duolingo)
const PROCESSING_TIMEOUT = 5000; // 5s timeout (increased to avoid premature resets)
const ERROR_DISPLAY_DURATION = 2500; // 2.5s error message display
const MAX_RETRY_ATTEMPTS = 2; // Retry failed connections automatically
const RETRY_DELAY = 500; // 500ms between retries 

const SpeechRecognition = forwardRef<SpeechRecognitionHandle, SpeechRecognitionProps>(
  ({ onTranscript, locale = 'es-ES', onError, autoStop = true, stopOnCorrect = false, showTranscript = true }, ref) => {
  // State - Separated UI from processing
  const [isListening, setIsListening] = useState(false); // UI state: button appearance
  const [isProcessing, setIsProcessing] = useState(false); // Internal: still processing audio
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // Visual feedback for audio input
  
  // Refs - Simplified
  const isListeningRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioBufferRef = useRef<Blob[]>([]);
  const wsReadyRef = useRef(false);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStartingRef = useRef(false);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Expose methods to parent component
   */
  useImperativeHandle(ref, () => ({
    stop: () => {
      if (isListeningRef.current) {
        console.log('🛑 [Speech] Stopping via external call');
        stopListening();
      }
    },
    isListening: () => isListeningRef.current,
  }));

  const cleanup = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    
    if (wsRef.current && sessionIdRef.current) {
      try {
        // Solo enviar si la conexión está abierta
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'speech:stop', sessionId: sessionIdRef.current }));
        }
        wsRef.current.close();
      } catch {}
    }
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    
    mediaRecorderRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
    sessionIdRef.current = null;
    audioBufferRef.current = [];
    wsReadyRef.current = false;
    isListeningRef.current = false;
    isStartingRef.current = false;
    startTimerRef.current = null;
    processingTimeoutRef.current = null;
    retryTimeoutRef.current = null;
    analyserRef.current = null;
    animationFrameRef.current = null;
  };

  /**
   * Setup audio visualizer for feedback (like Duolingo)
   */
  const setupAudioVisualizer = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Animate audio level
      const updateAudioLevel = () => {
        if (!analyserRef.current || !isListeningRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(100, average));
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();
    } catch (e) {
      console.warn('[Speech] Audio visualizer not available:', e);
    }
  };

  const startListening = async () => {
    if (isListeningRef.current) return;
    
    try {
      // Get microphone - optimized settings for speed
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Optimal for speech recognition
        } 
      });
      streamRef.current = stream;
      
      // Setup audio visualizer for feedback
      setupAudioVisualizer(stream);
      
      // Update state instantly
      isListeningRef.current = true;
      setIsListening(true);
      setCurrentTranscript('Speak Now');
      setFinalTranscript('');
      setErrorMessage(null);
      setRetryCount(0);
      audioBufferRef.current = [];
      wsReadyRef.current = false;
      
      // Start recording IMMEDIATELY
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined 
      });
      mediaRecorderRef.current = mediaRecorder;
      
      // Buffer audio chunks
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          if (wsReadyRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
            sendAudioChunk(e.data);
          } else {
            audioBufferRef.current.push(e.data);
          }
        }
      };
      
      // CRITICAL: Capture final audio chunk when recording stops
      mediaRecorder.onstop = () => {
        console.log('📦 [Speech] MediaRecorder stopped - final chunk captured');
      };
      
      mediaRecorder.start(AUDIO_CHUNK_INTERVAL);
      
      // Setup WebSocket in parallel
      const ws = createWebSocket();
      const sessionId = `speech-${Date.now()}`;
      wsRef.current = ws;
      sessionIdRef.current = sessionId;
      
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'speech:start', sessionId, locale }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'stream:started') {
          wsReadyRef.current = true;
          // Flush buffer
          audioBufferRef.current.forEach(blob => sendAudioChunk(blob));
          audioBufferRef.current = [];
        }
        else if (data.type === 'transcript') {
          const { transcript, isFinal, confidence } = data;
          if (transcript?.trim()) {
            // Filter evaluation keywords
            const shouldShowTranscript = filterEvaluationKeywords(transcript);
            
            if (!isFinal) {
              // Show interim results for immediate feedback
              if (shouldShowTranscript) {
                setCurrentTranscript(transcript);
              }
            } else {
              // Final transcript - evaluate immediately
              if (shouldShowTranscript) {
                setFinalTranscript(transcript);
              }
              setCurrentTranscript('');
              onTranscript(transcript, confidence);
              // Cleanup after processing
              setIsProcessing(false);
              setTimeout(() => stopListening(), 100); // Reduced from 300ms
            }
          }
        }
        else if (data.type === 'error') {
          // Ignorar errores de silencio - solo mostrar errores críticos
          const errorMsg = (data.message || '').toLowerCase();
          const isSilenceError = errorMsg.includes('silence') || 
                                 errorMsg.includes('no speech') || 
                                 errorMsg.includes('timeout') ||
                                 errorMsg.includes('no audio');
          
          if (!isSilenceError) {
            console.error('[Speech] Error:', data.message);
            setErrorMessage(data.message || 'Error');
            if (onError) onError('transcription-failed');
          } else {
            console.log('[Speech] Silencio detectado - esperando voz del usuario');
            // No mostrar error, solo continuar esperando
          }
          setIsProcessing(false);
          stopListening();
        }
      };
      
      ws.onerror = (error) => {
        console.error('[Speech] WebSocket error:', error);
        
        // Retry automatically for transient errors
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          console.log(`🔄 [Speech] Retrying connection (${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
          setRetryCount(prev => prev + 1);
          
          retryTimeoutRef.current = setTimeout(() => {
            if (isListeningRef.current) {
              // Restart connection without stopping recording
              const ws = createWebSocket();
              const sessionId = `speech-${Date.now()}`;
              wsRef.current = ws;
              sessionIdRef.current = sessionId;
              
              ws.onopen = () => {
                ws.send(JSON.stringify({ type: 'speech:start', sessionId, locale }));
              };
              
              // Re-attach all handlers
              ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'stream:started') {
                  wsReadyRef.current = true;
                  audioBufferRef.current.forEach(blob => sendAudioChunk(blob));
                  audioBufferRef.current = [];
                }
              };
            }
          }, RETRY_DELAY);
        } else {
          setErrorMessage('Connection failed - please try again');
          if (onError) onError('connection-failed');
          stopListening();
        }
      };
      
      // Safety timeout
      timeoutRef.current = setTimeout(() => {
        if (isListeningRef.current) stopListening();
      }, MAX_DURATION);
      
    } catch (err) {
      const error = err as Error;
      console.error('Microphone error:', error);
      
      // Better error message for permissions
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMessage('Please allow microphone access in your browser settings');
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No microphone found');
      } else {
        setErrorMessage('Microphone access failed');
      }
      
      if (onError) onError('microphone-denied');
      cleanup();
      setIsListening(false);
      setIsProcessing(false);
    }
  };

  const sendAudioChunk = (blob: Blob) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (base64 && wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'speech:audio',
          sessionId: sessionIdRef.current,
          audio: base64
        }));
      }
    };
    reader.readAsDataURL(blob);
  };

  const stopListening = () => {
    cleanup();
    setIsListening(false);
    setIsProcessing(false);
    setCurrentTranscript('');
    setAudioLevel(0);
  };

  /**
   * Filter evaluation keywords from display
   * Rules:
   * - "bien" → Don't show
   * - "regular" or "medio correcta" → Don't show
   * - "incorrecta" → Show the exact word
   * - Other words → Show normally
   */
  const filterEvaluationKeywords = (transcript: string): boolean => {
    const normalized = transcript.toLowerCase().trim();
    
    // Don't show "bien" or variations
    if (normalized === 'bien' || normalized === 'muy bien') {
      return false;
    }
    
    // Don't show "regular" or "medio correcta"
    if (normalized === 'regular' || normalized === 'medio correcta' || normalized === 'medio') {
      return false;
    }
    
    // Show everything else (including "incorrecta")
    return true;
  };

  // ============================================
  // EVENT HANDLERS
  // ============================================
  
  /**
   * Reset/Cancel processing if stuck
   */
  const handleReset = () => {
    console.log('🔄 [Speech] Resetting stuck processing');
    stopListening();
    setErrorMessage(null);
  };

  /**
   * Start recording with debounce
   */
  const handlePressStart = () => {
    if (isProcessing) {
      handleReset();
      return;
    }
    
    if (!isListeningRef.current && !isStartingRef.current && !errorMessage) {
      isStartingRef.current = true;
      startTimerRef.current = setTimeout(() => {
        if (isStartingRef.current) {
          startListening();
        }
      }, DEBOUNCE_DELAY);
    }
  };

  /**
   * Stop recording and process
   */
  const handlePressEnd = () => {
    // Cancel debounce if released early
    if (isStartingRef.current && !isListeningRef.current) {
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      isStartingRef.current = false;
      return;
    }
    
    // Stop recording if active
    if (isListeningRef.current) {
      isStartingRef.current = false;
      isListeningRef.current = false;
      
      // UI: Button turns green immediately
      setIsListening(false);
      setIsProcessing(true);
      setCurrentTranscript('');
      
      // Stop MediaRecorder
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      // Send stop signal with delay for full audio capture
      setTimeout(() => {
        if (wsRef.current && sessionIdRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
            type: 'speech:stop', 
            sessionId: sessionIdRef.current 
          }));
        }
      }, STOP_SIGNAL_DELAY);
      
      // Auto-reset if stuck processing
      processingTimeoutRef.current = setTimeout(() => {
        if (isProcessing) {
          console.warn('⚠️ [Speech] Processing timeout - resetting');
          stopListening();
          setErrorMessage('No response - try again');
          setTimeout(() => setErrorMessage(null), ERROR_DISPLAY_DURATION);
        }
      }, PROCESSING_TIMEOUT);
    }
  };

  useEffect(() => () => cleanup(), []);

  // ============================================
  // UI STATE
  // ============================================
  const buttonColor = errorMessage ? 'bg-orange-500 hover:bg-orange-600' 
    : isListening ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-2xl ring-4 ring-red-300' 
    : isProcessing ? 'bg-yellow-500 hover:bg-yellow-600 cursor-pointer animate-pulse'
    : 'bg-blue-500 hover:bg-blue-600';
  
  const instructionText = errorMessage ? 'Error - Try Again' 
    : isListening ? 'Recording... Release to stop' 
    : isProcessing ? 'Processing your answer...'
    : 'Press and hold to speak';
  
  const ButtonIcon = errorMessage ? MicOff : Mic;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Botón circular grande con icono y animación de audio */}
      <div className="relative flex items-center justify-center">
        {/* Audio level indicator - rings animados como Duolingo */}
        {isListening && audioLevel > 10 && (
          <>
            <div 
              className="absolute inset-0 rounded-full bg-blue-400 opacity-30 animate-ping"
              style={{ 
                animationDuration: '1s',
                transform: `scale(${1 + (audioLevel / 200)})`
              }}
            />
            <div 
              className="absolute inset-0 rounded-full bg-blue-300 opacity-20"
              style={{ 
                transform: `scale(${1 + (audioLevel / 150)})`,
                transition: 'transform 0.1s ease-out'
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
      
      {/* Texto instructivo debajo del botón */}
      <p className="text-sm text-gray-600 text-center max-w-xs font-medium">
        {instructionText}
      </p>

      {showTranscript && finalTranscript && !isListening && (
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm max-w-md text-center font-medium">
          {finalTranscript}
        </div>
      )}

      {showTranscript && currentTranscript && isListening && currentTranscript !== 'Speak Now' && (
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm max-w-md text-center">
          {currentTranscript}
        </div>
      )}

      {errorMessage && (
        <div className="px-4 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm max-w-md text-center">
          {errorMessage}
        </div>
      )}
    </div>
  );
});

SpeechRecognition.displayName = 'SpeechRecognition';

export default SpeechRecognition;
