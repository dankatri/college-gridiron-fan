import { and, eq, like } from 'drizzle-orm';
import { db } from '../../../src/server/db';
import { dataCache, leagueMembers, lineups, users } from '../../../src/server/schema';
import { requireUser } from '../../../src/server/auth-utils';
import { SEASON_YEAR } from '../../../src/lib/season-config';
import { hasStartedGames } from '../../../src/server/lineup-utils';
import { scoreLineups } from '../../../src/server/leaderboard-scoring';
import type { PlayerStats } from '../../../src/lib/types';
import { cacheQueryMode, projectWeeklyScores } from '../../../src/server/cache-projections';
import { jsonResponse } from '../../../src/server/http';
import { countWinningWeeks } from '../../../src/lib/leaderboard-wins';

type LiveCachePayload = {
  week?: number;
  stats?: PlayerStats[] | null;
  games?: Array<{ status: string }>;
  statsAvailable?: boolean;
  hasStartedGames?: boolean;
};
type WeeklyScores = {
  byWeek: Map<number, Map<string, number>>;
  availableWeeks: Set<number>;
  startedWeeks: Set<number>;
};

/**
 * Fantasy points actually scored, keyed by week then player id.
 *
 * Live stats are cached one row per week by the refresh job, which is the only
 * record of what players really scored — lineups.actual_points is never
 * written, so scoring from the box scores is what keeps a leaderboard honest.
 */
async function loadWeeklyScores(requested: Record<number, string[]>): Promise<WeeklyScores> {
  const rows = cacheQueryMode('LEADERBOARD_QUERY_MODE') === 'projected'
    ? (await db.execute<{ data: LiveCachePayload }>(projectWeeklyScores(SEASON_YEAR, requested))).rows
    : await db
    .select({ data: dataCache.data })
    .from(dataCache)
    .where(like(dataCache.key, `live-stats-${SEASON_YEAR}-week-%`))
    .orderBy(dataCache.key);

  const byWeek = new Map<number, Map<string, number>>();
  const availableWeeks = new Set<number>();
  const startedWeeks = new Set<number>();

  for (const row of rows) {
    const payload = row.data as LiveCachePayload;
    if (typeof payload?.week !== 'number') continue;

    const points = new Map<string, number>();
    for (const stat of payload.stats ?? []) {
      points.set(stat.playerId, stat.fantasyPoints ?? 0);
    }
    byWeek.set(payload.week, points);
    if (payload.statsAvailable ?? Array.isArray(payload.stats)) availableWeeks.add(payload.week);
    else availableWeeks.delete(payload.week);
    if (hasStartedGames(payload)) startedWeeks.add(payload.week);
    else startedWeeks.delete(payload.week);
  }

  return { byWeek, availableWeeks, startedWeeks };
}

export const config = {
  runtime: 'edge',
};

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

    const [members, lineupRows] = await Promise.all([db
      .select({
        userId: leagueMembers.userId,
        username: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(users.id, leagueMembers.userId))
      .where(eq(leagueMembers.leagueId, leagueId)),
    db
      .select({
        userId: lineups.userId,
        week: lineups.week,
        slots: lineups.slots,
        projectedPoints: lineups.projectedPoints,
      })
      .from(lineups)
      .where(and(eq(lineups.leagueId, leagueId), eq(lineups.season, SEASON_YEAR))),
    ]);

    const requested: Record<number, string[]> = {};
    for (const row of lineupRows) {
      requested[row.week] = [...new Set([
        ...(requested[row.week] ?? []),
        ...row.slots.flatMap(slot => slot.playerId ? [slot.playerId] : []),
      ])];
    }
    const { byWeek: weeklyScores, availableWeeks, startedWeeks } = lineupRows.length
      ? await loadWeeklyScores(requested)
      : { byWeek: new Map<number, Map<string, number>>(), availableWeeks: new Set<number>(), startedWeeks: new Set<number>() };
    const now = new Date();
    const { totals, scoredWeeks } = scoreLineups(lineupRows, weeklyScores, startedWeeks, now);

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
    const winningWeeks = countWinningWeeks(leaderboard, availableWeeks, now);

    return jsonResponse({
      leaderboard: leaderboard.map(entry => ({
        ...entry,
        winningWeeks: winningWeeks.get(entry.userId) ?? 0,
      })),
      scoredWeeks: Array.from(scoredWeeks).sort((a, b) => a - b),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
    const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
}
