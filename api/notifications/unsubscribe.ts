import { eq } from 'drizzle-orm';
import { db } from '../../src/server/db';
import { users } from '../../src/server/schema';

export const config = {
  runtime: 'edge',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(title: string, message: string, status: number): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${title}</title></head>
      <body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:34rem;margin:4rem auto;padding:0 1rem">
      <h1 style="font-size:1.4rem">${title}</h1><p>${message}</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } },
  );
}

const UNKNOWN = 'This unsubscribe link is not valid. You can turn reminders off with the “Reminders” button at the top of the app instead.';

/**
 * Turns off lineup reminders from an email link.
 *
 * Deliberately unauthenticated: the recipient is identified by the opaque
 * per-user token in the link, because an unsubscribe that demands a login is
 * one most people will never complete. The token grants nothing else, and the
 * request is idempotent. POST is here for RFC 8058 one-click unsubscribe,
 * which mail clients send on the user's behalf.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return page('Method not allowed', 'Use the link from your reminder email.', 405);
  }

  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!UUID.test(token)) return page('Link not recognised', UNKNOWN, 400);

  try {
    const updated = await db
      .update(users)
      .set({ lineupRemindersEnabled: 0 })
      .where(eq(users.notifyToken, token))
      .returning({ id: users.id });

    if (!updated.length) return page('Link not recognised', UNKNOWN, 404);

    return page(
      'Reminders turned off',
      'You will not get any more lineup reminders. Your leagues and lineups are untouched, and you can turn them back on any time with the “Reminders” button at the top of the app.',
      200,
    );
  } catch (error) {
    console.error('[api/notifications/unsubscribe] Error:', error);
    return page('Something went wrong', 'We could not update your preferences. Please try the link again shortly.', 500);
  }
}
