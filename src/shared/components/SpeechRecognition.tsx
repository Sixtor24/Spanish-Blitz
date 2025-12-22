import { useEffect, useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

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
  const hasSpokenRef = useRef(false); // Track if user has spoken anything

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognition();

    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
      return;
    }

    const recognitionInstance = new SpeechRecognitionCtor();
    // Force Spanish only - normalize locale to Spanish variants
    const normalizedLocale = locale.startsWith('es-') ? locale : 'es-ES';
    recognitionInstance.lang = normalizedLocale;
    recognitionInstance.continuous = true; // Keep listening
    recognitionInstance.interimResults = true; // Get interim results
    recognitionInstance.maxAlternatives = 1; // Only Spanish alternatives

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
      console.error('Speech recognition error:', event.error);
      
      // Clear timers on error
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (minDurationTimerRef.current) {
        clearTimeout(minDurationTimerRef.current);
        minDurationTimerRef.current = null;
      }
      
      setErrorMessage(
        event.error === 'network'
          ? 'Browser blocked speech recognition. Check mic permissions, disable Shields/Adblock in Brave, or enable voice services.'
          : 'Speech recognition error. Try again or switch to Chrome/Edge.'
      );
      if (onError) onError(event.error);
      isListeningRef.current = false;
      setIsListening(false);
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
      startTimeRef.current = null;
      hasSpokenRef.current = false;
    };

    recognitionInstance.onend = () => {
      // If we're still supposed to be listening and minimum duration hasn't passed, restart
      if (isListeningRef.current && startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        if (elapsed < 5000) {
          // Minimum 5 seconds hasn't passed yet, restart recognition
          try {
            recognitionInstance.start();
            return; // Don't reset state, keep listening
          } catch (err) {
            console.error('Failed to restart recognition:', err);
            // If restart fails, proceed with normal end handling
          }
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

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListeningRef.current) {
      // Stop manually - process whatever we have
      isListeningRef.current = false;
      startTimeRef.current = null;
      
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (minDurationTimerRef.current) {
        clearTimeout(minDurationTimerRef.current);
        minDurationTimerRef.current = null;
      }
      
      const finalText = finalTranscriptRef.current.trim();
      if (finalText) {
        onTranscript(finalText);
      }
      
      recognitionRef.current.stop();
      setIsListening(false);
      setErrorMessage(null);
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
      hasSpokenRef.current = false;
    } else {
      // Start listening
      setErrorMessage(null);
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
      startTimeRef.current = Date.now();
      isListeningRef.current = true;
      hasSpokenRef.current = false; // Reset speech detection
      
      // Set minimum duration timer - ensure recognition stays active for at least 5 seconds
      if (minDurationTimerRef.current) {
        clearTimeout(minDurationTimerRef.current);
      }
      minDurationTimerRef.current = setTimeout(() => {
        // After 5 seconds, allow normal silence detection to work
      }, 5000);
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        setErrorMessage('Failed to start. Make sure another app is not using the microphone.');
        isListeningRef.current = false;
        startTimeRef.current = null;
        setIsListening(false);
        hasSpokenRef.current = false;
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
        <p className="text-sm text-red-600 text-center max-w-md leading-snug">{errorMessage}</p>
      )}
    </div>
  );
}
