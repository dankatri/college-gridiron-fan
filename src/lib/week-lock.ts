/**
 * When lineups can still be changed.
 *
 * A week is not an all-or-nothing thing. Its games are spread from Thursday
 * night to the following Tuesday, so the week as a whole stays open for edits
 * until its window closes, while each individual player locks the moment their
 * own game kicks off. That is what stops someone benching a player after
 * watching them get injured, without freezing the other five slots for days.
 */

import { weekBoundary } from './season-config';
import type { TeamSchedule, WeeklyGame } from './types';

/**
 * True once the week's window has opened, meaning its first games can be under
 * way. This is the gate for showing real points instead of projections.
 */
export function hasWeekStarted(week: number, now: Date = new Date()): boolean {
  const start = weekBoundary(week);
  return start ? now.getTime() >= start.getTime() : false;
}

/**
 * True once the week's window has closed and nothing in it can change again.
 *
 * The final week has an explicit terminal Wednesday boundary too.
 */
export function isWeekComplete(week: number, now: Date = new Date()): boolean {
  const end = weekBoundary(week + 1);
  return end ? now.getTime() >= end.getTime() : false;
}

/** A team's real game in a week, or undefined for a bye or an open week. */
export function teamGameForWeek(
  schedules: TeamSchedule[],
  teamName: string,
  week: number,
): WeeklyGame | undefined {
  const wanted = teamName.toLowerCase();
  const schedule = schedules.find((entry) => entry.teamName.toLowerCase() === wanted);
  return schedule?.weeklyGames.find((game) => game.week === week && !game.isByeWeek);
}

/**
 * Whether a game has started. A completed game counts even if its kickoff is
 * missing, since CFBD occasionally publishes a result before a start time.
 */
export function hasKickedOff(game: WeeklyGame | undefined, now: Date = new Date()): boolean {
  if (!game || game.isByeWeek) return false;
  if (game.isCompleted) return true;
  if (!game.gameDate) return false;
  const kickoff = game.gameDate instanceof Date ? game.gameDate : new Date(game.gameDate);
  return !Number.isNaN(kickoff.getTime()) && now.getTime() >= kickoff.getTime();
}

/**
 * Lower-cased names of every team whose game in `week` has already kicked off.
 *
 * Teams on a bye, or with no game that week, are absent: there is nothing to
 * lock, so those players stay swappable.
 */
export function lockedTeamsForWeek(
  schedules: TeamSchedule[],
  week: number,
  now: Date = new Date(),
): Set<string> {
  const locked = new Set<string>();

  for (const schedule of schedules) {
    if (schedule.weeklyGames.some(game => game.week === week && hasKickedOff(game, now))) {
      locked.add(schedule.teamName.toLowerCase());
    }
  }

  return locked;
}

/**
 * Lower-cased names of every team whose game in `week` has finished.
 *
 * A strict subset of `lockedTeamsForWeek`: a finished game has necessarily
 * kicked off. Kept separate because "locked" and "over" read very differently
 * to a user — a game that ended on Saturday should not still be described as
 * having just kicked off.
 */
export function finishedTeamsForWeek(schedules: TeamSchedule[], week: number): Set<string> {
  const finished = new Set<string>();

  for (const schedule of schedules) {
    const games = schedule.weeklyGames.filter(entry => entry.week === week && !entry.isByeWeek);
    if (games.length && games.every(game => game.isCompleted)) {
      finished.add(schedule.teamName.toLowerCase());
    }
  }

  return finished;
}

/** Whether a player is frozen for the week because their game has begun. */
export function isPlayerLocked(
  lockedTeams: Set<string>,
  team: string | undefined | null,
): boolean {
  return team ? lockedTeams.has(team.toLowerCase()) : false;
}
