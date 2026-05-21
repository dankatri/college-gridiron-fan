import { eq } from 'drizzle-orm';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { db } from '../../_lib/db';
import { users, webauthnCredentials } from '../../_lib/schema';
import {
  passkeyChallengeCookieHeader,
  passkeyUserCookieHeader,
} from '../../_lib/auth-utils';
import { getWebAuthnRPID } from '../../_lib/webauthn-utils';

export const config = {
  runtime: 'nodejs',
};

type LoginOptionsBody = {
  email?: string;
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

  let body: LoginOptionsBody;
  try {
    body = (await request.json()) as LoginOptionsBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  if (!email) {
    return jsonResponse({ error: 'Email is required' }, 400);
  }

  try {
    const userRows = await db
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const user = userRows[0];
    if (!user) return jsonResponse({ error: 'No account found for this email' }, 404);

    const credentials = await db
      .select({
        credentialId: webauthnCredentials.credentialId,
      })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, user.id));

    if (credentials.length === 0) {
      return jsonResponse({ error: 'No passkey is registered for this account' }, 400);
    }

    const options = await generateAuthenticationOptions({
      rpID: getWebAuthnRPID(request),
      allowCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
      })),
      userVerification: 'preferred',
    });

    return jsonResponse(
      { options },
      200,
      [passkeyChallengeCookieHeader(options.challenge), passkeyUserCookieHeader(user.id)],
    );
  } catch (error) {
    console.error('[api/auth/passkey/login-options] Failed to generate auth options', { error, email });
    return jsonResponse({ error: 'Failed to start passkey login' }, 500);
  }
}
