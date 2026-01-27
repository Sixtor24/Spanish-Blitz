import { useState, useEffect, useRef } from 'react';
import { Volume2, Loader2, Turtle } from 'lucide-react';
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
  const prevUserRef = useRef<typeof user>(null);
  
  const userLocale = locale || user?.preferred_locale || 'es-ES';
  const userVoiceGender = (user?.preferred_voice_gender as 'male' | 'female') || 'female';

  useEffect(() => {
    initAudioPool();
  }, []);

  // Invalidar caché cuando cambian las preferencias del usuario
  useEffect(() => {
    const prevUser = prevUserRef.current;
    const currentUser = user;
    
    if (prevUser && currentUser) {
      const localeChanged = prevUser.preferred_locale !== currentUser.preferred_locale;
      const voiceChanged = prevUser.preferred_voice_gender !== currentUser.preferred_voice_gender;
      
      if (localeChanged || voiceChanged) {
        console.log('🔄 [TTSButton] User preferences changed, clearing cache:', {
          oldLocale: prevUser.preferred_locale,
          newLocale: currentUser.preferred_locale,
          oldVoice: prevUser.preferred_voice_gender,
          newVoice: currentUser.preferred_voice_gender
        });
        
        // Clear memory cache
        memoryCache.clear();
        
        // Clear localStorage cache
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
          keys.forEach(key => localStorage.removeItem(key));
          console.log(`✅ [TTSButton] Cleared ${keys.length} cached audio files`);
        } catch (e) {
          console.error('Error clearing cache:', e);
        }
      }
    }
    
    prevUserRef.current = currentUser;
  }, [user?.preferred_locale, user?.preferred_voice_gender]);

  const speak = async (slowMode: boolean = false) => {
    if (!text?.trim() || speaking || loading) return;
    
    const voice = userVoiceGender;
    const rate = slowMode ? '-40%' : undefined;
    
    console.log('🎤 [TTSButton] Requesting TTS:', {
      text: text.substring(0, 30) + '...',
      locale: userLocale,
      voice,
      rate,
      userId: user?.id?.substring(0, 8),
      userPreferredLocale: user?.preferred_locale,
      userPreferredVoice: user?.preferred_voice_gender,
    });
    
    const cacheKey = `${text}-${userLocale}-${voice}${rate ? `-${rate}` : ''}`;
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
        
        try {
          const response = await api.tts.synthesize(text, userLocale, voice, rate);
          if (!response.audio) throw new Error('No audio data');
          audioBase64 = response.audio;
          setCachedAudio(cacheKey, audioBase64);
          setLoading(false);
          setSpeaking(true);
        } catch (ttsError: any) {
          // Si Edge TTS falla (403, 500, etc), usar Web Speech API automáticamente
          console.warn('⚠️ [TTSButton] Edge TTS failed, using Web Speech API:', ttsError.message?.substring(0, 50));
          setLoading(false);
          fallbackToWebSpeech(userLocale, slowMode);
          return; // Exit early, fallback handles everything
        }
      }
      
      // Use Web Audio API for faster decoding
      const audio = getAudioFromPool();
      audio.src = `data:audio/mp3;base64,${audioBase64}`;
      // No modificar playbackRate - el audio ya viene a la velocidad correcta del backend
      
      audio.onended = () => {
        setSpeaking(false);
        setLoading(false);
      };
      audio.onerror = () => {
        setSpeaking(false);
        setLoading(false);
        console.warn('⚠️ [TTSButton] Audio playback failed, using Web Speech API');
        fallbackToWebSpeech(userLocale, slowMode);
      };

      await audio.play();
    } catch (error) {
      console.error('❌ [TTSButton] Unexpected error:', error);
      setLoading(false);
      setSpeaking(false);
      fallbackToWebSpeech(userLocale, slowMode);
    }
  };

  const fallbackToWebSpeech = (locale: string, slowMode: boolean = false) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.error('❌ [TTSButton] Web Speech API not available');
      setSpeaking(false);
      return;
    }

    console.log('🔊 [TTSButton] Using Web Speech API fallback');
    
    window.speechSynthesis.cancel();
    setSpeaking(true); // Set speaking to true when starting Web Speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale || 'es-ES';
    utterance.rate = slowMode ? 0.75 : 1.0; // Web Speech API usa playback rate
    
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang === locale || v.lang.startsWith('es'));
    if (spanishVoice) {
      utterance.voice = spanishVoice;
      console.log('🎤 [TTSButton] Using voice:', spanishVoice.name);
    }

    utterance.onend = () => {
      setSpeaking(false);
      console.log('✅ [TTSButton] Web Speech playback completed');
    };
    utterance.onerror = (event) => {
      setSpeaking(false);
      console.error('❌ [TTSButton] Web Speech error:', event.error);
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const sizeClasses: Record<NonNullable<TTSButtonProps['size']>, string> = {
    medium: 'px-4 py-2',
    large: 'px-6 py-4 text-lg',
  };

  const iconSize = size === 'large' ? 'w-6 h-6' : 'w-5 h-5';
  const buttonSize = size === 'large' ? 'p-4' : 'p-3';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => speak(false)}
        disabled={speaking || loading}
        className={`${buttonSize} rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors ${className}`}
        aria-label="Play audio"
      >
        {loading ? (
          <Loader2 className={`${iconSize} text-white animate-spin`} />
        ) : (
          <Volume2 className={`${iconSize} text-white`} />
        )}
      </button>
      
      <button
        onClick={() => speak(true)}
        disabled={speaking || loading}
        className={`${buttonSize} rounded-full transition-colors bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:cursor-not-allowed`}
        aria-label="Play slow"
        title="Reproducir lento (🐢)"
      >
        <Turtle className={`${iconSize} text-white`} />
      </button>
    </div>
  );
}
