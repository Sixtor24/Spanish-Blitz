import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/config/api';
import { setStoredToken, clearStoredToken } from '@/config/api';
import type { DbUser } from '@/types/api.types';

interface AuthContextType {
  user: DbUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, opts?: { firstName?: string; lastName?: string; displayName?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refetch: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (): Promise<boolean> => {
    try {
      const userData = await api.users.current();
      setUser(userData);
      return true;
    } catch (error: any) {
      // 401/Not authenticated is expected when user is not logged in
      // Silently set user to null without logging error
      const isAuthError = 
        error?.message?.includes('401') || 
        error?.message?.includes('Unauthorized') ||
        error?.message?.includes('Not authenticated');
      
      if (!isAuthError) {
        console.error('Error fetching user:', error);
      }
      
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await api.auth.signIn(email, password);

    // Store JWT in localStorage so Safari/iOS can authenticate via
    // Authorization header (ITP blocks cross-origin cookies)
    if (result.token) {
      setStoredToken(result.token);
    }

    await fetchUser();
  };

  const signUp = async (email: string, password: string, opts?: { firstName?: string; lastName?: string; displayName?: string }) => {
    const result = await api.auth.signUp(email, password, opts);

    // Store JWT in localStorage for Safari/iOS
    if (result.token) {
      setStoredToken(result.token);
    }

    await fetchUser();
  };

  const signOut = async () => {
    try {
      await api.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      clearStoredToken();
      setUser(null);
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        refetch: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

