import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/config/api';
import type { DbUser } from '@/types/api.types';

interface AuthContextType {
  user: DbUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const userData = await api.users.current();
      setUser(userData);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await api.auth.signIn(email, password);
      await fetchUser();
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      await api.auth.signUp(email, password, name);
      await fetchUser();
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await api.auth.signOut();
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
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

