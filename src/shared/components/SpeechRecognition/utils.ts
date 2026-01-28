/**
 * Utility functions for Speech Recognition
 */

/**
 * Filter evaluation keywords from transcript display
 * @param transcript - Raw transcript from speech recognition
 * @returns Filtered transcript or empty string
 */
export function filterEvaluationKeywords(transcript: string): string {
  const normalized = transcript.toLowerCase().trim();

  // Don't show "bien" or variations
  if (normalized === 'bien' || normalized === 'muy bien') {
    return '';
  }

  // Don't show "regular" or "medio correcta"
  if (normalized === 'regular' || normalized === 'medio correcta' || normalized === 'medio') {
    return '';
  }

  // Show everything else (including "incorrecta")
  return transcript;
}

/**
 * Convert blob to base64 for WebSocket transmission
 * @param blob - Audio blob to convert
 * @returns Promise with base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Check if error is a silence-related error (not critical)
 * @param errorMessage - Error message from backend
 * @returns true if silence error
 */
export function isSilenceError(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return (
    msg.includes('silence') ||
    msg.includes('no speech') ||
    msg.includes('timeout') ||
    msg.includes('no audio')
  );
}

/**
 * Get user-friendly error message from MediaRecorder error
 * @param error - Error from getUserMedia
 * @returns User-friendly error message
 */
export function getMicrophoneErrorMessage(error: Error): string {
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return 'Please allow microphone access in your browser settings';
  } else if (error.name === 'NotFoundError') {
    return 'No microphone found';
  }
  return 'Microphone access failed';
}
