/**
 * Constants for Speech Recognition timing and configuration
 * Tuned for a learning platform: slow speakers need more time,
 * fast speakers get quick feedback.
 */

export const TIMING = {
  MAX_DURATION: 10000,        // 10s max recording — slow speakers need time for long words
  AUDIO_CHUNK_INTERVAL: 250,  // 250ms chunks — good balance between latency and overhead
  DEBOUNCE_DELAY: 50,         // 50ms — prevent accidental double-taps (fast response)
  STOP_SIGNAL_DELAY: 200,     // 200ms — flush remaining audio before sending stop to backend
  PROCESSING_TIMEOUT: 6000,   // 6s — wait for backend after user releases mic
  ERROR_DISPLAY_DURATION: 3000, // 3s — students need time to read the message
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
