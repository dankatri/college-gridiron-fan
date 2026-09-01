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

const CACHE_DURATION = 1000 * 60 * 2; // Live scoring refreshes every 10 minutes
const weekCache = new Map<number, { payload: LiveDataPayload | null; fetchedAt: number }>();
const weekInFlight = new Map<number, Promise<LiveDataPayload | null>>();

/**
 * Same as getLiveData, but shared and briefly cached so the three position
 * tables and the lineup cards do not each hit /api/live for the same week.
 */
export async function getCachedLiveData(week: number): Promise<LiveDataPayload | null> {
  const cached = weekCache.get(week);
  if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION) {
    return cached.payload;
  }

  const existing = weekInFlight.get(week);
  if (existing) return existing;

  const request = getLiveData(week)
    .then((payload) => {
      weekCache.set(week, { payload, fetchedAt: Date.now() });
      return payload;
    })
    .finally(() => {
      weekInFlight.delete(week);
    });

  weekInFlight.set(week, request);
  return request;
}

/** Actual fantasy stats for a single week, keyed by player id. */
export async function getWeekPlayerStats(week: number): Promise<Map<string, PlayerStats>> {
  const payload = await getCachedLiveData(week);
  return new Map((payload?.stats ?? []).map((stat) => [stat.playerId, stat]));
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
