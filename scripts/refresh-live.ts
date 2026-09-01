/**
 * Refreshes live box scores and the scoreboard for the app's current week.
 *
 * Runs frequently on game days from GitHub Actions. Exits quietly out of season.
 *
 * The app's week windows (WEEK_START_DATES) do not line up with CFBD's own week
 * numbering — CFBD's 2026 week 1 spans two app weeks and its entire postseason
 * is a single week — so this resolves the app week first, then works out which
 * CFBD week(s) overlap it and filters the results back down by kickoff date.
 *
 * Usage: npm run refresh:live  (WEEK=5 to force a specific app week)
 */

import { SEASON_YEAR, weekForDate, weekWindow } from '../src/lib/season-config';
import { TOTAL_WEEKS } from '../src/lib/types';
import type { Player } from '../src/lib/types';
import { liveStatsCacheKey, playersCacheKey } from '../src/server/cache-keys';
import { buildGameStatuses, buildLiveStats, effectiveKickoff } from '../src/server/cfbd-transform';
import type { CfbdCalendarWeek, CfbdGame } from '../src/server/cfbd';
import { readCache, writeCache } from './lib/cache';
import { logStep, requireEnv, runScript } from './lib/runner';

/** The CFBD weeks whose windows overlap the given app week. */
function overlappingCfbdWeeks(
  calendar: CfbdCalendarWeek[],
  window: { start: Date; end: Date | null },
): { week: number; seasonType: string }[] {
  const start = window.start.getTime();
  const end = window.end ? window.end.getTime() : Number.POSITIVE_INFINITY;

  return calendar
    .filter((entry) => {
      const entryStart = new Date(entry.startDate).getTime();
      const entryEnd = new Date(entry.endDate).getTime();
      if (!Number.isFinite(entryStart) || !Number.isFinite(entryEnd)) return false;
      return entryStart < end && entryEnd >= start;
    })
    .map((entry) => ({ week: entry.week, seasonType: entry.seasonType }));
}

await runScript('refresh-live', async () => {
  requireEnv('CFBD_API_KEY');
  requireEnv('DATABASE_URL');

  const { getCalendar, getGamePlayerStats, getGames } = await import('../src/server/cfbd');

  const now = new Date();
  const forcedWeek = process.env.WEEK ? Number(process.env.WEEK) : undefined;
  const appWeek = forcedWeek ?? weekForDate(now);

  if (!appWeek || appWeek < 1 || appWeek > TOTAL_WEEKS) {
    logStep('no app week in progress, nothing to refresh', { season: SEASON_YEAR });
    return;
  }

  const window = weekWindow(appWeek);
  if (!window) {
    logStep('no window configured for week, nothing to refresh', { appWeek });
    return;
  }

  const calendar = await getCalendar(SEASON_YEAR);
  const cfbdWeeks = overlappingCfbdWeeks(calendar, window);

  if (cfbdWeeks.length === 0) {
    logStep('no CFBD week overlaps this app week', { appWeek });
    return;
  }

  logStep('refreshing live data', { season: SEASON_YEAR, appWeek, cfbdWeeks });

  const players = (await readCache<Player[]>(playersCacheKey(SEASON_YEAR))) ?? [];
  if (players.length === 0) {
    throw new Error('No cached players; run refresh:players before refresh:live');
  }

  // Player ids are `espn_<pos>_<athleteId>`; box scores key on the athlete id.
  const idByAthlete = new Map<string, string>();
  for (const player of players) {
    const athleteId = player.id.split('_').pop();
    if (athleteId) idByAthlete.set(athleteId, player.id);
  }

  const seasonTypes = Array.from(new Set(cfbdWeeks.map((entry) => entry.seasonType)));

  const [gamePlayerChunks, gameChunks] = await Promise.all([
    Promise.all(cfbdWeeks.map((entry) => getGamePlayerStats(SEASON_YEAR, entry.week, entry.seasonType))),
    Promise.all(seasonTypes.map((seasonType) => getGames(SEASON_YEAR, seasonType))),
  ]);

  // A CFBD week can cover more than one app week, so keep only the games whose
  // kickoff actually falls inside this app week.
  const weekGames: CfbdGame[] = gameChunks.flat().filter((game) => {
    const kickoff = effectiveKickoff(game);
    return kickoff !== null && weekForDate(kickoff) === appWeek;
  });
  const gameIds = new Set(weekGames.map((game) => String(game.id)));

  const stats = buildLiveStats({
    gamePlayers: gamePlayerChunks.flat(),
    week: appWeek,
    idByAthlete,
    gameIds,
    now,
  });
  const games = buildGameStatuses(weekGames, appWeek, now);

  const cacheKey = liveStatsCacheKey(SEASON_YEAR, appWeek);

  // Games often have not kicked off yet when a week's window opens. Publishing
  // an empty stat list would wipe a previously complete week.
  if (stats.length === 0) {
    const existing = await readCache<{ stats?: unknown[] }>(cacheKey);
    if (existing?.stats && existing.stats.length > 0) {
      logStep('no box scores yet, keeping existing cached stats', { appWeek });
      return;
    }
  }

  await writeCache(cacheKey, {
    week: appWeek,
    updatedAt: now.toISOString(),
    stats,
    games,
  });

  logStep('live data cached', { appWeek, players: stats.length, games: games.length });
});
