import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completedGameWeeks, isWeekComplete } from '../src/lib/week-lock';
import { countWinningWeeks } from '../src/lib/leaderboard-wins';
import { isPlayedLineup } from '../src/server/lineup-utils';
import { groupNavigationWeeks } from '../src/lib/week-navigation';
import { completedGameWeeksFromCache } from '../src/server/week-completion';
import { lockedPlayersFromData } from '../src/server/lineup-lock';
import { HttpError } from '../src/server/http';

const monday = new Date('2026-09-21T08:00:00Z');
const finals = new Set([3]);
const final = { week: 3, gameId: 'final-3', isByeWeek: false, isCompleted: true, teamPoints: 0, opponentPoints: 7 };

test('early completion requires a nonempty identified slate with every representation final and scored', t => {
  const warnings = t.mock.method(console, 'warn', () => {});
  const candidates = (...games: typeof final[]) => completedGameWeeks([{ weeklyGames: games }]);
  assert.deepEqual([...candidates(final)], [3]);
  assert.deepEqual([...candidates()], []);
  assert.deepEqual([...candidates({ ...final, isByeWeek: true })], []);
  assert.deepEqual([...candidates(final, { ...final, isCompleted: false })], []);
  assert.deepEqual([...candidates(final, { ...final, gameId: 'later', isCompleted: false })], []);
  assert.deepEqual([...candidates({ ...final, teamPoints: NaN })], []);
  assert.deepEqual([...candidates({ ...final, gameId: '' })], []);
  for (const data of [null, {}, [], [{ weeklyGames: null }], [{ weeklyGames: [{ ...final, opponentPoints: null }] }]]) {
    assert.deepEqual([...completedGameWeeksFromCache(data)], []);
  }
  assert.deepEqual([...completedGameWeeksFromCache([{ weeklyGames: [final] }])], [3]);
  assert.equal(warnings.mock.callCount(), 4, 'Malformed evidence must not fail silently');
});

test('Week 3 closes on Monday once its slate is final, without advancing the selected week', () => {
  assert.equal(isWeekComplete(3, monday, finals), true);
  assert.equal(isWeekComplete(3, monday), false);
  assert.equal(isWeekComplete(4, monday, new Set([4])), false, 'Unopened weeks cannot close early');
  const groups = groupNavigationWeeks(monday, finals);
  assert.ok(groups.completed.includes(3));
  assert.ok(!groups.regular.includes(3));
  assert.ok(groups.regular.includes(4));
});

test('malformed completion evidence cannot fall through to an editable member lineup', () => {
  const schedules = [{
    teamId: 'alpha', teamName: 'Alpha', conference: 'Test', byeWeeks: [],
    weeklyGames: [
      { ...final, isHomeGame: true },
      { ...final, isHomeGame: true, week: 4, gameId: 'future', teamPoints: 'invalid' },
    ],
  }];
  assert.throws(() => lockedPlayersFromData(schedules, [{ id: 'qb', team: 'Alpha' }], 3, monday),
    (error: unknown) => error instanceof HttpError && error.status === 503);
});

test('early completion retains participation but awards wins only with an accepted scoring snapshot', () => {
  assert.equal(isPlayedLineup({ week: 3, slots: [{ playerId: 'qb' }] }, false, monday, finals), true);
  assert.equal(isPlayedLineup({ week: 3, slots: [{ playerId: null }] }, false, monday, finals), false);
  assert.equal(isPlayedLineup({ week: 2, slots: [{ playerId: 'qb' }] }, false, monday, new Set()), true);
  const entries = [{ userId: 'member', weeklyPoints: { 3: 0 } }];
  assert.equal(countWinningWeeks(entries, [], monday, finals).get('member'), 0);
  assert.equal(countWinningWeeks(entries, [3], monday, finals).get('member'), 1);
});
