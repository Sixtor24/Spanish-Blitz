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
};

// Constants - Optimized for instant recording
const MAX_DURATION = 10000;
const AUDIO_CHUNK_INTERVAL = 1; 

const SpeechRecognition = forwardRef<SpeechRecognitionHandle, SpeechRecognitionProps>(
  ({ onTranscript, locale = 'es-ES', onError, autoStop = true, stopOnCorrect = false }, ref) => {
  // State - Simplified
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  
  // Refs - Simplified
  const isListeningRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioBufferRef = useRef<Blob[]>([]);
  const wsReadyRef = useRef(false)

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
        wsRef.current.send(JSON.stringify({ type: 'speech:stop', sessionId: sessionIdRef.current }));
        wsRef.current.close();
      } catch {}
    }
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    mediaRecorderRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
    sessionIdRef.current = null;
    audioBufferRef.current = [];
    wsReadyRef.current = false;
    isListeningRef.current = false;
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
      
      // Update state instantly
      isListeningRef.current = true;
      setIsListening(true);
      setCurrentTranscript('Speak Now');
      setFinalTranscript('');
      setErrorMessage(null);
      audioBufferRef.current = [];
      wsReadyRef.current = false;
      
      // Start recording IMMEDIATELY
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined 
      });
      mediaRecorderRef.current = mediaRecorder;
      
      // Buffer audio chunks
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && isListeningRef.current) {
          if (wsReadyRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
            sendAudioChunk(e.data);
          } else {
            audioBufferRef.current.push(e.data);
          }
        }
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
            if (!isFinal) {
              setCurrentTranscript(transcript);
            } else {
              setFinalTranscript(transcript);
              setCurrentTranscript('');
              onTranscript(transcript, confidence);
              setTimeout(() => stopListening(), 20);
            }
          }
        }
        else if (data.type === 'error') {
          setErrorMessage(data.message || 'Error');
          if (onError) onError('transcription-failed');
          stopListening();
        }
      };
      
      ws.onerror = () => {
        setErrorMessage('Connection error');
        if (onError) onError('connection-failed');
        stopListening();
      };
      
      // Safety timeout
      timeoutRef.current = setTimeout(() => {
        if (isListeningRef.current) stopListening();
      }, MAX_DURATION);
      
    } catch (err) {
      setErrorMessage('Microphone access required');
      if (onError) onError('microphone-denied');
      cleanup();
      setIsListening(false);
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

  useEffect(() => () => cleanup(), []);

  const buttonColor = errorMessage ? 'bg-red-500 hover:bg-red-600' 
    : isListening ? 'bg-orange-500 hover:bg-orange-600' 
    : 'bg-green-500 hover:bg-green-600';
  const buttonText = errorMessage ? 'Error - Try Again' 
    : isListening ? 'Speak Now' 
    : 'Speak Answer';
  const ButtonIcon = errorMessage ? MicOff : Mic;

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={toggleListening}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 ${buttonColor} text-white shadow-lg`}
        aria-label={isListening ? 'Stop Recording' : 'Start Recording'}
        disabled={!!errorMessage && !isListening}
      >
        <ButtonIcon className="w-5 h-5" />
        {buttonText}
      </button>

      {finalTranscript && !isListening && (
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm max-w-md text-center font-medium">
          {finalTranscript}
        </div>
      )}

      {currentTranscript && isListening && currentTranscript !== 'Speak Now' && (
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm max-w-md text-center">
          {currentTranscript}
        </div>
      )}

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
