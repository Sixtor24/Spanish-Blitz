/**
 * Custom hook for persistent WebSocket connection management
 */
import { useRef, useCallback, useEffect } from 'react';
import { createWebSocket } from '../../../../config/api';
import type { WebSocketMessage, TranscriptMessage, ErrorMessage } from '../types';
import { TIMING } from '../constants';

interface UseWebSocketConnectionProps {
  locale: string;
  onTranscriptMessage: (data: TranscriptMessage) => void;
  onErrorMessage: (data: ErrorMessage) => void;
  onStreamReady: () => void;
}

export function useWebSocketConnection({
  locale,
  onTranscriptMessage,
  onErrorMessage,
  onStreamReady,
}: UseWebSocketConnectionProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const wsConnectedRef = useRef(false);
  const pendingSessionRef = useRef<string | null>(null);
  const wsReadyRef = useRef(false);

  const initializeWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = createWebSocket();
    wsRef.current = ws;

    ws.onopen = () => {
      wsConnectedRef.current = true;

      // Start pending session if exists
      if (pendingSessionRef.current) {
        const sessionId = pendingSessionRef.current;
        pendingSessionRef.current = null;
        ws.send(JSON.stringify({ type: 'speech:start', sessionId, locale }));
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === 'stream:started') {
        wsReadyRef.current = true;
        onStreamReady();
      } else if (data.type === 'transcript') {
        onTranscriptMessage(data as TranscriptMessage);
      } else if (data.type === 'error') {
        onErrorMessage(data as ErrorMessage);
      }
    };

    ws.onerror = (error: Event) => {
      console.error('[Speech] WebSocket error:', error);
      wsConnectedRef.current = false;
      // Don't auto-reconnect - let user retry by pressing button
    };

    ws.onclose = () => {
      wsConnectedRef.current = false;
      wsReadyRef.current = false;
    };
  }, [locale, onTranscriptMessage, onErrorMessage, onStreamReady]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[Speech] Cannot send message - WebSocket not open');
    }
  }, []);

  const startSession = useCallback((sessionId: string) => {
    if (wsConnectedRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'speech:start', sessionId, locale }));
    } else {
      pendingSessionRef.current = sessionId;
      initializeWebSocket();
    }
  }, [locale, initializeWebSocket]);

  const stopSession = useCallback((sessionId: string) => {
    sendMessage({ type: 'speech:stop', sessionId });
  }, [sendMessage]);

  const closeConnection = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.warn('[Speech] Failed to close WebSocket:', e);
      }
      wsRef.current = null;
    }
    wsConnectedRef.current = false;
    pendingSessionRef.current = null;
  }, []);

  // Cleanup on unmount only - no auto-initialization
  useEffect(() => {
    return () => {
      closeConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - cleanup only on unmount

  return {
    sendMessage,
    startSession,
    stopSession,
    isConnected: wsConnectedRef.current,
    isReady: wsReadyRef.current,
    wsReadyRef,
  };
}
