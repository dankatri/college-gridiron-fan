import { and, eq } from 'drizzle-orm';
import { db } from '../../../src/server/db';
import { leagueMembers, lineups, users } from '../../../src/server/schema';
import { requireUser } from '../../../src/server/auth-utils';
import { SEASON_YEAR } from '../../../src/lib/season-config';

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
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const leagueId = getLeagueId(request);
  if (!leagueId) {
    return jsonResponse({ error: 'League ID is required' }, 400);
  }

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

    const members = await db
      .select({
        userId: leagueMembers.userId,
        username: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(users.id, leagueMembers.userId))
      .where(eq(leagueMembers.leagueId, leagueId));

    const lineupRows = await db
      .select({
        userId: lineups.userId,
        week: lineups.week,
        projectedPoints: lineups.projectedPoints,
        actualPoints: lineups.actualPoints,
      })
      .from(lineups)
      .where(and(eq(lineups.leagueId, leagueId), eq(lineups.season, SEASON_YEAR)));

    const totals = new Map<string, { totalPoints: number; weeklyPoints: Record<number, number> }>();

    for (const row of lineupRows) {
      const points = Number.parseFloat(row.actualPoints ?? row.projectedPoints ?? '0') || 0;
      const existing = totals.get(row.userId) ?? { totalPoints: 0, weeklyPoints: {} };
      existing.totalPoints += points;
      existing.weeklyPoints[row.week] = points;
      totals.set(row.userId, existing);
    }

    const leaderboard = members
      .map((member) => {
        const score = totals.get(member.userId) ?? { totalPoints: 0, weeklyPoints: {} };
        return {
          userId: member.userId,
          username: member.username,
          avatarUrl: member.avatarUrl,
          totalPoints: Number(score.totalPoints.toFixed(2)),
          weeklyPoints: score.weeklyPoints,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    return jsonResponse({ leaderboard });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
    const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
}
