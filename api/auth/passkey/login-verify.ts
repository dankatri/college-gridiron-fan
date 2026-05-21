import { and, eq } from 'drizzle-orm';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { db } from '../../../src/server/db';
import { users, webauthnCredentials } from '../../../src/server/schema';
import {
  clearPasskeyChallengeCookieHeader,
  clearPasskeyUserCookieHeader,
  createSessionToken,
  getPasskeyChallengeCookie,
  getPasskeyUserCookie,
  sessionCookieHeader,
} from '../../../src/server/auth-utils';
import { getWebAuthnOrigin, getWebAuthnRPID } from '../../../src/server/webauthn-utils';

export const config = {
  runtime: 'nodejs22.x',
};

type LoginVerifyBody = {
  response?: AuthenticationResponseJSON;
};

function jsonResponse(body: unknown, status = 200, setCookies: string[] = []): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const cookie of setCookies) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: LoginVerifyBody;
  try {
    body = (await request.json()) as LoginVerifyBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const authenticationResponse = body.response;
  if (!authenticationResponse) {
    return jsonResponse({ error: 'Missing passkey authentication response' }, 400);
  }

  try {
    const challenge = getPasskeyChallengeCookie(request);
    const userId = getPasskeyUserCookie(request);
    if (!challenge || !userId) {
      return jsonResponse({ error: 'Passkey challenge expired. Try again.' }, 400);
    }

    const rows = await db
      .select({
        credentialId: webauthnCredentials.credentialId,
        publicKey: webauthnCredentials.publicKey,
        counter: webauthnCredentials.counter,
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(webauthnCredentials)
      .innerJoin(users, eq(users.id, webauthnCredentials.userId))
      .where(
        and(
          eq(webauthnCredentials.credentialId, authenticationResponse.id),
          eq(webauthnCredentials.userId, userId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return jsonResponse({ error: 'Passkey credential not found' }, 404);

    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: challenge,
      expectedOrigin: getWebAuthnOrigin(request),
      expectedRPID: getWebAuthnRPID(request),
      credential: {
        id: row.credentialId,
        publicKey: new Uint8Array(Buffer.from(row.publicKey, 'base64')),
        counter: row.counter,
      },
    });

    if (!verification.verified) {
      return jsonResponse({ error: 'Passkey verification failed' }, 401);
    }

    await db
      .update(webauthnCredentials)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(webauthnCredentials.credentialId, row.credentialId));

    const token = await createSessionToken(row.userId);
    return jsonResponse(
      {
        user: {
          id: row.userId,
          email: row.email,
          displayName: row.displayName,
        },
      },
      200,
      [sessionCookieHeader(token), clearPasskeyChallengeCookieHeader(), clearPasskeyUserCookieHeader()],
    );
  } catch (error) {
    console.error('[api/auth/passkey/login-verify] Failed to verify passkey login', { error });
    return jsonResponse({ error: 'Failed to verify passkey login' }, 500);
  }
}
