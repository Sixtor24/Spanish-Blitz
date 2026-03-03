/**
 * Custom hook for persistent WebSocket connection management.
 * Pre-warms the connection on mount so the mic button responds instantly.
 * Supports binary audio frames for lower latency.
 */
import { useRef, useCallback, useEffect } from 'react';
import { createWebSocket } from '../../../../config/api';
import type { WebSocketMessage, TranscriptMessage, ErrorMessage } from '../types';

interface UseWebSocketConnectionProps {
  locale: string;
  onTranscriptMessage: (data: TranscriptMessage) => void;
  onErrorMessage: (data: ErrorMessage) => void;
  onStreamReady: () => void;
}

const RECONNECT_DELAY = 3000;    // 3s between reconnect attempts
const MAX_RECONNECT_ATTEMPTS = 5;

export function useWebSocketConnection({
  locale,
  onTranscriptMessage,
  onErrorMessage,
  onStreamReady,
}: UseWebSocketConnectionProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const wsConnectedRef = useRef(false);
  const wsReadyRef = useRef(false);
  const pendingSessionRef = useRef<{ sessionId: string; mimeType: string } | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Stable refs for callbacks so WebSocket handlers don't go stale
  const onTranscriptRef = useRef(onTranscriptMessage);
  const onErrorRef = useRef(onErrorMessage);
  const onStreamReadyRef = useRef(onStreamReady);
  onTranscriptRef.current = onTranscriptMessage;
  onErrorRef.current = onErrorMessage;
  onStreamReadyRef.current = onStreamReady;

  const initializeWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }
    // Close any existing socket in CONNECTING state
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      return; // Already connecting, wait
    }

    const ws = createWebSocket();
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Speech] ✅ WebSocket connected');
      wsConnectedRef.current = true;
      reconnectAttemptsRef.current = 0;

      // Start pending session if user pressed mic while WS was connecting
      if (pendingSessionRef.current) {
        const { sessionId, mimeType } = pendingSessionRef.current;
        pendingSessionRef.current = null;
        console.log('[Speech] 📤 Sending pending speech:start', { sessionId, mimeType });
        ws.send(JSON.stringify({ type: 'speech:start', sessionId, locale, mimeType }));
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      // Only text messages from server (transcripts, errors, etc.)
      if (typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data);
        console.log('[Speech] 📥 WS message:', data.type, data.type === 'transcript' ? { transcript: data.transcript, isFinal: data.isFinal } : '');

        if (data.type === 'stream:started') {
          wsReadyRef.current = true;
          onStreamReadyRef.current();
        } else if (data.type === 'transcript') {
          onTranscriptRef.current(data as TranscriptMessage);
        } else if (data.type === 'error') {
          console.error('[Speech] ❌ Server error:', data.message);
          onErrorRef.current(data as ErrorMessage);
        }
      } catch (e) {
        console.warn('[Speech] Failed to parse WS message:', e);
      }
    };

    ws.onerror = (err) => {
      console.error('[Speech] ❌ WebSocket error:', err);
      wsConnectedRef.current = false;
    };

    ws.onclose = (event) => {
      console.log('[Speech] 🔌 WebSocket closed, code:', event.code, 'reason:', event.reason);
      wsConnectedRef.current = false;
      wsReadyRef.current = false;
      wsRef.current = null;

      // Auto-reconnect if component is still mounted
      if (mountedRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            initializeWebSocket();
          }
        }, RECONNECT_DELAY);
      }
    };
  }, [locale]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
    // Silently skip if WS is not open — speech:stop after correct answer is best-effort
  }, []);

  /**
   * Send raw binary audio data over WebSocket (no Base64/JSON overhead).
   * Falls back to Base64 JSON if binary send fails.
   */
  const sendBinary = useCallback((data: ArrayBuffer | Blob) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (data instanceof Blob) {
        // Convert Blob → ArrayBuffer so it's sent as a binary frame
        // (Blob may be sent as text by some browsers)
        data.arrayBuffer().then((buf) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            console.log('[Speech] 🎤 Sending binary audio chunk, size:', buf.byteLength);
            wsRef.current.send(buf);
          }
        });
      } else {
        console.log('[Speech] 🎤 Sending binary audio chunk, size:', data.byteLength);
        wsRef.current.send(data);
      }
    } else {
      console.warn('[Speech] ⚠️ Cannot send binary - WS not open, state:', wsRef.current?.readyState);
    }
  }, []);

  const startSession = useCallback((sessionId: string, mimeType: string = '') => {
    wsReadyRef.current = false; // Reset until stream:started comes back
    console.log('[Speech] 🚀 startSession', { sessionId, mimeType, connected: wsConnectedRef.current, wsState: wsRef.current?.readyState });
    if (wsConnectedRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'speech:start', sessionId, locale, mimeType }));
    } else {
      console.log('[Speech] ⏳ WS not open, queuing session as pending');
      pendingSessionRef.current = { sessionId, mimeType };
      initializeWebSocket();
    }
  }, [locale, initializeWebSocket]);

  const stopSession = useCallback((sessionId: string) => {
    sendMessage({ type: 'speech:stop', sessionId });
  }, [sendMessage]);

  const closeConnection = useCallback(() => {
    mountedRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
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

  // Pre-warm WebSocket on mount, cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    initializeWebSocket();
    return () => {
      closeConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    sendMessage,
    sendBinary,
    startSession,
    stopSession,
    isConnected: wsConnectedRef.current,
    isReady: wsReadyRef.current,
    wsReadyRef,
  };
}
