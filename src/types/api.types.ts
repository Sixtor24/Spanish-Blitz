/**
 * Shared TypeScript types for API routes
 */

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ApiContext {
  params: Record<string, string>;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface ApiSuccess<T = unknown> {
  data: T;
  message?: string;
}

// ============================================================================
// Database Types
// ============================================================================

export interface DbUser {
  id: string;
  email: string;
  display_name?: string | null;
  role?: 'user' | 'teacher' | 'admin' | null;
  preferred_locale?: string | null;
  preferred_voice_gender?: 'male' | 'female' | null;
  is_premium?: boolean | null;
  plan?: 'free' | 'premium' | 'gold' | null;
  has_seen_welcome?: boolean | null;
  xp_total?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface DbDeck {
  id: string;
  owner_id: string | null;
  owner_user_id: string | null;
  name: string;
  title: string | null;
  description: string | null;
  language: string;
  is_public: boolean;
  primary_color_hex: string | null;
  created_at: Date;
  updated_at: Date;
  card_count?: number;
}

export interface DbCard {
  id: string;
  deck_id: string;
  question: string; // Spanish text (also referred as prompt_es)
  answer: string; // English text (also referred as translation_en)
  prompt_es?: string; // Alias for question
  translation_en?: string; // Alias for answer
  notes?: string | null; // Optional notes (max 150 chars)
  type?: 'text' | 'audio' | 'image';
  audio_url?: string | null;
  image_url?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface DbStudyEvent {
  id: string;
  user_id: string;
  card_id: string;
  result: 'correct' | 'incorrect';
  response_time_ms: number | null;
  created_at: Date;
}

export interface DbPlaySession {
  id: string;
  host_user_id: string;
  deck_id: string;
  mode: string;
  is_teacher: boolean;
  question_count: number;
  time_limit_seconds: number | null;
  status: 'pending' | 'active' | 'finished';
  started_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
  code: string | null;
}

export interface DbPlaySessionPlayer {
  id: string;
  session_id: string;
  user_id: string;
  display_name: string;
  score: number;
  joined_at: Date;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name?: string;
    image?: string;
    role?: string;
  };
  expires?: string;
}

// ============================================================================
// API Request Body Types
// ============================================================================

export interface CreateDeckBody {
  title: string;
  description?: string;
  is_public?: boolean;
  primary_color_hex?: string;
}

export interface UpdateDeckBody {
  title?: string;
  description?: string;
  is_public?: boolean;
  primary_color_hex?: string;
}

export interface CreateCardBody {
  spanish_text: string;
  english_text: string;
  audio_url?: string;
  image_url?: string;
  order_index?: number;
}

export interface BulkCreateCardsBody {
  cards: Array<{
    spanish_text: string;
    english_text: string;
    audio_url?: string;
    image_url?: string;
  }>;
}

export interface UpdateUserBody {
  display_name?: string;
  preferred_locale?: string;
}

export interface UpdateUserAdminBody {
  role?: 'user' | 'admin';
  is_premium?: boolean;
  plan?: 'free' | 'premium';
}

export interface CreatePlaySessionBody {
  deck_id: string;
}

export interface JoinPlaySessionBody {
  code: string;
  display_name: string;
}

export interface SubmitAnswerBody {
  card_id: string;
  answer: string;
  response_time_ms?: number;
}

export interface CreateStudyEventBody {
  card_id: string;
  result: 'correct' | 'incorrect';
  response_time_ms?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface StatsResponse {
  cardsStudied: number;
  accuracy: number;
  streak: number;
}

export interface PlaySessionStateResponse {
  session: DbPlaySession;
  players: DbPlaySessionPlayer[];
  current_card?: DbCard;
  deck: DbDeck;
}

// ============================================================================
// Classroom Types
// ============================================================================

export interface DbClassroom {
  id: string;
  teacher_id: string;
  name: string;
  description: string | null;
  code: string;
  color?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  teacher_name?: string | null;
  student_count?: number;
  assignment_count?: number;
}

export interface DbClassroomMembership {
  id: string;
  classroom_id: string;
  student_id: string;
  joined_at: Date;
  is_active: boolean;
}

export interface DbAssignment {
  id: string;
  classroom_id: string;
  deck_id: string;
  title: string;
  description: string | null;
  due_date: Date | null;
  created_at: Date;
  completed_count?: number;
  total_students?: number;
}

export interface DbAssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  score: number | null;
  completed_at: Date | null;
  created_at: Date;
}

export interface CreateClassroomBody {
  name: string;
  description?: string;
}

export interface UpdateClassroomBody {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface JoinClassroomBody {
  code: string;
}

export interface CreateAssignmentBody {
  deck_id: string;
  title: string;
  description?: string;
  due_date?: string;
}

export interface ClassroomWithDetails extends DbClassroom {
  teacher: {
    id: string;
    display_name: string | null;
    email: string;
  };
  students?: Array<{
    id: string;
    display_name: string | null;
    email: string;
    joined_at: Date;
  }>;
  assignments?: DbAssignment[];
}

