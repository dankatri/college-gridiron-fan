import { eq } from 'drizzle-orm';
import { db } from './../src/server/db';
import { users } from './../src/server/schema';
import { getSessionCookie, verifySessionToken } from './../src/server/auth-utils';

export const config = {
  runtime: 'edge',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const token = getSessionCookie(request);
    if (!token) {
      return jsonResponse({ user: null });
    }

    const userId = await verifySessionToken(token);
    if (!userId) {
      return jsonResponse({ user: null });
    }

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = rows[0] ?? null;
    return jsonResponse({ user });
  } catch (error) {
    console.error('[api/me] Failed to load current user', { error });
    return jsonResponse({ user: null });
  }
}
