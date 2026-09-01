/**
 * Refreshes FBS teams and the skill-position player pool from CFBD.
 *
 * Rosters change through the season (transfers, additions), so this runs daily.
 * Projection stats come from the cached completed-season pull rather than being
 * re-downloaded — see scripts/refresh-projections.ts.
 *
 * Usage: npm run refresh:players
 */

import { PROJECTION_YEAR, SEASON_YEAR } from '../src/lib/season-config';
import { playersCacheKey, seasonStatsCacheKey, teamsCacheKey } from '../src/server/cache-keys';
import { buildPlayers } from '../src/server/cfbd-transform';
import type { StatLine } from '../src/server/cfbd-transform';
import type { ProjectionCache } from './refresh-projections';
import { readCache, writeCache } from './lib/cache';
import { logStep, requireEnv, runScript } from './lib/runner';

await runScript('refresh-players', async () => {
  requireEnv('CFBD_API_KEY');
  requireEnv('DATABASE_URL');

  const { getFbsTeams, getRoster } = await import('../src/server/cfbd');

  logStep('fetching teams and roster', { season: SEASON_YEAR });
  const [teams, roster] = await Promise.all([
    getFbsTeams(SEASON_YEAR),
    getRoster(SEASON_YEAR),
  ]);
  logStep('fetched', { teams: teams.length, rosterRows: roster.length });

  if (teams.length === 0 || roster.length === 0) {
    throw new Error(`CFBD returned no teams/roster for ${SEASON_YEAR}; refusing to overwrite cache`);
  }

  const projections = await readCache<ProjectionCache>(seasonStatsCacheKey(PROJECTION_YEAR));
  if (!projections) {
    logStep('WARNING: no cached projection stats; run refresh:projections first', {
      year: PROJECTION_YEAR,
    });
  }

  const statsByPlayer = new Map<string, StatLine>(
    Object.entries(projections?.statsByPlayer ?? {}),
  );
  const gamesPlayed = new Map<string, number>(Object.entries(projections?.gamesPlayed ?? {}));

  const players = buildPlayers({ teams, roster, statsByPlayer, gamesPlayed });

  if (players.length === 0) {
    throw new Error('Player build produced 0 players; refusing to overwrite cache');
  }

  const teamSummaries = teams
    .map((team) => ({
      id: String(team.id),
      school: team.school,
      conference: team.conference ?? 'Independent',
      logo: team.logos?.find((entry) => entry && !entry.includes('logos-dark')) ?? null,
      color: team.color ?? null,
      alternateColor: team.alternateColor ?? null,
    }))
    .sort((a, b) => a.school.localeCompare(b.school));

  await writeCache(teamsCacheKey(SEASON_YEAR), teamSummaries);
  await writeCache(playersCacheKey(SEASON_YEAR), players);

  const withProjection = players.filter((player) => player.projectedPoints > 0).length;
  logStep('players cached', {
    players: players.length,
    teams: teamSummaries.length,
    withProjection,
    approxBytes: JSON.stringify(players).length,
  });
});
