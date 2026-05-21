import { and, eq } from 'drizzle-orm';
import { db } from '../../../src/server/db';
import { leagueMembers, leagues } from '../../../src/server/schema';
import { requireUser } from '../../../src/server/auth-utils';

export const config = {
  runtime: 'edge',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getLeagueId(request: Request): string | null {
  const leagueId = new URL(request.url).pathname.split('/')[3];
  return leagueId || null;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const leagueId = getLeagueId(request);
  if (!leagueId) {
    return jsonResponse({ error: 'League ID is required' }, 400);
  }

  const url = new URL(request.url);
  const userIdParam = url.searchParams.get('userId')?.trim();
  if (!userIdParam) {
    return jsonResponse({ error: 'userId query parameter is required' }, 400);
  }

  try {
    const currentUser = await requireUser(request);
    const targetUserId = userIdParam === 'me' ? currentUser.id : userIdParam;

    const leagueRows = await db
      .select({
        id: leagues.id,
        ownerId: leagues.ownerId,
      })
      .from(leagues)
      .where(eq(leagues.id, leagueId))
      .limit(1);

    const league = leagueRows[0];
    if (!league) {
      return jsonResponse({ error: 'League not found' }, 404);
    }

    const targetMembership = await db
      .select({
        userId: leagueMembers.userId,
      })
      .from(leagueMembers)
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, targetUserId)))
      .limit(1);

    if (!targetMembership[0]) {
      return jsonResponse({ error: 'Member not found in this league' }, 404);
    }

    if (targetUserId === currentUser.id) {
      if (league.ownerId === currentUser.id) {
        return jsonResponse({ error: 'League owner cannot leave. Delete league instead.' }, 400);
      }

      await db
        .delete(leagueMembers)
        .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, currentUser.id)));
      return jsonResponse({ success: true });
    }

    if (league.ownerId !== currentUser.id) {
      return jsonResponse({ error: 'Only the league owner can remove members' }, 403);
    }

    if (targetUserId === league.ownerId) {
      return jsonResponse({ error: 'Owner cannot be removed from the league' }, 400);
    }

    await db
      .delete(leagueMembers)
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, targetUserId)));

    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove member';
    const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
}
