import { createContext, useContext, useCallback, useRef, useState, type ReactNode } from 'react';

interface NavigationGuardContextType {
  /** Register a guard — returns an unregister function */
  setGuard: (onBlock: () => void) => () => void;
  /** Try to navigate — returns true if allowed, false if blocked (guard callback fired) */
  tryNavigate: () => boolean;
  /** Whether a guard is currently active */
  isGuarded: boolean;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<(() => void) | null>(null);
  const [isGuarded, setIsGuarded] = useState(false);

  const setGuard = useCallback((onBlock: () => void) => {
    guardRef.current = onBlock;
    setIsGuarded(true);
    return () => {
      guardRef.current = null;
      setIsGuarded(false);
    };
  }, []);

  const tryNavigate = useCallback(() => {
    if (guardRef.current) {
      guardRef.current();
      return false; // blocked
    }
    return true; // allowed
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ setGuard, tryNavigate, isGuarded }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  return ctx;
}
