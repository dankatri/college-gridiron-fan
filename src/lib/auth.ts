export interface LocalUser {
  id: string;
  login: string;
  email?: string;
  avatarUrl?: string;
}

const STORAGE_KEY = 'cgf-current-user';

/**
 * Derive a stable, deterministic ID from a login name.
 * This ensures logout/login with the same name reconnects to existing data.
 */
function deriveUserId(login: string): string {
  return `local-${login.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

export function getStoredUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalUser;
  } catch {
    return null;
  }
}

export function saveUser(user: LocalUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function createLocalUser(login: string, email?: string): LocalUser {
  return {
    id: deriveUserId(login),
    login,
    email,
    avatarUrl: `https://github.com/${encodeURIComponent(login)}.png`,
  };
}
