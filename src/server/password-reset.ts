/**
 * Password reset token helpers (Edge-compatible).
 *
 * Only the SHA-256 hash of a token is persisted, so a database leak cannot be
 * replayed to take over accounts. The raw token is emailed to the user once.
 */

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const RESET_TOKEN_RESEND_INTERVAL_MS = 60 * 1000;

const TOKEN_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateResetToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

export async function hashResetToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function resetTokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RESET_TOKEN_TTL_MS);
}

export function buildResetUrl(token: string): string {
  const base = (process.env.APP_URL ?? 'https://college-gridiron-fan.vercel.app').replace(/\/+$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}
