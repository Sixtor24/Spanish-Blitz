/**
 * TypeScript types for Speech Recognition WebSocket messages
 */

export type WebSocketMessageType =
  | 'speech:start'
  | 'speech:stop'
  | 'speech:audio'
  | 'stream:started'
  | 'transcript'
  | 'error';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  sessionId?: string;
  locale?: string;
  audio?: string;
}

export interface TranscriptMessage extends WebSocketMessage {
  type: 'transcript';
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  message: string;
}

export interface StreamStartedMessage extends WebSocketMessage {
  type: 'stream:started';
}

export type SpeechErrorType = 'microphone-denied' | 'transcription-failed' | 'timeout';

export interface SpeechRecognitionHandle {
  stop: () => void;
  isListening: () => boolean;
}

export interface SpeechRecognitionProps {
  onTranscript: (transcript: string, confidence?: number) => void;
  locale?: string;
  onError?: (error: SpeechErrorType) => void;
  autoStop?: boolean;
  stopOnCorrect?: boolean;
  showTranscript?: boolean;
  userId?: string; // User ID to isolate sessions per student (critical for multi-user scenarios)
}

export interface AudioVisualizerState {
  level: number;
  isActive: boolean;
}
