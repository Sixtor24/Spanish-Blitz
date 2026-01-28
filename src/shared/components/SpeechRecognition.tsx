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
  const wsConnectedRef = useRef(false);
  const pendingSessionRef = useRef<string | null>(null);
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
      if (isListeningRef.current || isProcessing) {
        console.log('🛑 [Speech] Stopping via external call (correct answer)');
        stopListening();
      }
    },
    isListening: () => isListeningRef.current,
  }));

  /**
   * Cleanup only the current recording session
   * Keeps WebSocket persistent connection alive
   */
  const cleanupRecording = () => {
    // Stop media recorder and tracks
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    
    // Send stop signal to backend but KEEP WebSocket open
    if (wsRef.current && sessionIdRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'speech:stop', sessionId: sessionIdRef.current }));
      } catch (e) {
        console.warn('[Speech] Failed to send stop signal:', e);
      }
    }
    
    // Clear timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    
    // Reset recording state (but keep WebSocket!)
    mediaRecorderRef.current = null;
    streamRef.current = null;
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
   * Cleanup everything including WebSocket
   * Only used when unmounting component
   */
  const cleanupAll = () => {
    cleanupRecording();
    
    // Close persistent WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.warn('[Speech] Failed to close WebSocket:', e);
      }
      wsRef.current = null;
    }
    
    wsConnectedRef.current = false;
    pendingSessionRef.current = null;
  };

  /**
   * Initialize persistent WebSocket connection
   * This eliminates the 2.4s "Stalled" delay by keeping connection alive
   */
  const initializeWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[Speech] WebSocket already connected');
      return;
    }

    console.log('[Speech] Initializing persistent WebSocket connection...');
    const ws = createWebSocket();
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ [Speech] Persistent WebSocket CONNECTED');
      wsConnectedRef.current = true;
      
      // If there's a pending session, start it now
      if (pendingSessionRef.current) {
        const sessionId = pendingSessionRef.current;
        pendingSessionRef.current = null;
        ws.send(JSON.stringify({ type: 'speech:start', sessionId, locale }));
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'stream:started') {
        wsReadyRef.current = true;
        console.log('✅ [Speech] Stream ready, sending buffered audio');
        // Send buffered audio
        audioBufferRef.current.forEach(blob => sendAudioChunk(blob));
        audioBufferRef.current = [];
      } 
      else if (data.type === 'transcript') {
        const transcript = data.transcript || '';
        const isFinal = data.isFinal || false;
        const confidence = data.confidence || 0;
        
        if (isFinal) {
          console.log(`✅ [Speech] Final: "${transcript}" (${(confidence * 100).toFixed(1)}%)`);
          const filtered = filterEvaluationKeywords(transcript);
          setFinalTranscript(filtered);
          onTranscript(filtered, confidence);
          
          if (autoStop) {
            setTimeout(() => stopListening(), STOP_SIGNAL_DELAY);
          }
        } else {
          setCurrentTranscript(transcript);
        }
      } 
      else if (data.type === 'error') {
        const errorMsg = (data.message || '').toLowerCase();
        const isSilenceError = errorMsg.includes('silence') || 
                               errorMsg.includes('no speech') || 
                               errorMsg.includes('timeout') ||
                               errorMsg.includes('no audio');
        
        if (!isSilenceError) {
          setErrorMessage(data.message || 'Error');
          if (onError) onError('transcription-failed');
        } else {
          console.log('[Speech] Silence detected - waiting for user voice');
        }
        setIsProcessing(false);
        stopListening();
      }
    };

    ws.onerror = (error) => {
      console.error('[Speech] Persistent WebSocket error:', error);
      wsConnectedRef.current = false;
      
      // Auto-reconnect after delay
      setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log('🔄 [Speech] Auto-reconnecting WebSocket...');
          initializeWebSocket();
        }
      }, 1000);
    };

    ws.onclose = () => {
      console.log('[Speech] Persistent WebSocket closed');
      wsConnectedRef.current = false;
      wsReadyRef.current = false;
    };
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
      
      // Ensure WebSocket is connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('[Speech] WebSocket not ready, initializing...');
        initializeWebSocket();
      }
      
      // Create new session ID
      const sessionId = `speech-${Date.now()}`;
      sessionIdRef.current = sessionId;
      
      // Start speech session on existing WebSocket
      if (wsConnectedRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('[Speech] Starting session on persistent WebSocket:', sessionId);
        wsRef.current.send(JSON.stringify({ type: 'speech:start', sessionId, locale }));
      } else {
        console.log('[Speech] WebSocket connecting, session pending:', sessionId);
        pendingSessionRef.current = sessionId;
      }
      
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
      cleanupRecording();
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
    console.log('📦 [Speech] Stopping listening, cleaning up recording');
    cleanupRecording();
    setIsListening(false);
    setIsProcessing(false);
    setCurrentTranscript('');
    setAudioLevel(0);
  };

  /**
   * Filter evaluation keywords from display
   * Rules:
   * - "bien" → Don't show (return empty)
   * - "regular" or "medio correcta" → Don't show (return empty)
   * - "incorrecta" → Show the exact word
   * - Other words → Show normally
   */
  const filterEvaluationKeywords = (transcript: string): string => {
    const normalized = transcript.toLowerCase().trim();
    
    // Don't show "bien" or variations
    if (normalized === 'bien' || normalized === 'muy bien') {
      return '';
    }
    
    // Don't show "regular" or "medio correcta"
    if (normalized === 'regular' || normalized === 'medio correcta' || normalized === 'medio') {
      return '';
    }
    
    // Show everything else (including "incorrecta")
    return transcript;
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

  // Initialize persistent WebSocket on mount
  useEffect(() => {
    console.log('[Speech] Component mounted, initializing persistent WebSocket');
    initializeWebSocket();
    
    return () => {
      console.log('[Speech] Component unmounting, closing everything');
      cleanupAll();
    };
  }, []);

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
