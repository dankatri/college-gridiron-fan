import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export type User = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
};

type AuthResponse = {
  user: User | null;
  error?: string;
  code?: string;
};

export class AuthError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithPasskey: (email: string) => Promise<void>;
  registerPasskey: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string>;
  resetPassword: (token: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T;
  return payload;
}

function toErrorMessage(message: unknown, fallback: string): string {
  return typeof message === 'string' && message.length > 0 ? message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const payload = await readJson<AuthResponse>(response);
      setUser(payload.user ?? null);
    } catch (error) {
      console.error('[useAuth] Failed to check session', { error });
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const payload = await readJson<AuthResponse>(response);
    if (!response.ok || !payload.user) {
      throw new Error(toErrorMessage(payload.error, 'Failed to sign in'));
    }

    setUser(payload.user);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });

    const payload = await readJson<AuthResponse>(response);
    if (!response.ok || !payload.user) {
      throw new AuthError(toErrorMessage(payload.error, 'Failed to register account'), payload.code);
    }

    setUser(payload.user);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const payload = await readJson<{ ok?: boolean; message?: string; error?: string }>(response);
    if (!response.ok || !payload.ok) {
      throw new AuthError(toErrorMessage(payload.error, 'Failed to send password reset email'));
    }

    return toErrorMessage(
      payload.message,
      'If an account exists for that email, we have sent a password reset link.',
    );
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    const payload = await readJson<AuthResponse>(response);
    if (!response.ok || !payload.user) {
      throw new AuthError(toErrorMessage(payload.error, 'Failed to reset password'), payload.code);
    }

    setUser(payload.user);
  }, []);

  const signInWithPasskey = useCallback(async (email: string) => {
    const optionsResponse = await fetch('/api/auth/passkey/login-options', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const optionsPayload = await readJson<{ options?: unknown; error?: string }>(optionsResponse);
    if (!optionsResponse.ok || !optionsPayload.options) {
      throw new Error(toErrorMessage(optionsPayload.error, 'Failed to start passkey login'));
    }

    const authenticationResponse = await startAuthentication({
      optionsJSON: optionsPayload.options as Parameters<typeof startAuthentication>[0]['optionsJSON'],
    });

    const verifyResponse = await fetch('/api/auth/passkey/login-verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: authenticationResponse }),
    });
    const verifyPayload = await readJson<AuthResponse>(verifyResponse);
    if (!verifyResponse.ok || !verifyPayload.user) {
      throw new Error(toErrorMessage(verifyPayload.error, 'Passkey sign-in failed'));
    }

    setUser(verifyPayload.user);
  }, []);

  const registerPasskey = useCallback(async () => {
    const optionsResponse = await fetch('/api/auth/passkey/register-options', {
      method: 'GET',
      credentials: 'include',
    });
    const optionsPayload = await readJson<{ options?: unknown; error?: string }>(optionsResponse);
    if (!optionsResponse.ok || !optionsPayload.options) {
      throw new Error(toErrorMessage(optionsPayload.error, 'Failed to start passkey registration'));
    }

    const registrationResponse = await startRegistration({
      optionsJSON: optionsPayload.options as Parameters<typeof startRegistration>[0]['optionsJSON'],
    });

    const verifyResponse = await fetch('/api/auth/passkey/register-verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: registrationResponse }),
    });
    const verifyPayload = await readJson<{ ok?: boolean; error?: string }>(verifyResponse);
    if (!verifyResponse.ok || !verifyPayload.ok) {
      throw new Error(toErrorMessage(verifyPayload.error, 'Failed to register passkey'));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('[useAuth] Failed to log out', { error });
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        register,
        signInWithPasskey,
        registerPasskey,
        requestPasswordReset,
        resetPassword,
        signOut,
      }}
    >
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
