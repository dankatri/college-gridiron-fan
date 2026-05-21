/**
 * Password hashing using Web Crypto API (Edge-compatible).
 * Uses PBKDF2 with SHA-256, 100k iterations, 32-byte salt.
 */

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt);
  const hash = await crypto.subtle.exportKey('raw', key);
  const saltHex = Buffer.from(salt).toString('hex');
  const hashHex = Buffer.from(hash).toString('hex');
  return `pbkdf2:${ITERATIONS}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts[0] !== 'pbkdf2' || parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = Uint8Array.from(Buffer.from(parts[2], 'hex'));
  const expectedHash = parts[3];
  const key = await deriveKey(password, salt, iterations);
  const hash = await crypto.subtle.exportKey('raw', key);
  const hashHex = Buffer.from(hash).toString('hex');
  return hashHex === expectedHash;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = ITERATIONS,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH * 8 },
    true,
    ['encrypt'],
  );
}
