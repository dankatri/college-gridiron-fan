import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../src/server/db';
import { users } from '../../src/server/schema';
import { createSessionToken, sessionCookieHeader } from '../../src/server/auth-utils';

export const config = {
  runtime: 'nodejs22.x',
};

type LoginBody = {
  email?: string;
  password?: string;
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

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';
  if (!email || !password) {
    return jsonResponse({ error: 'Email and password are required' }, 400);
  }

  try {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return jsonResponse({ error: 'Invalid credentials' }, 401);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return jsonResponse({ error: 'Invalid credentials' }, 401);
    }

    const token = await createSessionToken(user.id);
    return jsonResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
      },
      200,
      sessionCookieHeader(token),
    );
  } catch (error) {
    console.error('[api/auth/login] Failed to sign in', { error, email });
    return jsonResponse({ error: 'Failed to sign in' }, 500);
  }
}
