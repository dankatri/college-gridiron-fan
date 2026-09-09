import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../src/server/db';
import { leagueMembers, leagues, users } from '../../src/server/schema';
import { requireUser } from '../../src/server/auth-utils';

export const config = {
  runtime: 'edge',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}

function getLeagueId(request: Request): string | null {
  const leagueId = new URL(request.url).pathname.split('/')[3];
  return leagueId || null;
}

export default async function handler(request: Request): Promise<Response> {
  const leagueId = getLeagueId(request);
  if (!leagueId) {
    return jsonResponse({ error: 'League ID is required' }, 400);
  }

  if (request.method === 'GET') {
    try {
      const user = await requireUser(request);
      const membership = await db
        .select({ userId: leagueMembers.userId })
        .from(leagueMembers)
        .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, user.id)))
        .limit(1);

      if (!membership[0]) {
        return jsonResponse({ error: 'You are not a member of this league' }, 403);
      }

      const leagueRows = await db
        .select({
          id: leagues.id,
          name: leagues.name,
          description: leagues.description,
          ownerId: leagues.ownerId,
          season: leagues.season,
          joinCode: leagues.joinCode,
          maxMembers: leagues.maxMembers,
          isPublic: leagues.isPublic,
          allowLateJoins: leagues.allowLateJoins,
          createdAt: leagues.createdAt,
          ownerName: users.displayName,
          ownerAvatarUrl: users.avatarUrl,
        })
        .from(leagues)
        .innerJoin(users, eq(users.id, leagues.ownerId))
        .where(eq(leagues.id, leagueId))
        .limit(1);

      const league = leagueRows[0];
      if (!league) {
        return jsonResponse({ error: 'League not found' }, 404);
      }

      const members = await db
        .select({
          userId: leagueMembers.userId,
          role: leagueMembers.role,
          joinedAt: leagueMembers.joinedAt,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(leagueMembers)
        .innerJoin(users, eq(users.id, leagueMembers.userId))
        .where(eq(leagueMembers.leagueId, leagueId));

      const memberCountRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(leagueMembers)
        .where(eq(leagueMembers.leagueId, leagueId));

      return jsonResponse({
        league: {
          ...league,
          members,
          memberCount: Number(memberCountRows[0]?.count ?? members.length),
          owner: {
            id: league.ownerId,
            displayName: league.ownerName,
            avatarUrl: league.ownerAvatarUrl,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch league';
      const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
      return jsonResponse({ error: message }, status);
    }
  }

  if (request.method === 'DELETE') {
    try {
      const user = await requireUser(request);
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

      if (league.ownerId !== user.id) {
        return jsonResponse({ error: 'Only the league owner can delete this league' }, 403);
      }

      await db.delete(leagues).where(eq(leagues.id, leagueId));
      return jsonResponse({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete league';
      const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
      return jsonResponse({ error: message }, status);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
