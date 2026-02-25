/**
 * Constants for Speech Recognition timing and configuration
 */

export const TIMING = {
  MAX_DURATION: 8000, // 8s max recording
  AUDIO_CHUNK_INTERVAL: 250, // 250ms chunks
  DEBOUNCE_DELAY: 100, // 100ms debounce
  STOP_SIGNAL_DELAY: 350, // 350ms delay to flush remaining audio
  PROCESSING_TIMEOUT: 8000, // 8s processing timeout (allow backend more time under load)
  ERROR_DISPLAY_DURATION: 2500, // 2.5s error display
  RECONNECT_DELAY: 1000, // 1s WebSocket reconnect delay
} as const;

export const AUDIO_CONFIG = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 16000, // Optimal for speech recognition
} as const;

export const VISUALIZER_CONFIG = {
  fftSize: 256,
  smoothingTimeConstant: 0.8,
  minLevelThreshold: 10,
} as const;
