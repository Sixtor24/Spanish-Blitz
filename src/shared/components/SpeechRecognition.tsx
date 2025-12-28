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
  onTranscript: (transcript: string) => void;
  locale?: string;
  onError?: (error: string) => void;
  autoStop?: boolean; // If true, stops after receiving a final transcript
  stopOnCorrect?: boolean; // If true, parent can call stop() when answer is correct
};

// Constants
const MAX_DURATION = 15000; // 15 seconds maximum (safety timeout only)
const AUDIO_CHUNK_INTERVAL = 100; // Send audio chunks every 100ms for faster recognition from start

/**
 * Detect if device is mobile
 */
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (typeof window.orientation !== 'undefined') ||
         (navigator.maxTouchPoints ? navigator.maxTouchPoints > 2 : false);
};

/**
 * Get best audio MIME type for the device
 */
const getBestAudioMimeType = (): string => {
  if (typeof window === 'undefined') return 'audio/webm;codecs=opus';
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    if (MediaRecorder.isTypeSupported('audio/aac')) return 'audio/aac';
  }
  
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  
  return ''; // Let browser choose
};

const SpeechRecognition = forwardRef<SpeechRecognitionHandle, SpeechRecognitionProps>(
  ({ onTranscript, locale = 'es-ES', onError, autoStop = true, stopOnCorrect = false }, ref) => {
  // State
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  
  // Refs
  const isListeningRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopRef = useRef(autoStop);

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

  /**
   * Cleanup function
   */
  const cleanup = () => {
    console.log('🧹 [Speech] Cleaning up resources');
    
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('MediaRecorder stop error:', e);
      }
    }
    mediaRecorderRef.current = null;
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Close WebSocket
    if (wsRef.current && sessionIdRef.current) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'speech:stop',
          sessionId: sessionIdRef.current,
        }));
        wsRef.current.close();
      } catch (e) {
        console.warn('WebSocket close error:', e);
      }
    }
    wsRef.current = null;
    sessionIdRef.current = null;
    
    // Clear max duration timeout
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
    
    // Reset state
    isListeningRef.current = false;
    startTimeRef.current = null;
  };

  /**
   * Start listening
   */
  const startListening = async () => {
    try {
      console.log('🎤 [Speech] Starting speech recognition');
      
      // Check if already listening
      if (isListeningRef.current) {
        console.warn('⚠️ [Speech] Already listening');
        return;
      }
      
      // Request microphone permission
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
        streamRef.current = stream;
      } catch (err: any) {
        console.error('❌ [Speech] Microphone permission denied:', err);
        setErrorMessage('Microphone permission required. Please allow access.');
        if (onError) onError('microphone-denied');
        return;
      }
      
      // Update state
      isListeningRef.current = true;
      setIsListening(true);
      startTimeRef.current = Date.now();
      setCurrentTranscript('Connecting...');
      setErrorMessage(null);
      
      // Create WebSocket connection
      const ws = createWebSocket();
      const sessionId = `speech-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      wsRef.current = ws;
      sessionIdRef.current = sessionId;
      
      // Setup WebSocket handlers
      ws.onopen = () => {
        console.log('🔌 [Speech] WebSocket connected');
        ws.send(JSON.stringify({
          type: 'speech:start',
          sessionId,
          locale,
        }));
        setCurrentTranscript('Listening...');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'stream:started') {
            console.log('✅ [Speech] Stream started, beginning audio capture immediately');
            // Start MediaRecorder immediately when stream is ready
            // This ensures recognition works from the very beginning
            startMediaRecorder(stream, ws, sessionId);
          }
          
          else if (data.type === 'transcript') {
            const { transcript, isFinal } = data;
            if (transcript && transcript.trim()) {
              if (!isFinal) {
                // Show interim results
                setCurrentTranscript(transcript);
              } else {
                // Final result
                console.log(`📝 [Speech] Final transcript: "${transcript}"`);
                setCurrentTranscript('');
                onTranscript(transcript);
                
                // Auto-stop if enabled (default behavior for quiz/play mode)
                if (autoStopRef.current) {
                  console.log('🛑 [Speech] Auto-stopping after final transcript');
                  stopListening();
                }
              }
            }
          }
          
          else if (data.type === 'error') {
            console.error('❌ [Speech] Backend error:', data.message);
            setErrorMessage(data.message || 'Transcription error');
            if (onError) onError('transcription-failed');
            stopListening();
          }
        } catch (error: any) {
          console.error('❌ [Speech] Error parsing message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ [Speech] WebSocket error:', error);
        setErrorMessage('Connection error. Please try again.');
        if (onError) onError('connection-failed');
        stopListening();
      };
      
      ws.onclose = () => {
        console.log('🔌 [Speech] WebSocket closed');
      };
      
    } catch (error: any) {
      console.error('❌ [Speech] Start error:', error);
      setErrorMessage('Failed to start recording. Please try again.');
      if (onError) onError('start-failed');
      cleanup();
      setIsListening(false);
    }
  };

  /**
   * Start MediaRecorder and silence detection
   */
  const startMediaRecorder = (stream: MediaStream, ws: WebSocket, sessionId: string) => {
    try {
      // Determine best MIME type
      const mimeType = getBestAudioMimeType();
      console.log(`🎙️ [Speech] Using MIME type: ${mimeType || 'default'}`);
      
      // Create MediaRecorder with optimal settings for immediate capture
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle audio data - capture immediately for better recognition from start
      let chunkCount = 0;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          chunkCount++;
          // Convert to base64 and send immediately
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];
            if (base64Audio && sessionIdRef.current) {
              ws.send(JSON.stringify({
                type: 'speech:audio',
                sessionId: sessionIdRef.current,
                audio: base64Audio,
              }));
            }
          };
          reader.onerror = (error) => {
            console.error(`❌ [Speech] FileReader error:`, error);
          };
          reader.readAsDataURL(event.data);
        }
      };
      
      // Start recording with optimal interval for immediate recognition
      // Smaller interval = faster recognition from the very beginning
      mediaRecorder.start(AUDIO_CHUNK_INTERVAL);
      console.log(`🔴 [Speech] Recording started (${isMobileDevice() ? 'Mobile' : 'Desktop'}), capturing every ${AUDIO_CHUNK_INTERVAL}ms for immediate recognition`);
      
      // Setup maximum duration timeout (safety only)
      setupSilenceDetection(stream);
      
    } catch (error: any) {
      console.error('❌ [Speech] MediaRecorder error:', error);
      setErrorMessage('Recording failed. Please try again.');
      stopListening();
    }
  };

  /**
   * Setup maximum duration timeout (safety only)
   * No silence detection - mic closes only on final transcript or max duration
   */
  const setupSilenceDetection = (stream: MediaStream) => {
    try {
      // Only set up maximum duration timeout as a safety measure
      // The mic will close automatically when Deepgram sends a final transcript
      const maxDurationTimeout = setTimeout(() => {
        if (isListeningRef.current) {
          console.log('⏱️ [Speech] Maximum duration reached, stopping');
          stopListening();
        }
      }, MAX_DURATION);
      
      // Store timeout ID for cleanup
      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current);
      }
      maxDurationTimeoutRef.current = maxDurationTimeout;
      
    } catch (error: any) {
      console.error('❌ [Speech] Duration timeout setup error:', error);
    }
  };

  /**
   * Stop listening
   */
  const stopListening = () => {
    console.log('🛑 [Speech] Stopping speech recognition');
    cleanup();
    setIsListening(false);
    setCurrentTranscript('');
  };

  /**
   * Toggle listening
   */
  const toggleListening = () => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  };

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    autoStopRef.current = autoStop;
  }, [autoStop]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Microphone Button */}
      <button
        onClick={toggleListening}
        className={`
          flex items-center gap-2 px-6 py-3 rounded-lg font-medium
          transition-all duration-200 transform hover:scale-105
          ${isListening 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-green-500 hover:bg-green-600 text-white'
          }
        `}
        aria-label={isListening ? 'Stop Recording' : 'Start Recording'}
      >
        {isListening ? (
          <>
            <MicOff className="w-5 h-5" />
            Stop Recording
          </>
        ) : (
          <>
            <Mic className="w-5 h-5" />
            Speak Answer
          </>
        )}
      </button>

      {/* Current Transcript (Interim Results) */}
      {currentTranscript && (
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
          {currentTranscript}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm max-w-md text-center">
          {errorMessage}
        </div>
      )}
    </div>
  );
});

SpeechRecognition.displayName = 'SpeechRecognition';

export default SpeechRecognition;
