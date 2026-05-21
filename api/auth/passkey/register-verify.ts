import { eq } from 'drizzle-orm';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { db } from '../../../src/server/db';
import { users, webauthnCredentials } from '../../../src/server/schema';
import {
  clearPasskeyChallengeCookieHeader,
  getPasskeyChallengeCookie,
  getSessionCookie,
  verifySessionToken,
} from '../../../src/server/auth-utils';
import { getWebAuthnOrigin, getWebAuthnRPID } from '../../../src/server/webauthn-utils';

export const config = {
  runtime: 'nodejs22.x',
};

type RegisterVerifyBody = {
  response?: RegistrationResponseJSON;
};

function jsonResponse(body: unknown, status = 200, setCookie?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (setCookie) headers.set('Set-Cookie', setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: RegisterVerifyBody;
  try {
    body = (await request.json()) as RegisterVerifyBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const registrationResponse = body.response;
  if (!registrationResponse) {
    return jsonResponse({ error: 'Missing passkey registration response' }, 400);
  }

  try {
    const token = getSessionCookie(request);
    if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userId = await verifySessionToken(token);
    if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const user = userRows[0];
    if (!user) return jsonResponse({ error: 'User not found' }, 404);

    const challenge = getPasskeyChallengeCookie(request);
    if (!challenge) return jsonResponse({ error: 'Passkey challenge expired. Try again.' }, 400);

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: challenge,
      expectedOrigin: getWebAuthnOrigin(request),
      expectedRPID: getWebAuthnRPID(request),
    });

    if (!verification.verified || !verification.registrationInfo) {
      return jsonResponse({ error: 'Passkey registration verification failed' }, 400);
    }

    const credential = verification.registrationInfo.credential;
    await db
      .insert(webauthnCredentials)
      .values({
        credentialId: credential.id,
        userId: user.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
      })
      .onConflictDoUpdate({
        target: webauthnCredentials.credentialId,
        set: {
          userId: user.id,
          publicKey: Buffer.from(credential.publicKey).toString('base64'),
          counter: credential.counter,
        },
      });

    return jsonResponse({ ok: true }, 200, clearPasskeyChallengeCookieHeader());
  } catch (error) {
    console.error('[api/auth/passkey/register-verify] Failed to verify passkey registration', { error });
    return jsonResponse({ error: 'Failed to verify passkey registration' }, 500);
  }
}
