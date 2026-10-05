import { eq } from 'drizzle-orm';
import { db } from '../../src/server/db';
import { users } from '../../src/server/schema';
import { getSessionCookie, verifySessionToken } from '../../src/server/auth-utils';
import { errorResponse, jsonResponse, HttpError } from '../../src/server/http';

export const config = {
  runtime: 'edge',
};

/**
 * The signed-in view of email preferences.
 *
 * Separate from the unsubscribe link because this one is authenticated and can
 * turn reminders back on, which a link from an old email must never be able to
 * do on someone else's behalf.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'PATCH') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const token = getSessionCookie(request);
    const userId = token ? await verifySessionToken(token) : null;
    if (!userId) throw new HttpError(401, 'Not authenticated');

    let body: { lineupReminders?: unknown };
    try {
      body = (await request.json()) as { lineupReminders?: unknown };
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }
    if (typeof body.lineupReminders !== 'boolean') {
      throw new HttpError(400, 'lineupReminders must be true or false');
    }

    const updated = await db
      .update(users)
      .set({ lineupRemindersEnabled: body.lineupReminders ? 1 : 0 })
      .where(eq(users.id, userId))
      .returning({ enabled: users.lineupRemindersEnabled });

    if (!updated.length) throw new HttpError(401, 'Not authenticated');

    return jsonResponse({ lineupReminders: updated[0].enabled === 1 });
  } catch (error) {
    return errorResponse(error);
  }
}
