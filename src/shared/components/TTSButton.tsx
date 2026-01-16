import { useState, useEffect, useRef } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { api } from '@/config/api';
import { useUser } from '@/shared/hooks/useUser';

type TTSButtonProps = {
  text: string;
  locale?: string;
  slow?: boolean;
  size?: 'medium' | 'large';
  className?: string;
};

// Persistent cache using localStorage + in-memory for speed
const memoryCache = new Map<string, string>();
const CACHE_PREFIX = 'tts_audio_';
const MAX_CACHE_SIZE = 50; // Limit cache entries

// Preload Audio element pool for instant playback
const audioPool: HTMLAudioElement[] = [];
const POOL_SIZE = 3;

const initAudioPool = () => {
  if (typeof window === 'undefined') return;
  for (let i = 0; i < POOL_SIZE; i++) {
    audioPool.push(new Audio());
  }
};

const getAudioFromPool = (): HTMLAudioElement => {
  return audioPool.find(a => a.paused) || new Audio();
};

// Persistent cache helpers
const getCachedAudio = (key: string): string | null => {
  if (memoryCache.has(key)) return memoryCache.get(key)!;
  
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (cached) {
      memoryCache.set(key, cached);
      return cached;
    }
  } catch {}
  return null;
};

const setCachedAudio = (key: string, audio: string): void => {
  memoryCache.set(key, audio);
  try {
    // Manage cache size
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    if (keys.length >= MAX_CACHE_SIZE) {
      localStorage.removeItem(keys[0]);
    }
    localStorage.setItem(CACHE_PREFIX + key, audio);
  } catch {}
};

export default function TTSButton({
  text,
  locale,
  slow = false,
  size = 'medium',
  className = '',
}: TTSButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useUser();
  
  const userLocale = locale || user?.preferred_locale || 'es-ES';

  useEffect(() => {
    initAudioPool();
  }, []);

  const speak = async () => {
    if (!text?.trim() || speaking || loading) return;
    
    // Usar preferencia de género de voz del usuario o 'female' por defecto
    const voice: 'male' | 'female' = (user?.preferred_voice_gender as 'male' | 'female') || 'female';
    const cacheKey = `${text}-${userLocale}-${voice}`;
    const cachedAudio = getCachedAudio(cacheKey);
    
    try {
      let audioBase64: string;
      
      if (cachedAudio) {
        // Instant playback from cache
        audioBase64 = cachedAudio;
        setSpeaking(true);
      } else {
        // Show loading immediately for user feedback
        setLoading(true);
        const response = await api.tts.synthesize(text, userLocale, voice);
        if (!response.audio) throw new Error('No audio data');
        audioBase64 = response.audio;
        setCachedAudio(cacheKey, audioBase64);
        setLoading(false);
        setSpeaking(true);
      }
      
      // Use Web Audio API for faster decoding
      const audio = getAudioFromPool();
      audio.src = `data:audio/mp3;base64,${audioBase64}`;
      audio.playbackRate = slow ? 0.7 : 1.0;
      
      audio.onended = () => {
        setSpeaking(false);
        setLoading(false);
      };
      audio.onerror = () => {
        setSpeaking(false);
        setLoading(false);
        fallbackToWebSpeech(userLocale);
      };

      await audio.play();
    } catch (error) {
      setLoading(false);
      setSpeaking(false);
      fallbackToWebSpeech(userLocale);
    }
  };

  const fallbackToWebSpeech = (locale: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale || 'es-ES';
    utterance.rate = slow ? 0.7 : 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang === locale || v.lang.startsWith('es'));
    if (spanishVoice) utterance.voice = spanishVoice;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const sizeClasses: Record<NonNullable<TTSButtonProps['size']>, string> = {
    medium: 'px-4 py-2',
    large: 'px-6 py-4 text-lg',
  };

  const iconSize = size === 'large' ? 24 : 20;
  
  return (
    <button
      onClick={speak}
      disabled={speaking || loading}
      className={`inline-flex items-center gap-2 ${sizeClasses[size]} bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${className}`}
      type="button"
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : (
        <Volume2 size={iconSize} />
      )}
      {loading ? 'Loading...' : slow ? 'Hear it (slow)' : '🔊 Hear it'}
    </button>
  );
}
