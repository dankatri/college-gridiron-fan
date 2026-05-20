import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { type LocalUser, getStoredUser, saveUser, clearUser, createLocalUser } from '@/lib/auth';

interface AuthContextValue {
  user: LocalUser | null;
  signIn: (login: string, email?: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Synchronous init from localStorage — no async loading state needed
  const [user, setUser] = useState<LocalUser | null>(() => getStoredUser());

  const signIn = useCallback((login: string, email?: string) => {
    const newUser = createLocalUser(login, email);
    saveUser(newUser);
    setUser(newUser);
  }, []);

  const signOut = useCallback(() => {
    clearUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
