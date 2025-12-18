import type * as React from 'react';

declare module '@auth/create/react' {
  export type SessionUser = {
    id?: string;
    role?: string;
    [key: string]: unknown;
  } | null;

  export type SessionData = {
    user?: SessionUser;
  } | null;

  export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

  export function useSession(): {
    data: SessionData;
    status: SessionStatus;
  };

  export type SignInProvider = string;
  export type SignInOptions = Record<string, unknown> & { callbackUrl?: string };

  export function signIn(provider: SignInProvider, options?: SignInOptions): Promise<void> | void;
  export function signOut(options?: { callbackUrl?: string }): Promise<void> | void;

  export interface SessionProviderProps {
    children?: React.ReactNode;
  }

  // SessionProvider is used in src/app/root.tsx; keep shape minimal.
  export const SessionProvider: React.ComponentType<SessionProviderProps>;
}
