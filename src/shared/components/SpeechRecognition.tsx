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
  const [finalTranscript, setFinalTranscript] = useState<string>(''); // Final transcript to show below button
  const [isConnecting, setIsConnecting] = useState(false); // Track if we're in connecting/warmup phase
  
  // Refs
  const isListeningRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopRef = useRef(autoStop);
  const audioBufferRef = useRef<string[]>([]); // Buffer for audio chunks before WebSocket is ready
  const isWebSocketReadyRef = useRef(false); // Track if WebSocket is ready to receive audio

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
    
    // Clear audio buffer
    audioBufferRef.current = [];
    isWebSocketReadyRef.current = false;
    
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
      setIsConnecting(false); // Button is interactive immediately - no connection delay
      startTimeRef.current = Date.now();
      setCurrentTranscript('Speak Now'); // Show "Speak Now" immediately
      setFinalTranscript(''); // Clear previous final transcript
      setErrorMessage(null);
      audioBufferRef.current = []; // Clear buffer
      isWebSocketReadyRef.current = false; // WebSocket not ready yet
      
      // START MEDIARECORDER IMMEDIATELY - this is the key to eliminating latency
      // User can start speaking right away, audio will be buffered
      startMediaRecorder(stream);
      
      // Play ready beep immediately to signal user can speak
      playReadyBeep();
      
      // Create WebSocket connection IN PARALLEL while capturing audio
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
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'stream:started') {
            console.log('✅ [Speech] Backend ready, flushing buffered audio...');
            isWebSocketReadyRef.current = true;
            
            // Send all buffered audio chunks to backend
            const bufferedChunks = audioBufferRef.current;
            if (bufferedChunks.length > 0) {
              console.log(`📤 [Speech] Sending ${bufferedChunks.length} buffered chunks`);
              bufferedChunks.forEach((base64Audio) => {
                if (ws.readyState === WebSocket.OPEN && sessionIdRef.current) {
                  ws.send(JSON.stringify({
                    type: 'speech:audio',
                    sessionId: sessionIdRef.current,
                    audio: base64Audio,
                  }));
                }
              });
              // Clear buffer after sending
              audioBufferRef.current = [];
              console.log('✅ [Speech] Buffer flushed, now sending real-time');
            }
          }
          
          else if (data.type === 'transcript') {
            const { transcript, isFinal } = data;
            if (transcript && transcript.trim()) {
              if (!isFinal) {
                // Show interim results - clear status message when we have actual words
                setCurrentTranscript(transcript);
              } else {
                // Final result
                console.log(`📝 [Speech] Final transcript: "${transcript}"`);
                setFinalTranscript(transcript); // Store final transcript to show below
                setCurrentTranscript(''); // Clear status message
                onTranscript(transcript);
                
                // Always stop after final transcript (both correct and incorrect)
                console.log('🛑 [Speech] Stopping after final transcript');
                setTimeout(() => {
                  stopListening();
                }, 100); // Small delay to ensure transcript is processed
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
   * Start MediaRecorder immediately and buffer audio until WebSocket is ready
   */
  const startMediaRecorder = (stream: MediaStream) => {
    try {
      // Determine best MIME type
      const mimeType = getBestAudioMimeType();
      console.log(`🎙️ [Speech] Using MIME type: ${mimeType || 'default'}`);
      
      // Create MediaRecorder with optimal settings for immediate capture
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle audio data - buffer or send depending on WebSocket status
      let chunkCount = 0;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunkCount++;
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];
            if (base64Audio && isListeningRef.current) {
              // If WebSocket is ready, send immediately
              if (isWebSocketReadyRef.current && wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
                wsRef.current.send(JSON.stringify({
                  type: 'speech:audio',
                  sessionId: sessionIdRef.current,
                  audio: base64Audio,
                }));
              } else {
                // Otherwise, buffer for later
                console.log(`📦 [Speech] Buffering chunk ${audioBufferRef.current.length + 1}`);
                audioBufferRef.current.push(base64Audio);
              }
            }
          };
          reader.onerror = (error) => {
            console.error(`❌ [Speech] FileReader error:`, error);
          };
          reader.readAsDataURL(event.data);
        }
      };
      
      // Start recording immediately - user can speak right away!
      mediaRecorder.start(AUDIO_CHUNK_INTERVAL);
      console.log(`🔴 [Speech] Recording started IMMEDIATELY (${isMobileDevice() ? 'Mobile' : 'Desktop'}), capturing every ${AUDIO_CHUNK_INTERVAL}ms`);
      console.log('✅ [Speech] User can speak NOW - audio will be buffered until backend is ready');
      
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
   * Play a subtle ready beep to indicate system is ready
   * This provides audio feedback that the mic is truly listening
   */
  const playReadyBeep = () => {
    try {
      // Create a very short, subtle beep using Web Audio API
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // 800 Hz tone
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Low volume
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1); // 100ms beep
      
      // Clean up
      setTimeout(() => {
        audioContext.close();
      }, 200);
    } catch (error) {
      console.warn('[Speech] Could not play ready beep:', error);
    }
  };

  /**
   * Stop listening
   */
  const stopListening = () => {
    console.log('🛑 [Speech] Stopping speech recognition');
    cleanup();
    setIsListening(false);
    setIsConnecting(false);
    setCurrentTranscript('');
    // Keep finalTranscript visible until next recording starts
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

  // Determine button color and text based on state
  const getButtonState = () => {
    if (errorMessage) {
      return {
        color: 'bg-red-500 hover:bg-red-600',
        text: 'Error - Try Again',
        icon: <MicOff className="w-5 h-5" />
      };
    }
    
    if (isListening) {
      // Always show "Speak Now" in orange while listening (no red "Stop Recording")
      return {
        color: 'bg-orange-500 hover:bg-orange-600',
        text: 'Speak Now',
        icon: <Mic className="w-5 h-5" />
      };
    }
    
    // Not listening - default state
    return {
      color: 'bg-green-500 hover:bg-green-600',
      text: 'Speak Answer',
      icon: <Mic className="w-5 h-5" />
    };
  };

  const buttonState = getButtonState();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Microphone Button with Dynamic State */}
      <button
        onClick={toggleListening}
        className={`
          flex items-center gap-2 px-6 py-3 rounded-lg font-medium
          transition-all duration-300 transform hover:scale-105
          ${buttonState.color} text-white shadow-lg
          ${isConnecting ? 'opacity-75 cursor-wait' : ''}
        `}
        aria-label={isListening ? 'Stop Recording' : 'Start Recording'}
        disabled={isConnecting || (!!errorMessage && !isListening)}
      >
        {buttonState.icon}
        {buttonState.text}
      </button>

      {/* Final Transcript - Show the final answer below the button */}
      {finalTranscript && !isListening && (
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm max-w-md text-center font-medium">
          {finalTranscript}
        </div>
      )}

      {/* Current Transcript (Interim Results) - Only show when actively listening and transcribing */}
      {currentTranscript && 
       isListening &&
       currentTranscript !== 'Speak Now' && (
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm max-w-md text-center">
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
