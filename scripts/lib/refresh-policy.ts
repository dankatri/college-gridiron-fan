import type { CfbdGame, CfbdGamePlayers } from '../../src/server/cfbd';
import type { GameStatus, Player, PlayerStats, TeamSchedule } from '../../src/lib/types';
import { ALL_WEEKS, FIRST_WEEK, LAST_WEEK } from '../../src/lib/types';
import { weekBoundary, weekForDate } from '../../src/lib/season-config';
import { effectiveKickoff } from '../../src/server/cfbd-transform';
import { IncompleteSourceError } from './cache';

const HOUR = 60 * 60 * 1000;
export const CORRECTION_WINDOW_MS = 96 * HOUR;

export function shouldDiscover(schedules: TeamSchedule[] | null, checkedAt: string | null, now: Date, sweep: boolean) {
  const age = checkedAt ? now.getTime() - Date.parse(checkedAt) : NaN;
  if (sweep || !Array.isArray(schedules) || !schedules.length || !Number.isFinite(age) || age > HOUR) return true;
  if (schedules.some(team => !team || !Array.isArray(team.weeklyGames) || team.weeklyGames.some(game => !game))) return true;
  return schedules.some(team => team.weeklyGames.some(game => {
    if (!game.gameDate || game.isByeWeek || game.isCompleted) return false;
    const elapsed = now.getTime() - new Date(game.gameDate).getTime();
    if (!Number.isFinite(elapsed)) return true;
    return elapsed >= -HOUR && elapsed <= 8 * HOUR;
  }));
}

export function refreshWeeks(games: CfbdGame[], now: Date, sweep: boolean, forcedWeek?: number): number[] {
  if (forcedWeek !== undefined) {
    if (!Number.isInteger(forcedWeek) || forcedWeek < FIRST_WEEK || forcedWeek > LAST_WEEK) throw new Error('WEEK is not part of this season');
    return [forcedWeek];
  }
  const weeks = new Set<number>();
  for (const game of games) {
    const kickoff = effectiveKickoff(game);
    if (!kickoff) continue;
    const week = weekForDate(kickoff);
    const elapsed = now.getTime() - kickoff.getTime();
    if (week !== null && elapsed >= 0 && (
      elapsed <= 8 * HOUR || (game.completed && elapsed <= CORRECTION_WINDOW_MS) || (sweep && !game.completed)
    )) weeks.add(week);
  }
  if (sweep) for (const week of ALL_WEEKS) {
    const end = weekBoundary(week + 1);
    const elapsed = end ? now.getTime() - end.getTime() : -1;
    if (elapsed >= 0 && elapsed <= CORRECTION_WINDOW_MS) weeks.add(week);
  }
  return [...weeks].sort((a, b) => a - b);
}

export function assertScheduleCompleteness(previous: TeamSchedule[] | null, next: TeamSchedule[]) {
  if (!next.length || next.filter(team => team.weeklyGames.some(game => !game.isByeWeek)).length < next.length / 2) {
    throw new IncompleteSourceError('The schedule source has insufficient team/game coverage');
  }
  const nextIds = new Set(next.flatMap(team => team.weeklyGames.flatMap(game => game.gameId ? [game.gameId] : [])));
  const nextTeams = new Set(next.map(team => team.teamId));
  if (previous?.some(team => !nextTeams.has(team.teamId))) {
    throw new IncompleteSourceError('A previously available FBS team disappeared from the schedule source');
  }
  for (const team of previous ?? []) for (const game of team.weeklyGames) {
    if (game.isCompleted && game.gameId && !nextIds.has(game.gameId)) {
      throw new IncompleteSourceError('A previously completed game disappeared from the schedule source');
    }
  }
}

export type AcceptedLiveSnapshot = { stats?: PlayerStats[]; games?: GameStatus[] };

/** Retain the entire accepted aggregate if its game-level inputs are ambiguous. */
export function assertLiveCompleteness(
  games: CfbdGame[], boxes: CfbdGamePlayers[], previous: AcceptedLiveSnapshot | null, players: Player[],
) {
  const boxesById = new Map(boxes.map(box => [box.id, box]));
  const teamsByPlayer = new Map(players.map(player => [player.id, player.team]));
  const previouslyScoredTeams = new Set<string>();
  for (const stat of previous?.stats ?? []) {
    const team = teamsByPlayer.get(stat.playerId);
    if (!team) throw new IncompleteSourceError('An accepted stat line cannot be resolved to the current player pool');
    previouslyScoredTeams.add(team);
  }
  for (const team of previouslyScoredTeams) {
    if (!games.some(game => game.homeTeam === team || game.awayTeam === team)) {
      throw new IncompleteSourceError('A stat-bearing game disappeared from this week; historical reconciliation is required');
    }
  }
  for (const game of games) {
    const required = game.completed || previouslyScoredTeams.has(game.homeTeam) || previouslyScoredTeams.has(game.awayTeam);
    if (!required) continue;
    const box = boxesById.get(game.id);
    for (const [name, score] of [[game.homeTeam, game.homePoints], [game.awayTeam, game.awayPoints]] as const) {
      const team = box?.teams.find(candidate => candidate.team === name);
      if (!team || !Array.isArray(team.categories) || !team.categories.length) {
        throw new IncompleteSourceError('A completed or previously scored game has missing team statistics');
      }
      if (game.completed && (typeof score !== 'number' || team.points !== score)) {
        throw new IncompleteSourceError('Final box scores do not yet agree with the game scoreboard');
      }
      if (!['passing', 'rushing', 'receiving'].every(category => team.categories.some(row => row.name === category))) {
        throw new IncompleteSourceError('Core box-score categories are incomplete');
      }
    }
  }
}
