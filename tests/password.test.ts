import assert from 'node:assert/strict';
import { Buffer as NodeBuffer } from 'node:buffer';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from '../src/server/password';
import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes } from '../src/server/encoding';
import { generateResetToken, hashResetToken } from '../src/server/password-reset';

async function withoutNodeBuffer<T>(action: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Buffer');
  assert.ok(descriptor);
  Reflect.deleteProperty(globalThis, 'Buffer');
  try {
    return await action();
  } finally {
    Object.defineProperty(globalThis, 'Buffer', descriptor);
  }
}

test('existing PBKDF2 hashes verify without a global Node Buffer', async () => {
  const password = 'Synthetic password fixture';
  const saltHex = '000102030405060708090a0b0c0d0e0f';
  const expected = pbkdf2Sync(password, NodeBuffer.from(saltHex, 'hex'), 100_000, 32, 'sha256').toString('hex');
  const stored = `pbkdf2:100000:${saltHex}:${expected}`;
  await withoutNodeBuffer(async () => {
    assert.equal(await verifyPassword(password, stored), true);
    assert.equal(await verifyPassword('Incorrect fixture', stored), false);
  });
});

test('new password hashes retain the existing wire format without Node globals', async () => {
  const password = 'Another synthetic password fixture';
  const stored = await withoutNodeBuffer(async () => {
    const value = await hashPassword(password);
    assert.equal(await verifyPassword(password, value), true);
    return value;
  });
  assert.match(stored, /^pbkdf2:100000:[0-9a-f]{32}:[0-9a-f]{64}$/);
  const [, iterations, saltHex, digest] = stored.split(':');
  assert.equal(digest, pbkdf2Sync(password, NodeBuffer.from(saltHex, 'hex'), Number(iterations), 32, 'sha256').toString('hex'));
});

test('passkey byte encodings preserve stored base64 and hex values without Node globals', async () => {
  const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
  const base64 = NodeBuffer.from(bytes).toString('base64');
  const hex = NodeBuffer.from(bytes).toString('hex');
  await withoutNodeBuffer(async () => {
    assert.equal(bytesToBase64(bytes), base64);
    assert.equal(bytesToHex(bytes), hex);
    assert.deepEqual(base64ToBytes(base64), bytes);
    assert.deepEqual(hexToBytes(hex.toUpperCase()), bytes);
    assert.equal(bytesToBase64(new Uint8Array()), '');
    assert.throws(() => hexToBytes('a'), /Invalid hexadecimal/);
    assert.throws(() => hexToBytes('zz'), /Invalid hexadecimal/);
  });
});

test('password-reset token format and digests remain unchanged without Node globals', async () => {
  const expected = createHash('sha256').update('Synthetic reset fixture').digest('hex');
  await withoutNodeBuffer(async () => {
    assert.equal(await hashResetToken('Synthetic reset fixture'), expected);
    const token = generateResetToken();
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(NodeBuffer.from(token, 'base64url').byteLength, 32);
  });
});
