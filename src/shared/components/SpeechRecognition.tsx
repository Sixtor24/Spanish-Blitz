import { useEffect, useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { api } from '@/config/api';

type SpeechRecognitionProps = {
  onTranscript: (transcript: string) => void;
  locale?: string;
  onError?: (error: string) => void;
};

type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionConstructor = new () => RecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

const getSpeechRecognition = (): RecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const candidate = window.SpeechRecognition || window.webkitSpeechRecognition;
  return candidate ?? null;
};

// Detect browser
const detectBrowser = (): 'brave' | 'chrome' | 'edge' | 'firefox' | 'safari' | 'other' => {
  if (typeof window === 'undefined') return 'other';
  
  const userAgent = navigator.userAgent.toLowerCase();
  const isBrave = (navigator as any).brave?.isBrave || false;
  
  if (isBrave) return 'brave';
  if (userAgent.includes('edg/')) return 'edge';
  if (userAgent.includes('chrome/')) return 'chrome';
  if (userAgent.includes('firefox/')) return 'firefox';
  if (userAgent.includes('safari/') && !userAgent.includes('chrome/')) return 'safari';
  return 'other';
};

// Check if running on localhost
const isLocalhost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
};

// Request microphone permission
const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop the stream immediately - we just needed permission
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.error('Microphone permission denied:', err);
    return false;
  }
};

export default function SpeechRecognition({ onTranscript, locale = 'es-ES', onError }: SpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const isListeningRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const minDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenRef = useRef(false);
  const retryCountRef = useRef(0);
  const browserRef = useRef<'brave' | 'chrome' | 'edge' | 'firefox' | 'safari' | 'other'>('other');
  const isLocalhostRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    browserRef.current = detectBrowser();
    isLocalhostRef.current = isLocalhost();
    const SpeechRecognitionCtor = getSpeechRecognition();

    // Safari and Brave don't support Web Speech API, but they can use backend transcription
    // So we only mark as unsupported if it's not Safari/Brave and Web Speech API is not available
    if (!SpeechRecognitionCtor) {
      if (browserRef.current !== 'safari' && browserRef.current !== 'brave') {
        setIsSupported(false);
        return;
      }
      // For Safari/Brave, we'll use backend transcription, so we don't need Web Speech API
      return;
    }

    const recognitionInstance = new SpeechRecognitionCtor();
    // Force Spanish only - normalize locale to Spanish variants
    const normalizedLocale = locale.startsWith('es-') ? locale : 'es-ES';
    recognitionInstance.lang = normalizedLocale;
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.maxAlternatives = 1;

    recognitionInstance.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          // This is a final result
          finalTranscript += transcript + ' ';
          finalTranscriptRef.current += transcript + ' ';
          hasSpokenRef.current = true; // User has spoken
        } else {
          // This is an interim result
          interimTranscript += transcript;
          hasSpokenRef.current = true; // User is speaking
        }
      }

      // Update the current transcript for display
      const currentText = (finalTranscriptRef.current + interimTranscript).trim();
      setCurrentTranscript(currentText);

      // Clear existing timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      // Set a new timer for 0.6 seconds of silence
      silenceTimerRef.current = setTimeout(() => {
        if (isListeningRef.current && startTimeRef.current) {
          const elapsed = Date.now() - startTimeRef.current;
          const finalText = finalTranscriptRef.current.trim();
          
          // If user has spoken and there's text, close after 0.6s of silence
          // OR if minimum 5 seconds have passed (even without speech)
          if (hasSpokenRef.current && finalText) {
            // User spoke and stopped - close immediately after 0.6s silence
            onTranscript(finalText);
            
            // Reset and stop
            finalTranscriptRef.current = '';
            setCurrentTranscript('');
            recognitionInstance.stop();
            isListeningRef.current = false;
            setIsListening(false);
            startTimeRef.current = null;
            hasSpokenRef.current = false;
          } else if (elapsed >= 5000 && finalText) {
            // Minimum 5 seconds passed, close even if no speech detected
            onTranscript(finalText);
            
            // Reset and stop
            finalTranscriptRef.current = '';
            setCurrentTranscript('');
            recognitionInstance.stop();
            isListeningRef.current = false;
            setIsListening(false);
            startTimeRef.current = null;
            hasSpokenRef.current = false;
          }
        }
      }, 600); // 0.6 seconds of silence
    };

    recognitionInstance.onerror = (event) => {
      const errorType = event.error;
      const browser = browserRef.current;
      const isLocal = isLocalhostRef.current;
      
      // Enhanced logging for debugging
      console.error('Speech recognition error:', {
        error: errorType,
        browser,
        isLocalhost: isLocal,
        retryCount: retryCountRef.current,
        isListening: isListeningRef.current,
        event: event
      });
      
      // Clear timers on error
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (minDurationTimerRef.current) {
        clearTimeout(minDurationTimerRef.current);
        minDurationTimerRef.current = null;
      }
      
      // Handle specific error types
      if (errorType === 'aborted') {
        // Aborted errors are common in Brave - try to restart if we haven't exceeded retries
        if (retryCountRef.current < 3 && isListeningRef.current) {
          retryCountRef.current++;
          const delay = browser === 'brave' ? 300 : 100;
          setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                return; // Don't show error, just retry
              } catch (err) {
                console.error('Failed to restart after abort:', err);
              }
            }
          }, delay);
          return; // Don't show error message yet
        }
        
        // Show Brave-specific message
        if (browser === 'brave') {
          setErrorMessage(
            'Brave blocked speech recognition. Click the Brave icon in the address bar, set "Trackers & ads blocking" and "Upgrade connections to HTTPS" to "Disabled", then refresh the page.'
          );
        } else {
          setErrorMessage(
            'Speech recognition was interrupted. Make sure your microphone is connected and allowed in browser settings.'
          );
        }
      } else if (errorType === 'not-allowed') {
        if (browser === 'brave') {
          setErrorMessage(
            'Microphone permission denied. Click the lock icon in the address bar and allow microphone access, or disable Brave Shields for this site.'
          );
        } else {
          setErrorMessage(
            'Microphone permission denied. Please allow microphone access in your browser settings.'
          );
        }
      } else if (errorType === 'network') {
        if (browser === 'brave') {
          if (isLocalhostRef.current) {
            setErrorMessage(
              'Brave blocks Google Speech API on localhost. This is a known Brave limitation. For development, please use Chrome or Edge. In production (HTTPS), Brave should work fine.'
            );
          } else {
            setErrorMessage(
              'Brave is blocking Google Speech API even with Shields disabled. This is a Brave browser limitation for privacy protection. Please use Chrome, Edge, or Safari for voice features.'
            );
          }
        } else {
          if (isLocalhostRef.current) {
            setErrorMessage(
              'Network error on localhost. Web Speech API may require HTTPS. Try using Chrome or Edge, or configure your dev server to use HTTPS.'
            );
          } else {
            setErrorMessage(
              'Network error. Check your internet connection and try again.'
            );
          }
        }
      } else if (errorType === 'service-not-allowed' || errorType === 'service-not-allowed') {
        if (browser === 'brave') {
          setErrorMessage(
            'Speech service blocked by Brave. Go to brave://settings/shields and disable "Block scripts" in Global defaults, then refresh.'
          );
        } else {
          setErrorMessage(
            'Speech recognition service unavailable. Please try again or use Chrome/Edge.'
          );
        }
      } else {
        setErrorMessage(
          browser === 'brave'
            ? 'Speech recognition error. Try disabling Brave Shields for this site or use Chrome/Edge.'
            : 'Speech recognition error. Try again or switch to Chrome/Edge.'
        );
      }
      
      if (onError) onError(errorType);
      isListeningRef.current = false;
      setIsListening(false);
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
      startTimeRef.current = null;
      hasSpokenRef.current = false;
      retryCountRef.current = 0;
    };

    recognitionInstance.onend = () => {
      // If we're still supposed to be listening and minimum duration hasn't passed, restart
      if (isListeningRef.current && startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        if (elapsed < 5000) {
          // Minimum 5 seconds hasn't passed yet, restart recognition
          // Add a small delay for Brave compatibility
          setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                return; // Don't reset state, keep listening
              } catch (err) {
                console.error('Failed to restart recognition:', err);
                // If restart fails, proceed with normal end handling
              }
            }
          }, browserRef.current === 'brave' ? 200 : 50);
          return; // Don't reset state yet
        }
      }
      
      // Only process if we were actually listening (not manually stopped)
      if (isListeningRef.current) {
        // Clear timers
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        if (minDurationTimerRef.current) {
          clearTimeout(minDurationTimerRef.current);
          minDurationTimerRef.current = null;
        }
        
        // Process any remaining transcript
        const finalText = finalTranscriptRef.current.trim();
        if (finalText) {
          onTranscript(finalText);
        }
        
        // Reset state
        finalTranscriptRef.current = '';
        setCurrentTranscript('');
        isListeningRef.current = false;
        setIsListening(false);
        startTimeRef.current = null;
        hasSpokenRef.current = false;
        retryCountRef.current = 0;
      }
    };

    recognitionRef.current = recognitionInstance;

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (minDurationTimerRef.current) {
        clearTimeout(minDurationTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [locale, onTranscript, onError]);

  // Check network connectivity for speech recognition
  const checkNetworkConnectivity = async (): Promise<boolean> => {
    try {
      // Try to connect to a test endpoint to verify network
      const response = await fetch('https://www.google.com/favicon.ico', { 
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return true;
    } catch (err) {
      console.warn('Network connectivity check failed:', err);
      return false;
    }
  };

  // Use backend transcription for Brave (works around browser limitations)
  const useBackendTranscription = async (stream: MediaStream) => {
    try {
      setCurrentTranscript('Listening...');
      
      // Create MediaRecorder with timeslice for better control
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Audio context for silence detection
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      let lastSoundTime = Date.now();
      let minDurationPassed = false;
      let audioContextClosed = false;
      const MIN_DURATION = 3000; // 3 seconds minimum
      const SILENCE_THRESHOLD = 30; // Volume threshold for silence
      const SILENCE_DURATION = 600; // 0.6 seconds of silence to stop (matching original)
      const MAX_DURATION = 15000; // 15 seconds maximum

      // Start minimum duration timer
      const minDurationTimer = setTimeout(() => {
        minDurationPassed = true;
        console.log('🎤 [Backend Speech] Minimum duration passed, silence detection active');
      }, MIN_DURATION);

      // Silence detection loop
      const checkSilence = () => {
        if (!isListeningRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const hasSound = average > SILENCE_THRESHOLD;

        if (hasSound) {
          lastSoundTime = Date.now();
        }

        const silenceDuration = Date.now() - lastSoundTime;
        const totalDuration = Date.now() - (startTimeRef.current || Date.now());

        // Stop conditions:
        // 1. Minimum duration passed AND silence detected for threshold
        // 2. Maximum duration reached
        if (minDurationPassed && silenceDuration >= SILENCE_DURATION) {
          console.log('🎤 [Backend Speech] Silence detected, stopping recording');
          isListeningRef.current = false;
          setIsListening(false);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          if (!audioContextClosed && audioContext.state !== 'closed') {
            audioContext.close().catch(() => {}); // Ignore errors if already closing
            audioContextClosed = true;
          }
          clearTimeout(minDurationTimer);
          return;
        }

        if (totalDuration >= MAX_DURATION) {
          console.log('🎤 [Backend Speech] Maximum duration reached, stopping recording');
          isListeningRef.current = false;
          setIsListening(false);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          if (!audioContextClosed && audioContext.state !== 'closed') {
            audioContext.close().catch(() => {}); // Ignore errors if already closing
            audioContextClosed = true;
          }
          clearTimeout(minDurationTimer);
          return;
        }

        // Continue checking
        requestAnimationFrame(checkSilence);
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          clearTimeout(minDurationTimer);
          
          // Close audio context if not already closed
          if (!audioContextClosed && audioContext.state !== 'closed') {
            audioContext.close().catch(() => {}); // Ignore errors if already closing
            audioContextClosed = true;
          }
          
          // Update state immediately
          isListeningRef.current = false;
          setIsListening(false);
          startTimeRef.current = null;
          
          // Combine all audio chunks
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Only process if we have audio data
          if (audioBlob.size === 0) {
            setErrorMessage('No audio recorded. Please try again.');
            setCurrentTranscript('');
            return;
          }
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1]; // Remove data:audio/webm;base64, prefix
            
            try {
              setCurrentTranscript('Processing...');
              
              // Send to backend for transcription
              const result = await api.speech.transcribe(base64Audio, locale);
              
              if (result.transcript && result.transcript.trim()) {
                onTranscript(result.transcript.trim());
                setCurrentTranscript('');
                setErrorMessage(null);
              } else {
                setErrorMessage('No speech detected. Please try again.');
                setCurrentTranscript('');
              }
            } catch (error: any) {
              console.error('Backend transcription error:', error);
              setErrorMessage(error.message || 'Transcription failed. Please try again.');
              setCurrentTranscript('');
              if (onError) onError('transcription-failed');
            }
          };
          reader.readAsDataURL(audioBlob);
        } catch (error: any) {
          console.error('Error processing audio:', error);
          setErrorMessage('Error processing audio. Please try again.');
          setCurrentTranscript('');
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      // Start recording with timeslice for continuous data
      mediaRecorder.start(100); // Collect data every 100ms
      const browserName = browserRef.current === 'brave' ? 'Brave' : browserRef.current === 'safari' ? 'Safari' : 'browser';
      console.log(`🎤 [Backend Speech] Recording started for ${browserName} browser`);
      
      // Start silence detection
      requestAnimationFrame(checkSilence);
    } catch (error: any) {
      console.error('Error setting up backend transcription:', error);
      setErrorMessage('Failed to start recording. Please try again.');
      if (onError) onError('recording-failed');
    }
  };

  const toggleListening = async () => {
    const isBrave = browserRef.current === 'brave';
    const isSafari = browserRef.current === 'safari';
    const needsBackend = isBrave || isSafari;
    
    // For Brave and Safari, use backend transcription
    if (needsBackend && !recognitionRef.current) {
      // This is expected - Safari doesn't support Web Speech API, Brave blocks it
      // Both will use backend transcription
    }

    if (isListeningRef.current) {
      // Stop listening
      isListeningRef.current = false;
      startTimeRef.current = null;
      
      if (needsBackend && mediaRecorderRef.current) {
        // Stop MediaRecorder for Brave/Safari
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
      } else if (recognitionRef.current) {
        // Stop Web Speech API for Chrome/Edge/Firefox
        recognitionRef.current.stop();
      }
      
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (minDurationTimerRef.current) {
        clearTimeout(minDurationTimerRef.current);
        minDurationTimerRef.current = null;
      }
      
      setIsListening(false);
      setErrorMessage(null);
      setCurrentTranscript('');
      finalTranscriptRef.current = '';
      hasSpokenRef.current = false;
      retryCountRef.current = 0;
    } else {
      // Start listening
      setErrorMessage(null);
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
      retryCountRef.current = 0;
      
      // Request microphone permission
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (err: any) {
        const browser = browserRef.current;
        if (browser === 'brave') {
          setErrorMessage(
            'Microphone permission required. Click the lock icon in the address bar and allow microphone access.'
          );
        } else {
          setErrorMessage(
            'Microphone permission required. Please allow microphone access in your browser settings.'
          );
        }
        return;
      }
      
      startTimeRef.current = Date.now();
      isListeningRef.current = true;
      hasSpokenRef.current = false;
      setIsListening(true);
      
      // For Brave and Safari, use backend transcription (Safari doesn't support Web Speech API)
      const needsBackend = isBrave || browserRef.current === 'safari';
      if (needsBackend) {
        await useBackendTranscription(stream);
        return;
      }
      
      // For other browsers (Chrome, Edge, Firefox), use Web Speech API
      if (!recognitionRef.current) {
        setErrorMessage('Speech recognition not available. Please use Chrome or Edge.');
        stream.getTracks().forEach(track => track.stop());
        isListeningRef.current = false;
        setIsListening(false);
        return;
      }
      
      // Set minimum duration timer
      if (minDurationTimerRef.current) {
        clearTimeout(minDurationTimerRef.current);
      }
      minDurationTimerRef.current = setTimeout(() => {
        // After 5 seconds, allow normal silence detection to work
      }, 5000);
      
      // Start Web Speech API
      try {
        console.log('Attempting to start speech recognition...', {
          browser: browserRef.current,
          isLocalhost: isLocalhostRef.current,
          hasRecognition: !!recognitionRef.current
        });
        recognitionRef.current.start();
        console.log('Speech recognition started successfully');
      } catch (err: any) {
        console.error('Failed to start speech recognition:', err);
        stream.getTracks().forEach(track => track.stop());
        const browser = browserRef.current;
        
        if (err.name === 'NotAllowedError' || err.message?.includes('not allowed')) {
          if (browser === 'brave') {
            setErrorMessage(
              'Microphone access denied. Click the lock icon in the address bar and allow microphone access.'
            );
          } else {
            setErrorMessage(
              'Microphone access denied. Please allow microphone access in your browser settings.'
            );
          }
        } else {
          setErrorMessage(
            browser === 'brave'
              ? 'Failed to start. Please try refreshing the page or use Chrome/Edge.'
              : 'Failed to start. Make sure another app is not using the microphone.'
          );
        }
        
        isListeningRef.current = false;
        setIsListening(false);
        if (minDurationTimerRef.current) {
          clearTimeout(minDurationTimerRef.current);
          minDurationTimerRef.current = null;
        }
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <MicOff className="mx-auto mb-2 text-yellow-600" size={32} />
        <p className="text-sm text-yellow-800">
          Speech recognition is not supported in this browser. Please use Chrome or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={toggleListening}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
          isListening ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse' : 'bg-green-600 text-white hover:bg-green-700'
        }`}
        type="button"
      >
        {isListening ? <MicOff size={24} /> : <Mic size={24} />}
        {isListening ? 'Stop Recording' : 'Speak Answer'}
      </button>
      
      
      
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <div className="text-sm text-red-800 text-center leading-relaxed font-medium mb-2">
            {browserRef.current === 'brave' ? (
              <>
                <span className="block mb-2 font-bold">⚠️ Error en Brave</span>
                <p className="text-xs font-normal text-red-700">
                  {errorMessage}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  💡 <strong>Nota:</strong> Brave ahora usa transcripción por backend. Si el error persiste, verifica que el backend tenga configurado DEEPGRAM_API_KEY.
                </p>
              </>
            ) : (
              <p className="block">{errorMessage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
