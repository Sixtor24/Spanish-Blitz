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
  const [recognition, setRecognition] = useState<RecognitionInstance | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognition();

    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
      return;
    }

    const recognitionInstance = new SpeechRecognitionCtor();
    recognitionInstance.lang = locale;
    recognitionInstance.continuous = true; // Keep listening
    recognitionInstance.interimResults = true; // Get interim results
    recognitionInstance.maxAlternatives = 3; // Get multiple alternatives for better accuracy

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
        } else {
          // This is an interim result
          interimTranscript += transcript;
        }
      }

      // Update the current transcript for display
      const currentText = (finalTranscriptRef.current + interimTranscript).trim();
      setCurrentTranscript(currentText);

      console.log('🎤 Speech interim:', currentText);

      // Clear existing timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      // Set a new timer for 5 seconds of silence
      silenceTimerRef.current = setTimeout(() => {
        const finalText = finalTranscriptRef.current.trim();
        if (finalText) {
          console.log('✅ Speech final (after 5s silence):', finalText);
          onTranscript(finalText);
          
          // Reset and stop
          finalTranscriptRef.current = '';
          setCurrentTranscript('');
          recognitionInstance.stop();
          setIsListening(false);
        }
      }, 5000); // 5 seconds of silence
    };

    recognitionInstance.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Clear timer on error
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      
      setErrorMessage(
        event.error === 'network'
          ? 'Browser blocked speech recognition. Check mic permissions, disable Shields/Adblock in Brave, or enable voice services.'
          : 'Speech recognition error. Try again or switch to Chrome/Edge.'
      );
      if (onError) onError(event.error);
      setIsListening(false);
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
    };

    recognitionInstance.onend = () => {
      console.log('🛑 Speech recognition ended');
      
      // Clear timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      
      // Process any remaining transcript
      const finalText = finalTranscriptRef.current.trim();
      if (finalText && isListening) {
        console.log('✅ Speech final (on end):', finalText);
        onTranscript(finalText);
      }
      
      // Reset state
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
      setIsListening(false);
    };

    setRecognition(recognitionInstance);

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      recognitionInstance.abort();
    };
  }, [locale, onTranscript, onError, isListening]);

  const toggleListening = () => {
    if (!recognition) return;

    if (isListening) {
      // Stop manually - process whatever we have
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      
      const finalText = finalTranscriptRef.current.trim();
      if (finalText) {
        console.log('✅ Speech final (manual stop):', finalText);
        onTranscript(finalText);
      }
      
      recognition.stop();
      setIsListening(false);
      setErrorMessage(null);
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
    } else {
      // Start listening
      setErrorMessage(null);
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
      
      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        setErrorMessage('Failed to start. Make sure another app is not using the microphone.');
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
      
      {isListening && currentTranscript && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg max-w-md">
          <p className="text-xs text-blue-600 mb-1">Listening...</p>
          <p className="text-sm text-gray-800">{currentTranscript}</p>
          <p className="text-xs text-gray-500 mt-1">Will submit after 5s of silence</p>
        </div>
      )}
      
      {errorMessage && (
        <p className="text-sm text-red-600 text-center max-w-md leading-snug">{errorMessage}</p>
      )}
    </div>
  );
}
