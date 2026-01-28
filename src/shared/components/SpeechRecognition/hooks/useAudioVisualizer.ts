/**
 * Custom hook for real-time audio level visualization
 */
import { useRef, useCallback, useState, useEffect } from 'react';
import { VISUALIZER_CONFIG } from '../constants';

export function useAudioVisualizer() {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);

  const setupVisualizer = useCallback((stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = VISUALIZER_CONFIG.fftSize;
      analyser.smoothingTimeConstant = VISUALIZER_CONFIG.smoothingTimeConstant;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      isActiveRef.current = true;

      // Animate audio level
      const updateAudioLevel = () => {
        if (!analyserRef.current || !isActiveRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(100, average));

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (e) {
      console.warn('[Speech] Audio visualizer not available:', e);
    }
  }, []);

  const stopVisualizer = useCallback(() => {
    isActiveRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVisualizer();
    };
  }, [stopVisualizer]);

  return {
    audioLevel,
    setupVisualizer,
    stopVisualizer,
  };
}
