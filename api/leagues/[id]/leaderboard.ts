import { and, eq, like } from 'drizzle-orm';
import { db } from '../../../src/server/db';
import { dataCache, leagueMembers, lineups, users } from '../../../src/server/schema';
import { requireUser } from '../../../src/server/auth-utils';
import { SEASON_YEAR } from '../../../src/lib/season-config';
import { hasWeekStarted } from '../../../src/lib/week-lock';
import type { LineupSlotInput } from '../../../src/server/lineup-utils';
import type { PlayerStats } from '../../../src/lib/types';

type LiveCachePayload = { week?: number; stats?: PlayerStats[] };

/**
 * Fantasy points actually scored, keyed by week then player id.
 *
 * Live stats are cached one row per week by the refresh job, which is the only
 * record of what players really scored — lineups.actual_points is never
 * written, so scoring from the box scores is what keeps a leaderboard honest.
 */
async function loadWeeklyScores(): Promise<Map<number, Map<string, number>>> {
  const rows = await db
    .select({ data: dataCache.data })
    .from(dataCache)
    .where(like(dataCache.key, `live-stats-${SEASON_YEAR}-week-%`));

  const byWeek = new Map<number, Map<string, number>>();

  for (const row of rows) {
    const payload = row.data as LiveCachePayload;
    if (typeof payload?.week !== 'number') continue;

    const points = new Map<string, number>();
    for (const stat of payload.stats ?? []) {
      points.set(stat.playerId, stat.fantasyPoints ?? 0);
    }
    byWeek.set(payload.week, points);
  }

  return byWeek;
}

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
        slots: lineups.slots,
        projectedPoints: lineups.projectedPoints,
      })
      .from(lineups)
      .where(and(eq(lineups.leagueId, leagueId), eq(lineups.season, SEASON_YEAR)));

    const weeklyScores = await loadWeeklyScores();

    type Totals = {
      totalPoints: number;
      weeklyPoints: Record<number, number>;
      projectedPoints: Record<number, number>;
      weeksScored: number;
    };

    const totals = new Map<string, Totals>();
    const scoredWeeks = new Set<number>();

    for (const row of lineupRows) {
      const existing = totals.get(row.userId) ?? {
        totalPoints: 0,
        weeklyPoints: {},
        projectedPoints: {},
        weeksScored: 0,
      };

      existing.projectedPoints[row.week] = Number.parseFloat(row.projectedPoints ?? '0') || 0;

      // A week only contributes to the standings once its games have started.
      // Before that everyone is on zero, rather than on their projection.
      if (hasWeekStarted(row.week)) {
        const weekScores = weeklyScores.get(row.week);
        const points = ((row.slots ?? []) as LineupSlotInput[]).reduce((sum, slot) => {
          if (!slot.playerId) return sum;
          return sum + (weekScores?.get(slot.playerId) ?? 0);
        }, 0);

        existing.totalPoints += points;
        existing.weeklyPoints[row.week] = Number(points.toFixed(2));
        existing.weeksScored += 1;
        scoredWeeks.add(row.week);
      }

      totals.set(row.userId, existing);
    }

    const leaderboard = members
      .map((member) => {
        const score = totals.get(member.userId);
        return {
          userId: member.userId,
          username: member.username,
          avatarUrl: member.avatarUrl,
          totalPoints: Number((score?.totalPoints ?? 0).toFixed(2)),
          weeklyPoints: score?.weeklyPoints ?? {},
          projectedPoints: score?.projectedPoints ?? {},
          weeksScored: score?.weeksScored ?? 0,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints || a.username.localeCompare(b.username))
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    return jsonResponse({
      leaderboard,
      scoredWeeks: Array.from(scoredWeeks).sort((a, b) => a - b),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
    const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
}
