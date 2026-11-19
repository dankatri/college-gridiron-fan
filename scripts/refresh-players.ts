/**
 * Refreshes teams and the skill-position player pool from CFBD.
 *
 * Which divisions are included is controlled by `INCLUDED_DIVISIONS`
 * (default `fbs`; set `fbs,fcs` to add FCS) — see src/server/classifications.ts.
 *
 * Rosters change through the season (transfers, additions), so this runs daily.
 * Projection stats come from the cached completed-season pull rather than being
 * re-downloaded — see scripts/refresh-projections.ts.
 *
 * Usage: npm run refresh:players
 */

import { PROJECTION_YEAR, SEASON_YEAR } from '../src/lib/season-config';
import { playersCacheKey, seasonStatsCacheKey, teamsCacheKey } from '../src/server/cache-keys';
import { buildPlayers, teamClassification } from '../src/server/cfbd-transform';
import { includedClassifications } from '../src/server/classifications';
import type { StatLine } from '../src/server/cfbd-transform';
import type { ProjectionCache } from './refresh-projections';
import { poolAfterFcsWeek } from '../src/lib/week-divisions';
import type { Player } from '../src/lib/types';
import { beginCacheRun, readCache, readPickedPlayerIds, refreshCache, IncompleteSourceError } from './lib/cache';
import { logStep, requireEnv, runScript } from './lib/runner';

await runScript('refresh-players', async () => {
  requireEnv('CFBD_API_KEY');
  requireEnv('DATABASE_URL');
  const run = await beginCacheRun();
  await refreshCache(playersCacheKey(SEASON_YEAR), run, async () => {

    const { getTeams, getRoster } = await import('../src/server/cfbd');
    const classifications = includedClassifications();

    logStep('fetching teams and roster', { season: SEASON_YEAR, divisions: classifications });
    const [teams, roster] = await Promise.all([
      getTeams(SEASON_YEAR, classifications),
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

    const built = buildPlayers({ teams, roster, statsByPlayer, gamesPlayed });
    // Once the FCS week is over only FCS players still in a saved lineup stay
    // published; see poolAfterFcsWeek. Failing to read the lineups must abort
    // rather than prune everyone.
    const pickedIds = await readPickedPlayerIds(SEASON_YEAR);
    const now = new Date();
    const players = poolAfterFcsWeek(built, pickedIds, now);
    if (players.length !== built.length) {
      logStep('FCS week is over; pruned unpicked FCS players', { before: built.length, after: players.length });
    }

    if (players.length === 0) {
      throw new Error('Player build produced 0 players; refusing to overwrite cache');
    }

    const teamSummaries = teams
      .map((team) => ({
        id: String(team.id),
        school: team.school,
        conference: team.conference ?? 'Independent',
        classification: teamClassification(team) ?? null,
        logo: team.logos?.find((entry) => entry && !entry.includes('logos-dark')) ?? null,
        color: team.color ?? null,
        alternateColor: team.alternateColor ?? null,
      }))
      .sort((a, b) => a.school.localeCompare(b.school));

    // Compare like with like: the stored pool was pruned the same way, and
    // the first run after the cutoff would otherwise read as a mass loss.
    const stored = await readCache<Player[]>(playersCacheKey(SEASON_YEAR));
    const previous = stored && poolAfterFcsWeek(stored, pickedIds, now);
    if (previous?.length && players.length < previous.length / 2) {
      throw new IncompleteSourceError('The player pool unexpectedly lost more than half its rows');
    }
    await refreshCache(teamsCacheKey(SEASON_YEAR), run, async () => teamSummaries);

    const withProjection = players.filter((player) => player.projectedPoints > 0).length;
    const byDivision = Object.fromEntries(
      classifications.map((classification) => [
        classification,
        players.filter((player) => player.classification === classification).length,
      ]),
    );
    logStep('players cached', {
      players: players.length,
      byDivision,
      teams: teamSummaries.length,
      withProjection,
      approxBytes: JSON.stringify(players).length,
    });
    return players;
  });
});
