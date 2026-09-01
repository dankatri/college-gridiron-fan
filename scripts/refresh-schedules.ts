/**
 * Refreshes team schedules and bye weeks from CFBD.
 *
 * Replaces the previous per-team ESPN fetches (70 HTTP calls) with a single
 * bulk /games request.
 *
 * Usage: npm run refresh:schedules
 */

import { REGULAR_SEASON_WEEKS, SEASON_YEAR, weekForDate } from '../src/lib/season-config';
import { schedulesCacheKey } from '../src/server/cache-keys';
import { buildTeamSchedules } from '../src/server/cfbd-transform';
import { writeCache } from './lib/cache';
import { logStep, requireEnv, runScript } from './lib/runner';

await runScript('refresh-schedules', async () => {
  requireEnv('CFBD_API_KEY');
  requireEnv('DATABASE_URL');

  const { getFbsTeams, getGames } = await import('../src/server/cfbd');

  logStep('fetching teams and games', { season: SEASON_YEAR });
  const [teams, games] = await Promise.all([
    getFbsTeams(SEASON_YEAR),
    getGames(SEASON_YEAR, 'both'),
  ]);
  logStep('fetched', { teams: teams.length, games: games.length });

  if (teams.length === 0 || games.length === 0) {
    throw new Error(
      `CFBD returned ${teams.length} teams / ${games.length} games for ${SEASON_YEAR}; refusing to overwrite cache`,
    );
  }

  const schedules = buildTeamSchedules({
    teams,
    games,
    weekForDate,
    regularSeasonWeeks: REGULAR_SEASON_WEEKS,
  });

  const withGames = schedules.filter((schedule) =>
    schedule.weeklyGames.some((game) => !game.isByeWeek),
  ).length;

  // An empty or partial upstream response would otherwise write a dataset in
  // which every team is on bye for the whole season.
  if (withGames < teams.length / 2) {
    throw new Error(
      `Only ${withGames}/${teams.length} teams have games; refusing to overwrite cache`,
    );
  }

  await writeCache(schedulesCacheKey(SEASON_YEAR), schedules);

  logStep('schedules cached', {
    teams: schedules.length,
    teamsWithGames: withGames,
    approxBytes: JSON.stringify(schedules).length,
  });
});
