import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'cgf-session';
const PASSKEY_CHALLENGE_COOKIE = 'cgf-passkey-challenge';
const PASSKEY_USER_COOKIE = 'cgf-passkey-user';
const MAX_AGE = 30 * 24 * 60 * 60;
const PASSKEY_COOKIE_MAX_AGE = 5 * 60;

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').map((part) => part.trim());
  const matched = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!matched) return null;
  return decodeURIComponent(matched.slice(name.length + 1));
}

function cookieHeader(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${MAX_AGE}s`)
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function sessionCookieHeader(token: string): string {
  return cookieHeader(COOKIE_NAME, token, MAX_AGE);
}

export function clearSessionCookieHeader(): string {
  return cookieHeader(COOKIE_NAME, '', 0);
}

export function getSessionCookie(request: Request): string | null {
  return getCookie(request, COOKIE_NAME);
}

export function passkeyChallengeCookieHeader(challenge: string): string {
  return cookieHeader(PASSKEY_CHALLENGE_COOKIE, challenge, PASSKEY_COOKIE_MAX_AGE);
}

export function clearPasskeyChallengeCookieHeader(): string {
  return cookieHeader(PASSKEY_CHALLENGE_COOKIE, '', 0);
}

export function getPasskeyChallengeCookie(request: Request): string | null {
  return getCookie(request, PASSKEY_CHALLENGE_COOKIE);
}

export function passkeyUserCookieHeader(userId: string): string {
  return cookieHeader(PASSKEY_USER_COOKIE, userId, PASSKEY_COOKIE_MAX_AGE);
}

export function clearPasskeyUserCookieHeader(): string {
  return cookieHeader(PASSKEY_USER_COOKIE, '', 0);
}

export function getPasskeyUserCookie(request: Request): string | null {
  return getCookie(request, PASSKEY_USER_COOKIE);
}
