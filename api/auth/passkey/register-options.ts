import { eq } from 'drizzle-orm';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { db } from '../../../src/server/db';
import { users, webauthnCredentials } from '../../../src/server/schema';
import {
  getSessionCookie,
  passkeyChallengeCookieHeader,
  verifySessionToken,
} from '../../../src/server/auth-utils';
import { getWebAuthnOrigin, getWebAuthnRPID, WEBAUTHN_RP_NAME } from '../../../src/server/webauthn-utils';

export const config = {
  runtime: 'edge',
};

function jsonResponse(body: unknown, status = 200, setCookie?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (setCookie) headers.set('Set-Cookie', setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const token = getSessionCookie(request);
    if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userId = await verifySessionToken(token);
    if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const user = userRows[0];
    if (!user) return jsonResponse({ error: 'User not found' }, 404);

    const credentials = await db
      .select({
        credentialId: webauthnCredentials.credentialId,
      })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, user.id));

    const options = await generateRegistrationOptions({
      rpName: WEBAUTHN_RP_NAME,
      rpID: getWebAuthnRPID(request),
      userName: user.email,
      userDisplayName: user.displayName,
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestationType: 'none',
    });

    return jsonResponse(
      {
        options,
        origin: getWebAuthnOrigin(request),
      },
      200,
      passkeyChallengeCookieHeader(options.challenge),
    );
  } catch (error) {
    console.error('[api/auth/passkey/register-options] Failed to generate options', { error });
    return jsonResponse({ error: 'Failed to generate passkey options' }, 500);
  }
}
