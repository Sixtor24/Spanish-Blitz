# Spanish Blitz Frontend — Architecture

## Overview

The Spanish Blitz Frontend is a **React 18 SPA** that provides an interactive Spanish-learning experience with flashcards, voice recognition, multiplayer challenges, classroom management, and gamification (XP system).

**Tech Stack:** TypeScript, React 18, React Router 6, Vite 6, TailwindCSS 3, @tanstack/react-query, react-hook-form, Lucide icons, Sonner (toasts).

---

## Directory Structure

```
src/
├── main.tsx                  # Application entry point (React root, providers)
├── App.tsx                   # Root component with route definitions
├── index.css                 # Global CSS entry
├── config/                   # Configuration layer
│   ├── env.ts                # Environment variables (API_BASE_URL, WS_URL)
│   └── api.ts                # API client (apiFetch wrapper + all endpoint methods)
├── lib/                      # Core libraries
│   └── auth-context.tsx      # Authentication context provider (React Context)
├── types/                    # Shared TypeScript interfaces
│   └── api.types.ts          # Database models, request/response types
├── domain/                   # Domain layer (Clean Architecture)
│   └── use-cases/            # Business logic use cases
│       ├── classroom/        # CreateClassroom, JoinClassroom, DeleteClassroom
│       └── assignment/       # CreateAssignment, DeleteAssignment
├── infrastructure/           # Infrastructure layer (Clean Architecture)
│   ├── repositories/         # Data access implementations
│   │   ├── ClassroomRepository.ts
│   │   └── AssignmentRepository.ts
│   └── services/             # External service implementations
│       └── AuthService.ts
├── shared/                   # Shared UI layer
│   ├── components/           # Reusable components
│   │   ├── Navigation.tsx    # Main navigation bar (role-aware)
│   │   ├── ProtectedRoute.tsx # Route guard component
│   │   ├── TTSButton.tsx     # Text-to-Speech playback button
│   │   ├── WelcomeModal.tsx  # First-time user welcome
│   │   ├── ColorPicker.tsx   # Deck color picker
│   │   ├── AdPlaceholder.tsx # Ad slot placeholder
│   │   ├── GuestBanner.tsx   # Guest mode banner
│   │   └── SpeechRecognition/ # Speech recognition components (7 files)
│   ├── hooks/                # Custom React hooks
│   │   ├── useAuth.ts        # Re-export of auth context hook
│   │   ├── useUser.ts        # Typed user data hook
│   │   ├── useUserQuery.ts   # React Query hooks (user, stats, decks, classrooms)
│   │   ├── usePrefetchAudio.ts # Audio prefetch for TTS
│   │   ├── useUpload.ts      # File upload hook
│   │   └── useHandleStreamResponse.ts # WebSocket stream handling
│   ├── hoc/                  # Higher-Order Components
│   │   └── withAuth.tsx      # Route protection HOC (roles, redirect)
│   └── utils/                # Utility functions
└── app/                      # Page components (file-system-like routing)
    ├── page.tsx              # Root redirect
    ├── global.css            # App-wide styles
    ├── homepage/             # Landing page
    ├── account/              # Auth pages (signin, signup, logout, forgot/reset password)
    ├── dashboard/            # Main dashboard (stats, decks, quick actions)
    ├── profile/              # User profile & preferences
    ├── study/                # Flashcard study mode
    ├── decks/[id]/           # Deck detail view
    ├── play/solo/            # Solo Blitz quiz mode
    ├── blitz-challenge/      # Multiplayer challenge (create, join, session)
    ├── classrooms/           # Student classroom views
    ├── teacher/              # Teacher panel & classroom management
    ├── admin/                # Admin pages (create-set, users management)
    ├── pricing/              # Premium plans
    ├── privacy/              # Privacy policy
    └── __create/             # 404 Not Found page
```

---

## Architecture Layers

### 1. Configuration (`config/`)

| File | Responsibility |
|------|---------------|
| `env.ts` | Single source of truth for environment variables: `API_BASE_URL`, `APP_BASE_URL`, `WS_URL`. |
| `api.ts` | Centralised API client. Exports `apiFetch()` (fetch wrapper with credentials, error handling) and an `api` object with all endpoint methods organised by domain. |

### 2. Auth Layer (`lib/auth-context.tsx`)

Provides a React Context with:
- **State:** `user` (DbUser | null), `loading` (boolean)
- **Actions:** `signIn`, `signUp`, `signOut`, `refetch`
- **Flow:** On mount, fetches `/api/users/current`. On sign-in/up, sets JWT cookie via backend, then fetches user. Includes Safari-compatible retry logic.

### 3. Domain Layer (`domain/use-cases/`)

Follows **Clean Architecture** principles for complex business operations:

| Use Case | Description |
|----------|-------------|
| `CreateClassroom` | Validates teacher role, creates classroom via repository |
| `JoinClassroom` | Validates code format, joins via repository |
| `DeleteClassroom` | Verifies ownership, checks for active assignments, deletes |
| `CreateAssignment` | Validates inputs (deck or XP goal), creates assignment |
| `DeleteAssignment` | Verifies teacher ownership, deletes assignment |

Each use case defines its own **repository interface** (Dependency Inversion Principle), which is implemented in the infrastructure layer.

### 4. Infrastructure Layer (`infrastructure/`)

| Component | Description |
|-----------|-------------|
| `ClassroomRepository` | Implements classroom data access using the `api` client |
| `AssignmentRepository` | Implements assignment data access using the `api` client |
| `AuthService` | Provides `getCurrentUser`, `hasRole`, `hasAnyRole` for use cases |

### 5. Shared Layer (`shared/`)

#### Components

| Component | Description |
|-----------|-------------|
| `DashboardLayout` | Shared sidebar layout wrapping all authenticated pages. Role-aware nav links, theme toggle, mobile overlay, logout. Replaces old `Navigation` component. |
| `Navigation` | Legacy navbar (only used on public `/privacy` page). |
| `ProtectedRoute` | Route guard using React Router navigation. |
| `TTSButton` | Google Cloud TTS audio playback with caching. |
| `SpeechRecognition/` | WebSocket-based speech recognition with Deepgram fallback for Brave. |
| `WelcomeModal` | First-time onboarding modal. |
| `NavigationGuard` | Sidebar navigation interception during active study/play sessions (exit confirmation modal). |

#### Hooks

| Hook | Description |
|------|-------------|
| `useAuth` | Re-export of `AuthContext` consumer |
| `useUser` | Typed wrapper around `useAuth` returning `DbUser` |
| `useUserQuery` | React Query hooks for user, stats, decks, classrooms |
| `usePrefetchAudio` | Preloads TTS audio for card lists |

#### HOC

| HOC | Description |
|-----|-------------|
| `withAuth` | Wraps pages with auth check + role authorization. Provides `withTeacherAuth`, `withAdminAuth`, `withStudentAuth` convenience wrappers. |

### 6. Pages (`app/`)

Pages follow a **file-system-like** naming convention (Next.js-inspired):
- `app/<feature>/page.tsx` — Page component
- `app/<feature>/[id]/page.tsx` — Dynamic route page

Each page is a self-contained component that:
1. Uses `withAuth` HOC for protection (when needed)
2. Fetches data via `api` client or React Query hooks
3. Renders with TailwindCSS utility classes

---

## Routing

Routes are defined in `App.tsx` using React Router 6:

| Route | Page | Auth |
|-------|------|------|
| `/` | Homepage (landing) | Public |
| `/account/signin` | Sign in | Public |
| `/account/signup` | Sign up | Public |
| `/account/logout` | Logout | Public |
| `/account/forgot-password` | Password reset request | Public |
| `/account/reset-password` | Password reset form | Public |
| `/pricing` | Plans & pricing | Public |
| `/privacy` | Privacy policy | Public |
| `/dashboard` | Main dashboard | `withAuth` |
| `/profile` | User settings | `withAuth` |
| `/study` | Flashcard study | `withAuth` |
| `/decks/:id` | Deck detail | `withAuth` |
| `/admin/create-set` | Deck editor | `withAuth` |
| `/admin/users` | User management | `withAdminAuth` |
| `/play/solo` | Solo Blitz | `withAuth` |
| `/blitz-challenge` | Challenge hub | `withAuth` |
| `/blitz-challenge/create/:id` | Create challenge | `withAuth` |
| `/blitz-challenge/session/:code` | Live challenge | `withAuth` |
| `/classrooms` | Student classrooms | `withAuth` |
| `/classrooms/:id` | Classroom detail | `withAuth` |
| `/teacher` | Teacher panel | `withTeacherAuth` |
| `/teacher/classrooms/:id` | Teacher classroom | `withTeacherAuth` |
| `*` | 404 Not Found | Public |

---

## State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| **Auth state** | React Context (`AuthProvider`) | User session, sign-in/out |
| **Server state** | @tanstack/react-query | Cached API data (user, decks, stats, classrooms) |
| **Local UI state** | `useState` / `useReducer` | Form inputs, modals, filters |
| **URL state** | React Router (`useSearchParams`, `useParams`) | Navigation, query parameters |

---

## API Communication

All API calls go through `apiFetch()` which:
1. Prepends `API_BASE_URL` to endpoints
2. Sets `credentials: 'include'` for cookie-based auth
3. Sets `Content-Type: application/json`
4. Parses JSON responses
5. Throws `Error` on non-OK responses (with 401 detection)

### Backend Email System (API Endpoints)

The backend provides automated email notifications via Resend. The frontend interacts with these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/email-preferences` | GET | Get current user's email notification preferences |
| `/api/email-preferences` | PUT | Update preferences (7 boolean flags: mission_assigned, mission_reminder, mission_completed, xp_milestones, streak_reminders, inactivity_reminders, weekly_digest) |
| `/api/auth/verify-email` | GET | Email verification link (clicked from email, redirects to dashboard) |

Emails are sent automatically by the backend on events like signup, assignment creation, mission completion, and via cron jobs (streaks, inactivity, weekly digest). No frontend action needed beyond the preferences API.

### WebSocket

Real-time features use a shared WebSocket connection:
- **Play sessions:** Subscribe to session updates via `subscribe` message
- **Speech streaming:** Stream audio chunks for real-time transcription

---

## Build & Development

| Command | Description |
|---------|-------------|
| `vite` | Development server (port 4000) |
| `vite build` | Production build (ES2020 target, esbuild minify) |
| `vite preview` | Preview production build |
| `tsc --noEmit` | Type checking |

### Chunk Strategy

| Chunk | Contents |
|-------|----------|
| `ui-vendor` | lucide-react, sonner |
| `form-vendor` | react-hook-form, yup |

---

## Deployment

- **Platform:** Railway / AWS Amplify
- **Build output:** `dist/`
- **SPA routing:** All paths serve `index.html`
- **Node:** >= 20.0.0
