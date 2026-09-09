/**
 * Maps CFBD API payloads onto the app's `Player` shape.
 *
 * CFBD returns season stats in a long/narrow form — one row per
 * (player, category, statType) with `stat` as a string — so the rows must be
 * pivoted before they can be read as a stat line.
 */

import type { GameStatus, Player, PlayerStats, TeamSchedule, WeeklyGame } from '../lib/types';
import { SCORING_RULES } from '../lib/types';
import type {
  CfbdGame,
  CfbdGamePlayers,
  CfbdRosterPlayer,
  CfbdSeasonStat,
  CfbdTeam,
} from './cfbd';

export const SKILL_POSITIONS = new Set<Player['position']>(['QB', 'RB', 'WR']);
export const STAT_CATEGORIES = ['passing', 'rushing', 'receiving', 'kickReturns', 'puntReturns'];

export type StatLine = {
  passingYards: number;
  passingTDs: number;
  completions: number;
  attempts: number;
  interceptions: number;
  rushingYards: number;
  rushingTDs: number;
  receivingYards: number;
  receptions: number;
  receivingTDs: number;
  returnYards: number;
};

const EMPTY_STAT_LINE: StatLine = {
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
  returnYards: 0,
};

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Pivots the long/narrow CFBD stat rows into one stat line per player id. */
export function pivotSeasonStats(rows: CfbdSeasonStat[]): Map<string, StatLine> {
  const byPlayer = new Map<string, StatLine>();

  for (const row of rows) {
    if (!row.playerId) continue;
    let line = byPlayer.get(row.playerId);
    if (!line) {
      line = { ...EMPTY_STAT_LINE };
      byPlayer.set(row.playerId, line);
    }

    const value = toNumber(row.stat);
    const type = row.statType;

    switch (row.category) {
      case 'passing':
        if (type === 'YDS') line.passingYards = value;
        else if (type === 'TD') line.passingTDs = value;
        else if (type === 'COMPLETIONS') line.completions = value;
        else if (type === 'ATT') line.attempts = value;
        else if (type === 'INT') line.interceptions = value;
        break;
      case 'rushing':
        if (type === 'YDS') line.rushingYards = value;
        else if (type === 'TD') line.rushingTDs = value;
        break;
      case 'receiving':
        if (type === 'YDS') line.receivingYards = value;
        else if (type === 'TD') line.receivingTDs = value;
        else if (type === 'REC') line.receptions = value;
        break;
      case 'kickReturns':
      case 'puntReturns':
        if (type === 'YDS') line.returnYards += value;
        break;
      default:
        break;
    }
  }

  return byPlayer;
}

/**
 * Season fantasy points for a stat line, using the app's scoring rules.
 * Mirrors `calculateFantasyPoints` in src/lib/stats-utils.ts.
 */
export function scoreStatLine(line: StatLine): number {
  let points = 0;
  points += Math.floor(line.passingYards / 25) * SCORING_RULES.passingYards;
  points += Math.floor(line.rushingYards / 10) * SCORING_RULES.rushingYards;
  points += Math.floor(line.receivingYards / 10) * SCORING_RULES.receivingYards;
  points += Math.floor(line.returnYards / 10) * SCORING_RULES.returnYards;
  points += line.passingTDs * SCORING_RULES.passingTD;
  points += line.rushingTDs * SCORING_RULES.rushingTD;
  points += line.receivingTDs * SCORING_RULES.receivingTD;
  points += line.interceptions * SCORING_RULES.interception;
  points += line.completions * SCORING_RULES.completion;
  points += Math.max(0, line.attempts - line.completions) * SCORING_RULES.incompletion;
  return points;
}

/** Fantasy scoring produces long floats via 0.1-style rules; keep one decimal. */
function roundPoints(points: number): number {
  return Math.round(points * 10) / 10;
}

/** Completed games per team, used to turn season totals into per-game projections. */
export function countGamesPlayed(games: CfbdGame[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const game of games) {
    if (!game.completed) continue;
    for (const team of [game.homeTeam, game.awayTeam]) {
      if (team) counts.set(team, (counts.get(team) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * CFBD athlete ids are the same ids ESPN uses, so ESPN's headshot CDN resolves
 * directly. Verified against known 2025 starters.
 */
export function espnHeadshotUrl(playerId: string): string {
  return `https://a.espncdn.com/i/headshots/college-football/players/full/${playerId}.png`;
}

function pickLogo(team: CfbdTeam | undefined): string | undefined {
  const logo = team?.logos?.find((entry) => entry && !entry.includes('logos-dark'));
  return logo ?? team?.logos?.[0] ?? undefined;
}

export function buildPlayers(options: {
  teams: CfbdTeam[];
  roster: CfbdRosterPlayer[];
  statsByPlayer: Map<string, StatLine>;
  gamesPlayed: Map<string, number>;
}): Player[] {
  const { teams, roster, statsByPlayer, gamesPlayed } = options;

  const teamsBySchool = new Map(teams.map((team) => [team.school, team]));

  const players: Player[] = [];

  for (const entry of roster) {
    const position = entry.position?.toUpperCase() as Player['position'] | undefined;
    if (!position || !SKILL_POSITIONS.has(position)) continue;

    const team = teamsBySchool.get(entry.team);
    if (!team) continue; // Not an FBS team for this season.

    const name = [entry.firstName, entry.lastName].filter(Boolean).join(' ').trim();
    if (!entry.id || !name) continue;

    const line = statsByPlayer.get(entry.id) ?? { ...EMPTY_STAT_LINE };
    const seasonPoints = scoreStatLine(line);
    // Projection stats come from the previous completed season, so the divisor
    // is that team's completed game count for that season.
    const played = gamesPlayed.get(entry.team) ?? 0;
    const projectedPoints = played > 0 ? roundPoints(seasonPoints / played) : 0;

    players.push({
      // Prefix retained so lineups saved against the previous ESPN-backed ids
      // keep resolving — CFBD and ESPN share the same athlete ids.
      id: `espn_${position.toLowerCase()}_${entry.id}`,
      name,
      position,
      team: entry.team,
      conference: team.conference ?? 'Independent',
      projectedPoints,
      headshotUrl: espnHeadshotUrl(entry.id),
      teamLogoUrl: pickLogo(team),
      teamColorPrimary: team.color ?? undefined,
      teamColorSecondary: team.alternateColor ?? undefined,
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
      returnYards: line.returnYards,
    });
  }

  players.sort((a, b) => b.projectedPoints - a.projectedPoints || a.name.localeCompare(b.name));
  return players;
}

/**
 * The instant used to decide which week a game belongs to.
 *
 * CFBD gives games without a confirmed kickoff a midnight-Eastern placeholder
 * (e.g. `2026-09-26T04:00:00Z` for a game on Sep 26). Taken literally that sits
 * before the week boundary and files the game into the previous week, so TBD
 * games are nudged to midday on their own local date. Games with a real kickoff
 * are used as-is, which correctly keeps Friday-night games in the prior week.
 */
/**
 * When a kickoff time is still TBD, CFBD stores a midnight placeholder rather
 * than a real time. Nudging it to midday keeps the game on its intended
 * calendar day once local timezones are applied, instead of slipping into the
 * evening before — which in November (CST) would file it a week early.
 */
export function effectiveKickoff(game: Pick<CfbdGame, 'startDate' | 'startTimeTBD'>): Date | null {
  if (!game.startDate) return null;
  const kickoff = new Date(game.startDate);
  if (Number.isNaN(kickoff.getTime())) return null;
  if (!game.startTimeTBD) return kickoff;
  return new Date(kickoff.getTime() + 12 * 60 * 60 * 1000);
}

/**
 * Builds per-team schedules with bye weeks.
 *
 * Games are placed by kickoff date rather than by CFBD's week number: CFBD's
 * week numbering does not line up with the app's (its 2026 week 1 covers two of
 * our weeks, and its whole postseason is a single week), so a constant offset
 * would misfile most of the season.
 */
export function buildTeamSchedules(options: {
  teams: CfbdTeam[];
  games: CfbdGame[];
  weekForDate: (date: Date) => number | null;
  regularSeasonLastWeek: number;
}): TeamSchedule[] {
  const { teams, games, weekForDate, regularSeasonLastWeek } = options;
  const schedules = new Map<string, TeamSchedule>();

  for (const team of teams) {
    schedules.set(team.school, {
      teamId: String(team.id),
      teamName: team.school,
      conference: team.conference ?? 'Independent',
      weeklyGames: [],
      byeWeeks: [],
    });
  }

  for (const game of games) {
    const kickoff = effectiveKickoff(game);
    if (!kickoff) continue;
    const week = weekForDate(kickoff);
    if (week === null) continue; // Week 0 is valid, so compare against null.

    for (const side of ['home', 'away'] as const) {
      const teamName = side === 'home' ? game.homeTeam : game.awayTeam;
      const opponent = side === 'home' ? game.awayTeam : game.homeTeam;
      const schedule = schedules.get(teamName);
      if (!schedule) continue;

      const teamPoints = side === 'home' ? game.homePoints : game.awayPoints;
      const opponentPoints = side === 'home' ? game.awayPoints : game.homePoints;
      // CFBD flags a game completed before the scores land occasionally, so
      // require both to treat it as final.
      const isCompleted =
        game.completed === true && typeof teamPoints === 'number' && typeof opponentPoints === 'number';

      schedule.weeklyGames.push({
        week,
        opponent: opponent ?? 'TBD',
        isHomeGame: side === 'home' && !game.neutralSite,
        isByeWeek: false,
        gameId: String(game.id),
        gameDate: kickoff,
        gameTime: game.startTimeTBD ? 'TBD' : kickoff.toISOString().slice(11, 16),
        isCompleted,
        ...(isCompleted ? { teamPoints: teamPoints as number, opponentPoints: opponentPoints as number } : {}),
      });
    }
  }

  for (const schedule of schedules.values()) {
    const scheduledWeeks = new Set(schedule.weeklyGames.map((game) => game.week));
    const regularSeasonWeeks = [...scheduledWeeks].filter((week) => week <= regularSeasonLastWeek);
    if (regularSeasonWeeks.length === 0) continue;

    // A bye is a gap inside a team's own season, so only look between its first
    // and last regular-season game. Otherwise every team that sits out Week 0
    // would be recorded as on bye then, and every team that misses its
    // conference championship would be on bye in the final week.
    const firstWeek = Math.min(...regularSeasonWeeks);
    const lastWeek = Math.max(...regularSeasonWeeks);

    for (let week = firstWeek; week <= lastWeek; week++) {
      if (!scheduledWeeks.has(week)) {
        schedule.byeWeeks.push(week);
        schedule.weeklyGames.push({ week, isHomeGame: false, isByeWeek: true });
      }
    }

    schedule.weeklyGames.sort((a, b) => a.week - b.week);
  }

  return Array.from(schedules.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
}

/**
 * Per-game box-score stats for one week, mapped onto the app's `PlayerStats`.
 *
 * `idByAthlete` maps a CFBD/ESPN athlete id to the prefixed player id used by
 * the cached player pool, so live stats join straight onto saved lineups.
 */
export function buildLiveStats(options: {
  gamePlayers: CfbdGamePlayers[];
  week: number;
  idByAthlete: Map<string, string>;
  gameIds?: Set<string>;
  now?: Date;
}): PlayerStats[] {
  const { gamePlayers, week, idByAthlete, gameIds, now = new Date() } = options;
  const byPlayer = new Map<string, PlayerStats>();

  const ensure = (athleteId: string, gameId: number): PlayerStats | undefined => {
    const playerId = idByAthlete.get(athleteId);
    if (!playerId) return undefined; // Not a skill-position player we track.
    const key = `${gameId}:${playerId}`;
    let stats = byPlayer.get(key);
    if (!stats) {
      stats = {
        playerId,
        week,
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
        fantasyPoints: 0,
        lastUpdated: now,
      };
      byPlayer.set(key, stats);
    }
    return stats;
  };

  for (const game of gamePlayers) {
    // A CFBD week can straddle two app weeks, so only score the games that
    // actually belong to this one.
    if (gameIds && !gameIds.has(String(game.id))) continue;

    for (const team of game.teams ?? []) {
      for (const category of team.categories ?? []) {
        for (const type of category.types ?? []) {
          for (const athlete of type.athletes ?? []) {
            const stats = ensure(athlete.id, game.id);
            if (!stats) continue;

            const value = toNumber(athlete.stat);

            switch (category.name) {
              case 'passing':
                // Completions and attempts arrive combined as "21/31".
                if (type.name === 'C/ATT') {
                  const [completions, attempts] = String(athlete.stat ?? '').split('/');
                  stats.completions = toNumber(completions);
                  stats.attempts = toNumber(attempts);
                } else if (type.name === 'YDS') stats.passingYards = value;
                else if (type.name === 'TD') stats.passingTDs = value;
                else if (type.name === 'INT') stats.interceptions = value;
                break;
              case 'rushing':
                if (type.name === 'YDS') stats.rushingYards = value;
                else if (type.name === 'TD') stats.rushingTDs = value;
                break;
              case 'receiving':
                if (type.name === 'YDS') stats.receivingYards = value;
                else if (type.name === 'TD') stats.receivingTDs = value;
                else if (type.name === 'REC') stats.receptions = value;
                break;
              case 'kickReturns':
                if (type.name === 'YDS') stats.kickReturnYards = value;
                break;
              case 'puntReturns':
                if (type.name === 'YDS') stats.puntReturnYards = value;
                break;
              default:
                break;
            }
          }
        }
      }
    }
  }

  const totals = new Map<string, PlayerStats>();
  const fields = [
    'passingYards', 'passingTDs', 'completions', 'attempts', 'interceptions',
    'rushingYards', 'rushingTDs', 'receivingYards', 'receptions', 'receivingTDs',
    'kickReturnYards', 'puntReturnYards',
  ] as const;
  for (const stats of byPlayer.values()) {
    const total = totals.get(stats.playerId);
    if (!total) totals.set(stats.playerId, { ...stats });
    else for (const field of fields) total[field] += stats[field];
  }
  for (const stats of totals.values()) {
    stats.fantasyPoints = roundPoints(scoreStatLine({
      passingYards: stats.passingYards,
      passingTDs: stats.passingTDs,
      completions: stats.completions,
      attempts: stats.attempts,
      interceptions: stats.interceptions,
      rushingYards: stats.rushingYards,
      rushingTDs: stats.rushingTDs,
      receivingYards: stats.receivingYards,
      receptions: stats.receptions,
      receivingTDs: stats.receivingTDs,
      returnYards: stats.kickReturnYards + stats.puntReturnYards,
    }));
  }

  return Array.from(totals.values()).sort((a, b) => b.fantasyPoints - a.fantasyPoints);
}

/** Scoreboard entries for one week. */
export function buildGameStatuses(games: CfbdGame[], week: number, now = new Date()): GameStatus[] {
  return games.map((game) => {
    const kickoff = effectiveKickoff(game);
    const started = kickoff ? kickoff.getTime() <= now.getTime() : false;

    let status: GameStatus['status'] = 'scheduled';
    if (game.completed && typeof game.homePoints === 'number' && typeof game.awayPoints === 'number') status = 'final';
    else if (started) status = 'in-progress';

    return {
      week,
      team1: game.homeTeam,
      team2: game.awayTeam,
      status,
      team1Score: game.homePoints ?? 0,
      team2Score: game.awayPoints ?? 0,
      lastUpdated: now,
    };
  });
}
