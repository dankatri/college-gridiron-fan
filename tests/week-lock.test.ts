import assert from 'node:assert/strict';
import { test } from 'node:test';
import { weekBoundary, weekForDate, weekWindow } from '../src/lib/season-config';
import { finishedTeamsForWeek, hasKickedOff, hasWeekStarted, isWeekComplete, lockedTeamsForWeek } from '../src/lib/week-lock';
import { ALL_WEEKS, LAST_WEEK, type TeamSchedule, type WeeklyGame } from '../src/lib/types';

test('Wednesday half-open boundaries include Week 0 and place Thursday in the following Saturday week', () => {
  assert.equal(weekForDate(new Date('2026-08-26T04:59:59Z')), null);
  assert.equal(weekForDate(new Date('2026-08-26T05:00:00Z')), 0);
  assert.equal(weekForDate(new Date('2026-09-03T23:00:00Z')), 1);
  assert.equal(weekForDate(new Date('2026-09-08T23:00:00Z')), 1);
  assert.equal(weekForDate(new Date('2026-09-09T05:00:00Z')), 2);
  assert.deepEqual(weekWindow(1), { start: weekBoundary(1), end: weekBoundary(2) });
  assert.equal(hasWeekStarted(1, new Date('2026-09-02T04:59:59Z')), false);
  assert.equal(isWeekComplete(1, new Date('2026-09-09T04:59:59Z')), false);
  assert.equal(isWeekComplete(1, new Date('2026-09-09T05:00:00Z')), true);
});

test('the final Wednesday closes the championship week without adding a selectable week', () => {
  const end = weekBoundary(LAST_WEEK + 1)!;
  assert.equal(end.toISOString(), '2027-01-27T06:00:00.000Z');
  assert.equal(end.getUTCDay(), 3);
  assert.equal(weekForDate(new Date('2027-01-25T23:00:00Z')), LAST_WEEK);
  assert.equal(isWeekComplete(LAST_WEEK, new Date(end.getTime() - 1)), false);
  assert.equal(isWeekComplete(LAST_WEEK, end), true);
  assert.equal(weekForDate(end), null);
  assert.equal(weekWindow(LAST_WEEK + 1), null);
  assert.equal(ALL_WEEKS.includes(LAST_WEEK + 1), false);
});

test('kickoff locks and completion are distinct, including a completion with no timestamp', () => {
  const game: WeeklyGame = { week: 1, isHomeGame: true, isByeWeek: false, gameDate: new Date('2026-09-05T17:00:00Z') };
  const schedule: TeamSchedule = { teamId: 'a', teamName: 'Alpha', conference: 'Test', byeWeeks: [], weeklyGames: [game] };
  assert.equal(hasKickedOff(game, new Date('2026-09-05T16:59:59Z')), false);
  assert.deepEqual([...lockedTeamsForWeek([schedule], 1, game.gameDate)], ['alpha']);
  assert.deepEqual([...finishedTeamsForWeek([schedule], 1)], []);
  assert.equal(hasKickedOff({ ...game, gameDate: undefined, isCompleted: true }), true);
  assert.deepEqual([...finishedTeamsForWeek([{ ...schedule, weeklyGames: [{ ...game, isCompleted: true }] }], 1)], ['alpha']);
  assert.equal(hasKickedOff({ ...game, isByeWeek: true }), false);
});
