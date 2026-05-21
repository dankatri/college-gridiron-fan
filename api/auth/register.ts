import bcrypt from 'bcryptjs';
import { db } from '../../src/server/db';
import { users } from '../../src/server/schema';
import { createSessionToken, sessionCookieHeader } from '../../src/server/auth-utils';

export const config = {
  runtime: 'nodejs22.x',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RegisterBody = {
  email?: string;
  password?: string;
  displayName?: string;
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

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';
  const displayName = body.displayName?.trim() ?? '';

  if (!EMAIL_REGEX.test(email)) {
    return jsonResponse({ error: 'Please provide a valid email address' }, 400);
  }
  if (displayName.length < 2) {
    return jsonResponse({ error: 'Display name must be at least 2 characters' }, 400);
  }
  if (password.length < 8) {
    return jsonResponse({ error: 'Password must be at least 8 characters' }, 400);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await db
      .insert(users)
      .values({
        email,
        displayName,
        passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      });

    const user = inserted[0];
    if (!user) {
      return jsonResponse({ error: 'Failed to create user' }, 500);
    }

    const token = await createSessionToken(user.id);
    return jsonResponse(
      {
        user,
      },
      200,
      sessionCookieHeader(token),
    );
  } catch (error) {
    console.error('[api/auth/register] Failed to register user', { error, email });
    const message = error instanceof Error ? error.message : '';
    if (message.includes('unique') || message.includes('users_email_unique')) {
      return jsonResponse({ error: 'An account with this email already exists' }, 409);
    }
    return jsonResponse({ error: 'Failed to register user' }, 500);
  }
}
