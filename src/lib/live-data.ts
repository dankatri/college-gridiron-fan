import type { GameStatus, PlayerStats } from './types';

export interface LiveDataPayload {
  week: number | null;
  seasonType?: string;
  updatedAt: string | null;
  stats: PlayerStats[];
  games: GameStatus[];
}

/** Dates are ISO strings after JSON transport. */
function reviveDate(value: unknown): Date {
  const parsed = value ? new Date(value as string) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Loads the live box scores and scoreboard cached by scripts/refresh-live.ts.
 * Returns null when no live data is available (out of season, or before the
 * first refresh has run), so callers can fall back to simulated stats.
 */
export async function getLiveData(week: number): Promise<LiveDataPayload | null> {
  try {
    const response = await fetch(`/api/live?week=${week}`);
    if (!response.ok) throw new Error(`/api/live failed: ${response.status}`);

    const payload = await response.json();
    if (!payload || typeof payload.week !== 'number') return null;

    return {
      week: payload.week,
      seasonType: payload.seasonType,
      updatedAt: payload.updatedAt ?? null,
      stats: (payload.stats ?? []).map((stat: PlayerStats) => ({
        ...stat,
        lastUpdated: reviveDate(stat.lastUpdated),
      })),
      games: (payload.games ?? []).map((game: GameStatus) => ({
        ...game,
        lastUpdated: reviveDate(game.lastUpdated),
      })),
    };
  } catch (error) {
    console.warn('Live data unavailable:', error);
    return null;
  }
}
