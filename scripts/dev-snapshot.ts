/**
 * Builds a local, offline snapshot of the player pool, teams and schedules for
 * the FCS preview — see `npm run dev:preview`.
 *
 * This exists so the FCS pick'em can be evaluated without writing anything to a
 * database: it reads CollegeFootballData directly and writes a single JSON file
 * that the dev API (scripts/dev-api.ts) serves. The refresh scripts and
 * `data_cache` are untouched.
 *
 * Usage: npm run dev:snapshot            (both divisions, the point of the preview)
 *        DIVISIONS=fbs npm run dev:snapshot   (FBS-only, for an A/B comparison)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';


import { PROJECTION_YEAR, SEASON_YEAR, REGULAR_SEASON_LAST_WEEK, weekForDate } from '../src/lib/season-config';
import { parseClassifications, type Classification } from '../src/lib/classification';
import type { Player, TeamSchedule } from '../src/lib/types';
import type { SeasonPlayerStats, SeasonStatsPayload } from '../src/lib/season-stats';
import {
  STAT_CATEGORIES,
  buildPlayers,
  buildTeamSchedules,
  countGamesPlayed,
  pivotSeasonStats,
  roundPoints,
  scoreStatLine,
  teamClassification,
  type StatLine,
} from '../src/server/cfbd-transform';
import type { CfbdSeasonStat } from '../src/server/cfbd';
import { SNAPSHOT_PATH, type DevSnapshot, type DevTeamSummary } from './lib/dev-snapshot';
import { loadLocalEnv, logStep, requireEnv } from './lib/runner';

const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR']);

/** Raw upstream responses, kept so a throttled run can resume. */
const RAW_DIR = join(dirname(SNAPSHOT_PATH), 'raw');

/** Spacing between upstream calls; CFBD rejects a burst with a 429. */
const REQUEST_SPACING_MS = 3_000;

async function cached<T>(name: string, request: () => Promise<T>): Promise<T> {
  const path = join(RAW_DIR, `${name}.json`);
  try {
    const hit = JSON.parse(await readFile(path, 'utf8')) as T;
    logStep('reused cached response', { source: name, rows: Array.isArray(hit) ? hit.length : 1 });
    return hit;
  } catch {
    // Not cached yet, or unreadable: fetch it below.
  }

  const value = await request();
  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(value), 'utf8');
  logStep('fetched', { source: name, rows: Array.isArray(value) ? value.length : 1 });
  await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS));
  return value;
}

/**
 * Season totals for the preview.
 *
 * A 2026 season that has not been played has no actual stats, and a pool with
 * no stats at all would hide exactly what this preview is meant to show — how
 * FCS production compares with FBS. The previous completed season's real totals
 * stand in, which is the same data the projections are already built from.
 * `missingWeeks` is empty so the UI treats the totals as final rather than
 * partial.
 */
function previewSeasonStats(players: Player[], statsByAthlete: Map<string, StatLine>): SeasonStatsPayload {
  const stats: SeasonPlayerStats[] = [];
  for (const player of players) {
    const athleteId = player.id.split('_').pop()!;
    const line = statsByAthlete.get(athleteId);
    if (!line) continue;
    stats.push({
      playerId: player.id,
      fantasyPoints: roundPoints(scoreStatLine(line)),
      passingYards: line.passingYards,
      passingTDs: line.passingTDs,
      completions: line.completions,
      attempts: line.attempts,
      interceptions: line.interceptions,
      rushingYards: line.rushingYards,
      rushingTDs: line.rushingTDs,
      receivingYards: line.receivingYards,
      receptions: line.receptions,
      receivingTDs: line.receivingTDs,
      // CFBD season stats merge both return categories into one total, so all
      // of it is reported as kick return yardage rather than split by guess.
      kickReturnYards: line.returnYards,
      puntReturnYards: 0,
    });
  }
  return {
    season: SEASON_YEAR,
    stats,
    availableWeeks: [],
    missingWeeks: [],
    updatedAt: new Date().toISOString(),
    sourceStatus: 'ready',
    sourceCheckedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  loadLocalEnv();
  requireEnv('CFBD_API_KEY');

  const classifications: Classification[] = parseClassifications(process.env.DIVISIONS ?? 'fbs,fcs');
  logStep('building dev preview snapshot', {
    season: SEASON_YEAR,
    projectionYear: PROJECTION_YEAR,
    divisions: classifications,
  });

  const { getTeams, getRoster, getSeasonStats, getAllDivisionGames, getGames } =
    await import('../src/server/cfbd');

  // This script asks for more endpoints than any single refresh job does, and
  // CFBD rate-limits that. Requests are issued one at a time, spaced out, and
  // each raw response is kept on disk so an interrupted or throttled run
  // resumes instead of re-downloading tens of megabytes.
  const teams = await cached('teams', () => getTeams(SEASON_YEAR, classifications));
  const roster = await cached('roster', () => getRoster(SEASON_YEAR));
  const games = await cached('games', () => getGames(SEASON_YEAR, 'both', classifications));
  // Every division: the per-game divisor must count a promoted team's games
  // from the season it played in its old division.
  const priorGames = await cached('prior-games', () => getAllDivisionGames(PROJECTION_YEAR, 'both'));
  const statChunks: CfbdSeasonStat[][] = [];
  for (const category of STAT_CATEGORIES) {
    statChunks.push(await cached(`stats-${category}`, () => getSeasonStats(PROJECTION_YEAR, category)));
  }

  if (!teams.length || !roster.length || !games.length) {
    throw new Error('CFBD returned no teams, roster or games; snapshot not written');
  }
  logStep('fetched', {
    teams: teams.length,
    rosterRows: roster.length,
    games: games.length,
    priorGames: priorGames.length,
  });

  const statsByAthlete = pivotSeasonStats(
    statChunks.flat().filter((row) => SKILL_POSITIONS.has((row.position ?? '').toUpperCase())),
  );
  const gamesPlayed = countGamesPlayed(priorGames);

  const players = buildPlayers({ teams, roster, statsByPlayer: statsByAthlete, gamesPlayed });
  if (!players.length) throw new Error('Player build produced 0 players; snapshot not written');

  const schedules: TeamSchedule[] = buildTeamSchedules({
    teams,
    games,
    weekForDate,
    regularSeasonLastWeek: REGULAR_SEASON_LAST_WEEK,
  });

  const teamSummaries: DevTeamSummary[] = teams
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

  const snapshot: DevSnapshot = {
    generatedAt: new Date().toISOString(),
    season: SEASON_YEAR,
    projectionYear: PROJECTION_YEAR,
    divisions: classifications,
    players,
    teams: teamSummaries,
    schedules,
    seasonStats: previewSeasonStats(players, statsByAthlete),
  };

  await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot), 'utf8');

  const byDivision = Object.fromEntries(
    classifications.map((classification) => [
      classification,
      {
        players: players.filter((player) => player.classification === classification).length,
        teams: teamSummaries.filter((team) => team.classification === classification).length,
      },
    ]),
  );
  logStep('snapshot written', {
    path: SNAPSHOT_PATH,
    players: players.length,
    byDivision,
    schedules: schedules.length,
    withSeasonStats: snapshot.seasonStats.stats.length,
    approxMb: Math.round(JSON.stringify(snapshot).length / 1e5) / 10,
  });
}

await main();
