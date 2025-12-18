import { useEffect, useState } from 'react';
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
  onresult: ((event: { results: Array<{ 0: { transcript: string } }> }) => void) | null;
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

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognition();

    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
      return;
    }

    const recognitionInstance = new SpeechRecognitionCtor();
  recognitionInstance.lang = locale;
  recognitionInstance.continuous = true; // keep session open until user stops
  recognitionInstance.interimResults = true; // allow longer utterances

    recognitionInstance.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
      // keep listening until user stops manually
    };

    recognitionInstance.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setErrorMessage(
        event.error === 'network'
          ? 'Browser blocked speech recognition. Check mic permissions, disable Shields/Adblock in Brave, or enable voice services.'
          : 'Speech recognition error. Try again or switch to Chrome/Edge.'
      );
      if (onError) onError(event.error);
      setIsListening(false);
    };

    recognitionInstance.onend = () => {
      // If we are supposed to be listening, restart to avoid premature stops
      setIsListening((prev) => {
        if (prev) {
          try {
            recognitionInstance.start();
            return true;
          } catch (err) {
            console.error('Failed to restart speech recognition:', err);
            return false;
          }
        }
        return false;
      });
    };

    setRecognition(recognitionInstance);

    return () => {
      recognitionInstance.abort();
    };
  }, [locale, onTranscript, onError]);

  const toggleListening = () => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      setErrorMessage(null);
    } else {
      setErrorMessage(null);
      recognition.start();
      setIsListening(true);
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
