/**
 * Hook para precargar audios específicos de un ejercicio
 * Precarga en background para reproducción instantánea
 */
import { useEffect, useRef } from 'react';
import { api } from '../../config/api';

const CACHE_PREFIX = 'tts_audio_';

const setCachedAudio = (key: string, audio: string): void => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, audio);
  } catch {}
};

const getCachedAudio = (key: string): string | null => {
  try {
    return localStorage.getItem(CACHE_PREFIX + key);
  } catch {
    return null;
  }
};

interface PrefetchOptions {
  locale?: string;
  voice?: 'male' | 'female';
  priority?: 'high' | 'low'; // high = precarga inmediata, low = después de 500ms
}

/**
 * Precarga audios de un array de textos
 * Uso: usePrefetchAudio({ texts: ['Hola', 'Adiós'], locale: 'es-ES' })
 */
export function usePrefetchAudio(
  texts: string[],
  options: PrefetchOptions = {}
) {
  const { locale = 'es-ES', voice = 'male', priority = 'high' } = options;
  const prefetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!texts || texts.length === 0) return;

    const prefetchAudio = async (text: string) => {
      const cacheKey = `${text}-${locale}-${voice}`;
      
      // Skip si ya está cacheado o ya se intentó precargar
      if (getCachedAudio(cacheKey) || prefetchedRef.current.has(cacheKey)) {
        return;
      }

      prefetchedRef.current.add(cacheKey);

      try {
        const response = await api.tts.synthesize(text, locale, voice);
        if (response.audio) {
          setCachedAudio(cacheKey, response.audio);
        }
      } catch (error) {
        // Silently fail - se intentará de nuevo on-demand
        console.warn(`[Prefetch] Failed to prefetch: "${text}"`);
      }
    };

    const prefetchAll = async () => {
      // Precarga en lotes de 3 para no saturar el backend
      for (let i = 0; i < texts.length; i += 3) {
        const batch = texts.slice(i, i + 3);
        await Promise.all(batch.map(prefetchAudio));
        // Pequeño delay entre lotes
        if (i + 3 < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    };

    // Delay inicial basado en prioridad
    const delay = priority === 'high' ? 0 : 500;
    const timer = setTimeout(prefetchAll, delay);

    return () => clearTimeout(timer);
  }, [texts, locale, voice, priority]);
}

/**
 * Hook específico para ejercicios de vocabulario
 * Precarga tanto la palabra como su definición/ejemplo
 */
export function usePrefetchVocabularyAudio(
  words: Array<{ spanish: string; definition?: string; example?: string }>,
  locale: string = 'es-ES'
) {
  const allTexts = words.flatMap(word => {
    const texts = [word.spanish];
    if (word.definition) texts.push(word.definition);
    if (word.example) texts.push(word.example);
    return texts;
  });

  usePrefetchAudio(allTexts, { locale, priority: 'high' });
}

/**
 * Precarga audios bajo demanda (para uso imperativo)
 */
export async function prefetchAudioImmediate(
  text: string,
  locale: string = 'es-ES',
  voice: 'male' | 'female' = 'male'
): Promise<void> {
  const cacheKey = `${text}-${locale}-${voice}`;
  
  if (getCachedAudio(cacheKey)) return;

  try {
    const response = await api.tts.synthesize(text, locale, voice);
    if (response.audio) {
      setCachedAudio(cacheKey, response.audio);
    }
  } catch {}
}
