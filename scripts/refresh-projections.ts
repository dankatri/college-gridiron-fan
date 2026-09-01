/**
 * Pulls the completed-season player stats used for projections.
 *
 * These never change once the season is over, so this runs rarely — the daily
 * roster refresh reads the compact result out of `data_cache` instead of
 * re-downloading ~25MB of stat rows.
 *
 * Usage: npm run refresh:projections  (add FORCE=1 to re-fetch)
 */

import { PROJECTION_YEAR } from '../src/lib/season-config';
import { seasonStatsCacheKey } from '../src/server/cache-keys';
import { STAT_CATEGORIES, countGamesPlayed, pivotSeasonStats } from '../src/server/cfbd-transform';
import type { StatLine } from '../src/server/cfbd-transform';
import { readCache, writeCache } from './lib/cache';
import { logStep, requireEnv, runScript } from './lib/runner';

export type ProjectionCache = {
  year: number;
  gamesPlayed: Record<string, number>;
  statsByPlayer: Record<string, StatLine>;
};

const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR']);

await runScript('refresh-projections', async () => {
  requireEnv('CFBD_API_KEY');
  requireEnv('DATABASE_URL');

  const year = PROJECTION_YEAR;
  const cacheKey = seasonStatsCacheKey(year);

  if (!process.env.FORCE) {
    const existing = await readCache<ProjectionCache>(cacheKey);
    if (existing && Object.keys(existing.statsByPlayer ?? {}).length > 0) {
      logStep('projection stats already cached, skipping', {
        year,
        players: Object.keys(existing.statsByPlayer).length,
      });
      return;
    }
  }

  const { getAllDivisionGames, getSeasonStats } = await import('../src/server/cfbd');

  logStep('fetching season stats by category', { year, categories: STAT_CATEGORIES });
  const statChunks = await Promise.all(
    STAT_CATEGORIES.map(async (category) => {
      const rows = await getSeasonStats(year, category);
      logStep('category fetched', { category, rows: rows.length });
      return rows;
    }),
  );

  // Keep only skill-position players; the rest can never appear in a lineup.
  const rows = statChunks.flat().filter((row) => SKILL_POSITIONS.has((row.position ?? '').toUpperCase()));
  const statsByPlayer = pivotSeasonStats(rows);

  // All divisions: teams promoted to FBS since PROJECTION_YEAR played their
  // previous season as FCS, and their games must still count toward the divisor.
  logStep('fetching games for per-game divisor', { year });
  const games = await getAllDivisionGames(year, 'both');
  const gamesPlayed = countGamesPlayed(games);

  const payload: ProjectionCache = {
    year,
    gamesPlayed: Object.fromEntries(gamesPlayed),
    statsByPlayer: Object.fromEntries(statsByPlayer),
  };

  await writeCache(cacheKey, payload);

  logStep('projection stats cached', {
    year,
    players: statsByPlayer.size,
    teams: gamesPlayed.size,
    approxBytes: JSON.stringify(payload).length,
  });
});
