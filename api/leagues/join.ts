import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../src/server/db';
import { leagueMembers, leagues, users } from '../../src/server/schema';
import { requireUser } from '../../src/server/auth-utils';

export const config = {
  runtime: 'edge',
};

type JoinLeagueBody = {
  joinCode?: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: JoinLeagueBody;
  try {
    body = (await request.json()) as JoinLeagueBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const joinCode = body.joinCode?.trim().toUpperCase() ?? '';
  if (!joinCode || joinCode.length !== 8) {
    return jsonResponse({ error: 'Please provide a valid 8-character join code' }, 400);
  }

  try {
    const user = await requireUser(request);
    const foundLeagues = await db
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
      })
      .from(leagues)
      .innerJoin(users, eq(users.id, leagues.ownerId))
      .where(eq(leagues.joinCode, joinCode))
      .limit(1);

    const league = foundLeagues[0];
    if (!league) {
      return jsonResponse({ error: 'League not found' }, 404);
    }

    const existingMembership = await db
      .select({
        userId: leagueMembers.userId,
      })
      .from(leagueMembers)
      .where(and(eq(leagueMembers.leagueId, league.id), eq(leagueMembers.userId, user.id)))
      .limit(1);

    if (existingMembership[0]) {
      return jsonResponse({ error: 'You are already a member of this league' }, 409);
    }

    const memberCountRows = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, league.id));

    const memberCount = Number(memberCountRows[0]?.count ?? 0);
    if (memberCount >= league.maxMembers) {
      return jsonResponse({ error: 'League is full' }, 409);
    }

    await db.insert(leagueMembers).values({
      leagueId: league.id,
      userId: user.id,
      role: 'member',
    });

    return jsonResponse({
      league: {
        ...league,
        memberCount: memberCount + 1,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to join league';
    const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
}
