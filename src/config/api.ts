/**
 * API Configuration for Spanish Blitz
 * Central configuration for all backend API calls
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Fetch wrapper with authentication and error handling
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    credentials: 'include', // Important: include cookies for authentication
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    const errorMessage = error.error || error.message || `Request failed with status ${response.status}`;
    
    // For 401 errors, use a specific message that can be detected
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * API Client with all endpoints organized by domain
 */
export const api = {
  // ============================================================================
  // Health Check
  // ============================================================================
  health: () => apiFetch('/api/health'),

  // ============================================================================
  // Authentication
  // ============================================================================
  auth: {
    /**
     * Sign in with email and password
     */
    signIn: (email: string, password: string) =>
      apiFetch('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    
    /**
     * Sign up with email, password, and optional display name
     */
    signUp: (email: string, password: string, displayName?: string) =>
      apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName }),
      }),
    
    /**
     * Sign out current user
     */
    signOut: () =>
      apiFetch('/api/auth/signout', { method: 'POST' }),
    
    /**
     * Get current JWT token
     */
    token: () => apiFetch('/api/auth/token'),
    
    /**
     * Request password reset email
     */
    forgotPassword: (email: string) => 
      apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    
    /**
     * Reset password with token
     */
    resetPassword: (email: string, token: string, newPassword: string) =>
      apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, token, newPassword }),
      }),
  },

  // ============================================================================
  // Users
  // ============================================================================
  users: {
    /**
     * Get current authenticated user
     */
    current: () => apiFetch('/api/users/current'),
    
    /**
     * Update current user profile
     */
    patch: (data: { display_name?: string; preferred_locale?: string }) => 
      apiFetch('/api/users/current', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    /**
     * Mark welcome modal as seen
     */
    markWelcomeSeen: () =>
      apiFetch('/api/users/mark-welcome-seen', { method: 'POST' }),
  },

  // ============================================================================
  // Decks
  // ============================================================================
  decks: {
    /**
     * List all decks with optional filters
     */
    list: (params?: { search?: string; filter?: 'all' | 'owned' | 'assigned' | 'public' }) => {
      const query = params ? new URLSearchParams(params as any).toString() : '';
      return apiFetch(`/api/decks${query ? `?${query}` : ''}`);
    },
    
    /**
     * Get a specific deck by ID
     */
    get: (id: string) => apiFetch(`/api/decks/${id}`),
    
    /**
     * Create a new deck
     */
    create: (data: { title: string; description?: string; is_public?: boolean; primary_color_hex?: string }) =>
      apiFetch('/api/decks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    /**
     * Update a deck
     */
    update: (id: string, data: { title?: string; description?: string; is_public?: boolean; primary_color_hex?: string }) =>
      apiFetch(`/api/decks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    /**
     * Delete a deck
     */
    delete: (id: string) =>
      apiFetch(`/api/decks/${id}`, { method: 'DELETE' }),
  },

  // ============================================================================
  // Cards
  // ============================================================================
  cards: {
    /**
     * List all cards in a deck
     */
    list: (deckId: string) => apiFetch(`/api/decks/${deckId}/cards`),
    
    /**
     * Get a specific card
     */
    get: (id: string) => apiFetch(`/api/cards/${id}`),
    
    /**
     * Create a new card in a deck
     */
    create: (deckId: string, data: { 
      prompt_es: string; 
      translation_en: string;
      distractor_1_es?: string;
      distractor_2_es?: string;
      distractor_3_es?: string;
      notes?: string;
    }) =>
      apiFetch(`/api/decks/${deckId}/cards`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    /**
     * Create multiple cards at once
     */
    bulkCreate: (deckId: string, cards: Array<{
      prompt_es: string;
      translation_en: string;
      distractor_1_es?: string;
      distractor_2_es?: string;
      distractor_3_es?: string;
    }>) =>
      apiFetch(`/api/decks/${deckId}/cards/bulk`, {
        method: 'POST',
        body: JSON.stringify({ cards }),
      }),
    
    /**
     * Update a card
     */
    update: (id: string, data: {
      prompt_es?: string;
      translation_en?: string;
      answer_es?: string;
      distractor_1_es?: string;
      distractor_2_es?: string;
      distractor_3_es?: string;
      notes?: string;
    }) =>
      apiFetch(`/api/cards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    /**
     * Delete a card
     */
    delete: (id: string) =>
      apiFetch(`/api/cards/${id}`, { method: 'DELETE' }),
  },

  // ============================================================================
  // Play Sessions (Blitz Challenges)
  // ============================================================================
  playSessions: {
    /**
     * Create a new play session (premium only)
     */
    create: (data: {
      deckId: string;
      questionCount?: number;
      timeLimitMinutes?: number;
      isTeacher?: boolean;
    }) =>
      apiFetch('/api/play-sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    /**
     * Join a play session using a code
     */
    join: (code: string, displayName: string) =>
      apiFetch('/api/play-sessions/join', {
        method: 'POST',
        body: JSON.stringify({ code, displayName }),
      }),
    
    /**
     * Get current state of a play session
     */
    getState: (id: string) => apiFetch(`/api/play-sessions/${id}/state`),
    
    /**
     * Start a play session (host only)
     */
    start: (id: string) =>
      apiFetch(`/api/play-sessions/${id}/start`, { method: 'POST' }),
    
    /**
     * Submit an answer to a question
     */
    answer: (id: string, questionId: string, isCorrect: boolean, answerText?: string) =>
      apiFetch(`/api/play-sessions/${id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ questionId, isCorrect, answerText }),
      }),
    
    /**
     * Kick a player from session (host/admin only)
     */
    kickPlayer: (sessionId: string, playerId: string) =>
      apiFetch(`/api/play-sessions/${sessionId}/players/${playerId}`, {
        method: 'DELETE',
      }),
  },

  // ============================================================================
  // Stats
  // ============================================================================
  stats: {
    /**
     * Get user statistics
     */
    get: () => apiFetch('/api/stats'),
  },

  // ============================================================================
  // Study Events
  // ============================================================================
  studyEvents: {
    /**
     * Record a study event
     */
    create: (data: {
      deck_id?: string;
      card_id: string;
      result: 'correct' | 'incorrect';
      mode?: string;
      response_type?: string;
      transcript_es?: string;
    }) =>
      apiFetch('/api/study-events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // ============================================================================
  // Admin
  // ============================================================================
  admin: {
    users: {
      /**
       * List all users (admin only)
       */
      list: (params?: { search?: string; role?: string; plan?: string }) => {
        const query = params ? new URLSearchParams(params as any).toString() : '';
        return apiFetch(`/api/admin/users${query ? `?${query}` : ''}`);
      },
      
      /**
       * Get a specific user (admin only)
       */
      get: (id: string) => apiFetch(`/api/admin/users/${id}`),
      
      /**
       * Update a user (admin only)
       */
      update: (id: string, data: {
        role?: 'user' | 'admin';
        is_premium?: boolean;
        plan?: 'free' | 'premium';
      }) =>
        apiFetch(`/api/admin/users/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      
      /**
       * Delete a user (admin only)
       */
      delete: (id: string) =>
        apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }),
    },
  },

  // ============================================================================
  // Text-to-Speech (TTS)
  // ============================================================================
  tts: {
    /**
     * Synthesize speech from text using edge-tts
     */
    synthesize: (text: string, locale: string = 'es-ES') =>
      apiFetch('/api/tts/synthesize', {
        method: 'POST',
        body: JSON.stringify({ text, locale }),
      }),
    
    /**
     * Get available voices
     */
    voices: () => apiFetch('/api/tts/voices'),
  },
};

// ============================================================================
// WebSocket Helper
// ============================================================================

/**
 * Create a WebSocket connection to the backend
 * @param path - WebSocket path (optional, defaults to root)
 */
export function createWebSocket(path: string = '') {
  const wsUrl = API_BASE_URL.replace('http', 'ws') + path;
  return new WebSocket(wsUrl);
}

/**
 * Subscribe to play session updates via WebSocket
 */
export function subscribeToSession(sessionId: string) {
  const ws = createWebSocket();
  
  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'subscribe',
      sessionId,
    }));
  };
  
  return ws;
}

// ============================================================================
// Export default for convenience
// ============================================================================
export default api;

