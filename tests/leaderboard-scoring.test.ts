import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scoreLineups } from '../src/server/leaderboard-scoring';
import { hasStartedGames } from '../src/server/lineup-utils';
import { countWinningWeeks } from '../src/lib/leaderboard-wins';

const now = new Date('2026-09-09T07:30:00Z');
const saved = [
  { userId: 'member', week: 1, slots: [{ playerId: 'qb-a' }], projectedPoints: '90' },
  { userId: 'member', week: 2, slots: [{ playerId: 'qb-b' }], projectedPoints: '99' },
];
const scores = new Map([[1, new Map([['qb-a', 19]])], [2, new Map<string, number>()]]);

test('a completed lineup and a pending current-week lineup count as one week, not two', () => {
  const result = scoreLineups(saved, scores, new Set([1]), now);
  assert.deepEqual(result.totals.get('member'), {
    totalPoints: 19, weeksScored: 1, weeklyPoints: { 1: 19 }, projectedPoints: { 1: 90, 2: 99 },
  });
  assert.deepEqual([...result.scoredWeeks], [1]);
  const totals = result.totals.get('member')!;
  assert.equal(totals.totalPoints / totals.weeksScored, 19);
});

test('in-progress weeks count even before a selected player records points, including zero and negative scores', () => {
  const zero = scoreLineups(saved, scores, new Set([1, 2]), now).totals.get('member')!;
  assert.equal(zero.weeksScored, 2);
  assert.deepEqual(zero.weeklyPoints, { 1: 19, 2: 0 });
  const negative = scoreLineups(saved, new Map([...scores, [2, new Map([['qb-b', -2]])]]), new Set([1, 2]), now).totals.get('member')!;
  assert.equal(negative.weeksScored, 2);
  assert.equal(negative.totalPoints, 17);
});

test('missing or empty lineups never earn participation or win against negative scores', () => {
  const rows = [saved[0], { ...saved[0], userId: 'empty', slots: [{ playerId: null }] }];
  const result = scoreLineups(rows, new Map([[1, new Map([['qb-a', -2]])]]), new Set([1]), now);
  assert.equal(result.totals.get('empty')!.weeksScored, 0);
  assert.deepEqual(result.totals.get('empty')!.weeklyPoints, {});
  const wins = countWinningWeeks([...result.totals].map(([userId, total]) => ({ userId, weeklyPoints: total.weeklyPoints })), new Set([1]), now);
  assert.equal(wins.get('member'), 1);
  assert.equal(wins.get('empty'), 0);
  assert.equal(scoreLineups([], scores, new Set([1]), now).totals.size, 0);
});

test('play evidence distinguishes empty future snapshots from zero-score or in-progress games', () => {
  for (const payload of [{}, { stats: null, games: null }, { stats: [], games: [{ status: 'scheduled' }] }]) {
    assert.equal(hasStartedGames(payload), false);
  }
  for (const payload of [
    { stats: [{ fantasyPoints: 0 }] }, { games: [{ status: 'in-progress' }] }, { games: [{ status: 'final' }] },
    { hasStartedGames: true, stats: [] },
  ]) assert.equal(hasStartedGames(payload), true);
});
