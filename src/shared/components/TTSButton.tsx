import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { api } from '@/config/api';
import { useUser } from '@/shared/hooks/useUser';

type TTSButtonProps = {
  text: string;
  locale?: string; // Opcional, si no se pasa usa el del usuario
  slow?: boolean;
  size?: 'medium' | 'large';
  className?: string;
};

// Cache de audio para evitar regenerar el mismo texto
const audioCache = new Map<string, string>();

export default function TTSButton({
  text,
  locale, // Ya no tiene valor por defecto
  slow = false,
  size = 'medium',
  className = '',
}: TTSButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const { user } = useUser();
  
  // Usar el dialecto preferido del usuario, o 'es-ES' por defecto
  const userLocale = locale || user?.preferred_locale || 'es-ES';

  const speak = async () => {
    if (!text || text.trim().length === 0) return;
    
    setSpeaking(true);
    
    // Alternar aleatoriamente entre voz masculina y femenina
    const randomVoice: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female';
    
    try {
      // Generar clave de caché usando locale y voice por separado
      const cacheKey = `${text}-${userLocale}-${randomVoice}`;
      
      let audioBase64: string;
      
      // Verificar si está en caché
      if (audioCache.has(cacheKey)) {
        console.log(`💾 [TTS] Using cached audio for: "${text.substring(0, 50)}" (${randomVoice === 'male' ? '👨' : '👩'} ${userLocale})`);
        audioBase64 = audioCache.get(cacheKey)!;
      } else {
        console.log(`🎤 [TTS] Requesting Edge TTS audio for: "${text.substring(0, 50)}" (${randomVoice === 'male' ? '👨' : '👩'} ${userLocale})`);
        
        // Intentar usar edge-tts desde el backend con locale y voice separados
        const response = await api.tts.synthesize(text, userLocale, randomVoice);
        
        console.log('✅ [TTS] Received audio from Edge TTS:', {
          audioLength: response.audio?.length || 0,
          voice: response.voice,
          provider: response.provider,
          locale: userLocale,
          gender: randomVoice,
        });
        
        if (!response.audio) {
          throw new Error('No audio data received from backend');
        }
        
        audioBase64 = response.audio;
        
        // Guardar en caché
        audioCache.set(cacheKey, audioBase64);
        console.log(`💾 [TTS] Cached audio (cache size: ${audioCache.size})`);
      }
      
      // Crear audio desde base64
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audio.playbackRate = slow ? 0.7 : 1.0;
      
      audio.onended = () => {
        console.log('🎵 [TTS] Edge TTS audio playback finished');
        setSpeaking(false);
      };
      
      audio.onerror = (e) => {
        console.error('❌ [TTS] Audio playback error:', e);
        setSpeaking(false);
        // Fallback a Web Speech API
        console.warn('⚠️ [TTS] Falling back to Web Speech API');
        fallbackToWebSpeech(userLocale);
      };

      await audio.play();
      console.log(`▶️ [TTS] Playing Edge TTS audio... (${randomVoice === 'male' ? '👨' : '👩'} ${userLocale})`);
    } catch (error) {
      console.error('❌ [TTS] Backend request error:', error);
      // Fallback a Web Speech API nativo
      console.warn('⚠️ [TTS] Falling back to Web Speech API');
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
    
    // Intentar seleccionar una voz en español
    const voices = window.speechSynthesis.getVoices();
    const spanishVoices = voices.filter(v => v.lang.startsWith('es'));
    if (spanishVoices.length > 0) {
      // Intentar encontrar una voz que coincida con el locale
      const preferredVoice = spanishVoices.find(v => v.lang === locale) || spanishVoices[0];
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const sizeClasses: Record<NonNullable<TTSButtonProps['size']>, string> = {
    medium: 'px-4 py-2',
    large: 'px-6 py-4 text-lg',
  };

  return (
    <button
      onClick={speak}
      disabled={speaking}
      className={`inline-flex items-center gap-2 ${sizeClasses[size]} bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      type="button"
    >
      <Volume2 size={size === 'large' ? 24 : 20} />
      {slow ? 'Hear it (slow)' : '🔊 Hear it'}
    </button>
  );
}
