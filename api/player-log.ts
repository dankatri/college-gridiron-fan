import { eq, like } from 'drizzle-orm';
import { db } from '../src/server/db';
import { dataCache } from '../src/server/schema';
import { SEASON_YEAR } from '../src/lib/season-config';
import type { PlayerStats, TeamSchedule } from '../src/lib/types';
import { playersCacheKey, schedulesCacheKey } from '../src/server/cache-keys';

export const config = {
  runtime: 'edge',
};

type LiveCachePayload = {
  week?: number;
  stats?: PlayerStats[];
};

const EMPTY = { playerId: null, games: [], totals: null, updatedAt: null };

function sumTotals(games: PlayerStats[]) {
  const totals = {
    games: games.length,
    fantasyPoints: 0,
    passingYards: 0,
    passingTDs: 0,
    completions: 0,
    attempts: 0,
    interceptions: 0,
    rushingYards: 0,
    rushingTDs: 0,
    receivingYards: 0,
    receptions: 0,
    receivingTDs: 0,
    kickReturnYards: 0,
    puntReturnYards: 0,
  };

  for (const game of games) {
    totals.fantasyPoints += game.fantasyPoints ?? 0;
    totals.passingYards += game.passingYards ?? 0;
    totals.passingTDs += game.passingTDs ?? 0;
    totals.completions += game.completions ?? 0;
    totals.attempts += game.attempts ?? 0;
    totals.interceptions += game.interceptions ?? 0;
    totals.rushingYards += game.rushingYards ?? 0;
    totals.rushingTDs += game.rushingTDs ?? 0;
    totals.receivingYards += game.receivingYards ?? 0;
    totals.receptions += game.receptions ?? 0;
    totals.receivingTDs += game.receivingTDs ?? 0;
    totals.kickReturnYards += game.kickReturnYards ?? 0;
    totals.puntReturnYards += game.puntReturnYards ?? 0;
  }

  totals.fantasyPoints = Math.round(totals.fantasyPoints * 10) / 10;
  return totals;
}

/**
 * A player's week-by-week fantasy line for the season.
 *
 * Live stats are cached one row per week, so this stitches those rows together
 * rather than adding another upstream call per player.
 */
export default async function handler(request: Request): Promise<Response> {
  try {
    const playerId = new URL(request.url).searchParams.get('playerId');
    if (!playerId) {
      return new Response(JSON.stringify({ ...EMPTY, error: 'playerId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const weekRows = await db
      .select({ key: dataCache.key, data: dataCache.data, updatedAt: dataCache.updatedAt })
      .from(dataCache)
      .where(like(dataCache.key, `live-stats-${SEASON_YEAR}-week-%`));

    const scheduleRows = await db
      .select({ data: dataCache.data })
      .from(dataCache)
      .where(eq(dataCache.key, schedulesCacheKey(SEASON_YEAR)))
      .limit(1);

    const schedules = (scheduleRows[0]?.data as TeamSchedule[] | undefined) ?? [];

    const games: Array<PlayerStats & { opponent?: string; isHomeGame?: boolean; teamPoints?: number; opponentPoints?: number }> = [];
    let updatedAt: Date | null = null;
    let team: string | undefined;

    for (const row of weekRows) {
      const payload = row.data as LiveCachePayload;
      const line = payload.stats?.find((stat) => stat.playerId === playerId);
      if (!line) continue;

      if (!updatedAt || (row.updatedAt && row.updatedAt > updatedAt)) {
        updatedAt = row.updatedAt ?? null;
      }
      games.push(line);
    }

    // Attach opponent and score context from the schedule cache.
    if (games.length > 0) {
      const playersRow = await db
        .select({ data: dataCache.data })
        .from(dataCache)
        .where(eq(dataCache.key, playersCacheKey(SEASON_YEAR)))
        .limit(1);
      const pool = (playersRow[0]?.data as Array<{ id: string; team: string }> | undefined) ?? [];
      team = pool.find((player) => player.id === playerId)?.team;

      const schedule = team ? schedules.find((entry) => entry.teamName === team) : undefined;
      if (schedule) {
        for (const game of games) {
          const weekGame = schedule.weeklyGames.find((entry) => entry.week === game.week && !entry.isByeWeek);
          if (!weekGame) continue;
          game.opponent = weekGame.opponent;
          game.isHomeGame = weekGame.isHomeGame;
          game.teamPoints = weekGame.teamPoints;
          game.opponentPoints = weekGame.opponentPoints;
        }
      }
    }

    games.sort((a, b) => a.week - b.week);

    return new Response(
      JSON.stringify({
        playerId,
        team: team ?? null,
        games,
        totals: games.length > 0 ? sumTotals(games) : null,
        updatedAt,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('[api/player-log] Error:', error);
    return new Response(JSON.stringify({ ...EMPTY, error: 'Failed to load player log' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
