import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countWinningWeeks } from '../src/lib/leaderboard-wins';
import { weekBoundary } from '../src/lib/season-config';
import { LAST_WEEK } from '../src/lib/types';

test('winning weeks count closed weeks rather than the running or current-week leader', () => {
  const entries = [
    { userId: 'a', weeklyPoints: { 0: 100, 1: 19 } },
    { userId: 'b', weeklyPoints: { 0: 50, 1: 80 } },
    { userId: 'new-member', weeklyPoints: {} },
  ];
  assert.deepEqual([...countWinningWeeks(entries, [0, 1], new Date('2026-09-08T07:00:00Z'))],
    [['a', 1], ['b', 0], ['new-member', 0]]);
  assert.deepEqual([...countWinningWeeks(entries, [0, 1], weekBoundary(2))],
    [['a', 1], ['b', 1], ['new-member', 0]]);
});

test('tied leaders share wins at the same precision as published weekly totals', () => {
  const entries = [
    { userId: 'a', weeklyPoints: { 0: 0.1 + 0.2, 1: 50 } },
    { userId: 'b', weeklyPoints: { 0: 0.3, 1: 50 } },
    { userId: 'c', weeklyPoints: { 0: 0.2, 1: 49 } },
  ];
  assert.deepEqual([...countWinningWeeks(entries, [0, 0, 1], weekBoundary(2))],
    [['a', 2], ['b', 2], ['c', 0]]);
});

test('unavailable snapshots and absent lineups cannot create phantom zero-point wins', () => {
  const entries = [
    { userId: 'a', weeklyPoints: { 0: 0, 1: 100 } },
    { userId: 'b', weeklyPoints: {} },
  ];
  assert.deepEqual([...countWinningWeeks(entries, [], weekBoundary(2))], [['a', 0], ['b', 0]]);
  assert.deepEqual([...countWinningWeeks(entries, [0], weekBoundary(2))], [['a', 1], ['b', 0]]);
});

test('negative and genuine zero scores use the highest actual score', () => {
  const entries = [
    { userId: 'a', weeklyPoints: { 0: -2, 1: 0 } },
    { userId: 'b', weeklyPoints: { 0: -5, 1: 0 } },
  ];
  assert.deepEqual([...countWinningWeeks(entries, [0, 1], weekBoundary(2))], [['a', 2], ['b', 1]]);
});

test('Week 0 and the final week only count once their configured boundary closes', () => {
  for (const week of [0, LAST_WEEK]) {
    const entries = [{ userId: 'a', weeklyPoints: { [week]: 10 } }];
    const end = weekBoundary(week + 1)!;
    assert.equal(countWinningWeeks(entries, [week], new Date(end.getTime() - 1)).get('a'), 0);
    assert.equal(countWinningWeeks(entries, [week], end).get('a'), 1);
  }
});

test('corrected historical scores recompute wins without accumulating stale awards', () => {
  const entries = [
    { userId: 'a', weeklyPoints: { 0: 20 } },
    { userId: 'b', weeklyPoints: { 0: 19 } },
  ];
  assert.deepEqual([...countWinningWeeks(entries, [0], weekBoundary(1))], [['a', 1], ['b', 0]]);
  entries[0].weeklyPoints[0] = 18;
  assert.deepEqual([...countWinningWeeks(entries, [0], weekBoundary(1))], [['a', 0], ['b', 1]]);
});
