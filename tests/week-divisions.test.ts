import assert from 'node:assert/strict';
import { test } from 'node:test';
import { divisionOf, divisionsForWeek, isFcsWeek, isPlayerEligibleForWeek } from '../src/lib/week-divisions';
import type { Player } from '../src/lib/types';

const fbsPlayer: Pick<Player, 'classification'> = { classification: 'fbs' };
const fcsPlayer: Pick<Player, 'classification'> = { classification: 'fcs' };
const unlabelledPlayer: Pick<Player, 'classification'> = {};

test('week 9 is an fcs-only slate that excludes fbs players', () => {
  assert.deepEqual(divisionsForWeek(9), ['fcs']);
  assert.equal(isPlayerEligibleForWeek(fcsPlayer, 9), true);
  assert.equal(isPlayerEligibleForWeek(fbsPlayer, 9), false);
});

test('ordinary weeks are fbs-only and exclude fcs players, including at the boundaries of the season', () => {
  for (const week of [0, 8, 10, 18]) {
    assert.deepEqual(divisionsForWeek(week), ['fbs']);
    assert.equal(isPlayerEligibleForWeek(fbsPlayer, week), true);
    assert.equal(isPlayerEligibleForWeek(fcsPlayer, week), false);
  }
});

test('a player with no classification is treated as fbs, not as ineligible everywhere', () => {
  assert.equal(divisionOf(unlabelledPlayer), 'fbs');
  // Must remain eligible for a normal week so older cached pools still fill lineups.
  assert.equal(isPlayerEligibleForWeek(unlabelledPlayer, 8), true);
  // But must not sneak into the fcs-only Halloween week.
  assert.equal(isPlayerEligibleForWeek(unlabelledPlayer, 9), false);
});

test('isFcsWeek is true only for week 9', () => {
  assert.equal(isFcsWeek(9), true);
  for (const week of [0, 1, 8, 10, 18]) {
    assert.equal(isFcsWeek(week), false);
  }
});
