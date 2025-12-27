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

  useEffect(() => {
    browserRef.current = detectBrowser();
    isLocalhostRef.current = isLocalhost();
    const SpeechRecognitionCtor = getSpeechRecognition();

    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
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

  const toggleListening = async () => {
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
      retryCountRef.current = 0;
    } else {
      // Start listening - first request microphone permission
      setErrorMessage(null);
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
      retryCountRef.current = 0;
      
      // For Brave, check network connectivity first
      if (browserRef.current === 'brave') {
        const hasNetwork = await checkNetworkConnectivity();
        if (!hasNetwork) {
          setErrorMessage(
            'Network connectivity issue detected. Please check your internet connection and ensure Brave Shields is not blocking network requests. Click the Brave icon in the address bar and disable "Trackers & ads blocking" and "Upgrade connections to HTTPS".'
          );
          return;
        }
      }
      
      // Request microphone permission first (especially important for Brave)
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        const browser = browserRef.current;
        if (browser === 'brave') {
          setErrorMessage(
            'Microphone permission required. Click the lock icon in the address bar and allow microphone access, or disable Brave Shields for this site.'
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
      
      // Set minimum duration timer
      if (minDurationTimerRef.current) {
        clearTimeout(minDurationTimerRef.current);
      }
      minDurationTimerRef.current = setTimeout(() => {
        // After 5 seconds, allow normal silence detection to work
      }, 5000);
      
      // Add a small delay for Brave compatibility
      const delay = browserRef.current === 'brave' ? 100 : 0;
      setTimeout(() => {
        if (!isListeningRef.current || !recognitionRef.current) return;
        
        try {
          console.log('Attempting to start speech recognition...', {
            browser: browserRef.current,
            isLocalhost: isLocalhostRef.current,
            hasRecognition: !!recognitionRef.current
          });
          recognitionRef.current.start();
          setIsListening(true);
          console.log('Speech recognition started successfully');
        } catch (err: any) {
          console.error('Failed to start speech recognition:', {
            error: err,
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
            browser: browserRef.current,
            isLocalhost: isLocalhostRef.current
          });
          const browser = browserRef.current;
          
          if (err.name === 'NotAllowedError' || err.message?.includes('not allowed')) {
            if (browser === 'brave') {
              setErrorMessage(
                'Microphone access denied. Click the lock icon in the address bar and allow microphone access, or disable Brave Shields for this site.'
              );
            } else {
              setErrorMessage(
                'Microphone access denied. Please allow microphone access in your browser settings.'
              );
            }
          } else if (err.name === 'AbortError' || err.message?.includes('abort')) {
            if (browser === 'brave') {
              setErrorMessage(
                'Speech recognition aborted by Brave. Click the Brave icon in the address bar, disable "Trackers & ads blocking" and "Upgrade connections to HTTPS", then refresh the page.'
              );
            } else {
              setErrorMessage(
                'Speech recognition was interrupted. Make sure your microphone is connected and try again.'
              );
            }
          } else if (err.name === 'NetworkError' || err.message?.includes('network')) {
            if (browser === 'brave') {
              setErrorMessage(
                'Network error. Brave is blocking the speech service. Click the Brave icon, set "Trackers & ads blocking" and "Upgrade connections to HTTPS" to "Disabled", then refresh.'
              );
            } else {
              setErrorMessage(
                'Network error. Check your internet connection and try again.'
              );
            }
        } else {
          const errorDetails = err?.name || err?.message || 'Unknown error';
          if (browser === 'brave') {
            if (isLocalhostRef.current) {
              setErrorMessage(
                `Failed to start (${errorDetails}). Brave is blocking speech recognition. Go to brave://settings/shields and disable "Trackers & ads blocking", "Upgrade connections to HTTPS", "Block scripts", and "Block fingerprinting" in Global defaults. Or use Chrome/Edge for development.`
              );
            } else {
              setErrorMessage(
                `Failed to start (${errorDetails}). Click the Brave icon and disable "Trackers & ads blocking" and "Upgrade connections to HTTPS", then refresh.`
              );
            }
          } else {
            setErrorMessage(
              `Failed to start (${errorDetails}). Make sure another app is not using the microphone.`
            );
          }
        }
          
          isListeningRef.current = false;
          startTimeRef.current = null;
          setIsListening(false);
          hasSpokenRef.current = false;
          if (minDurationTimerRef.current) {
            clearTimeout(minDurationTimerRef.current);
            minDurationTimerRef.current = null;
          }
        }
      }, delay);
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
            {browserRef.current === 'brave' && (errorMessage.includes('Network') || errorMessage.includes('network')) ? (
              <>
                <span className="block mb-3 font-bold text-lg">⚠️ Brave Browser Incompatibility</span>
                {isLocalhostRef.current ? (
                  <>
                    <p className="text-xs font-normal text-red-700 mb-3">
                      Brave blocks Google Speech API connections on localhost. This is a known limitation that cannot be bypassed by changing settings.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-2">
                      <p className="text-xs font-semibold text-blue-900 mb-1">✅ Solution for Development:</p>
                      <p className="text-xs text-blue-800">
                        Use <strong>Chrome</strong> or <strong>Edge</strong> for localhost development. They work perfectly with Web Speech API.
                      </p>
                    </div>
                    <p className="text-xs text-red-600 mt-2 italic">
                      Note: Brave will work fine in production (HTTPS) - this only affects localhost development.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-normal text-red-800 mb-3 leading-relaxed">
                      Brave blocks Google's speech recognition service for privacy protection, even with Shields disabled. This is a <strong>browser-level limitation</strong> that cannot be bypassed.
                    </p>
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-3">
                      <p className="text-sm font-bold text-blue-900 mb-2">✅ Recommended Browsers:</p>
                      <div className="space-y-1 text-xs text-blue-800">
                        <p>• <strong>Google Chrome</strong> - Best compatibility</p>
                        <p>• <strong>Microsoft Edge</strong> - Excellent support</p>
                        <p>• <strong>Safari</strong> - Works on Mac/iOS</p>
                      </div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                      <p className="text-xs text-yellow-900">
                        <strong>Why this happens:</strong> Brave prioritizes privacy by blocking Google services. Voice recognition requires Google's speech API, which Brave considers a privacy risk.
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : browserRef.current === 'brave' ? (
              <>
                <span className="block mb-2 font-bold">⚠️ Brave Configuration Issue</span>
                <p className="text-xs font-normal text-red-700">
                  {errorMessage}
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
