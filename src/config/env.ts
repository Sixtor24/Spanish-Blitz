/**
 * Environment configuration for frontend
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const APP_BASE_URL = import.meta.env.APP_BASE_URL || 'http://localhost:4000';

// WebSocket URL - must be direct connection (Amplify can't proxy WebSockets)
export const WS_URL = import.meta.env.VITE_WS_URL || API_BASE_URL.replace(/^http/, 'ws');

