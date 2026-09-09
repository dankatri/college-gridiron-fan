import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hydrateSlots, mergePlayerPool, toSlotPayload } from '../src/lib/lineup-state';
import { isPlayedLineup, normalizeSlots, toUsageMap, validateLineupSlots } from '../src/server/lineup-utils';
import type { LineupSlotInput } from '../src/server/lineup-utils';
import type { Player } from '../src/lib/types';
import { weekBoundary } from '../src/lib/season-config';

const slots: LineupSlotInput[] = ['QB', 'QB', 'RB', 'RB', 'WR', 'WR'].map(
  (position: LineupSlotInput['position'], slotIndex) => ({ slotIndex, position, playerId: null }),
);

test('partial lineups keep unresolved saved IDs through hydration and serialization', () => {
  const partial = slots.map((slot, index) => ({ ...slot, playerId: index === 0 ? 'qb-1' : null }));
  assert.deepEqual(validateLineupSlots(partial), { ok: true });
  assert.deepEqual(toSlotPayload(hydrateSlots(partial, new Map())), partial);
  assert.deepEqual(normalizeSlots([...partial].reverse()), partial);
});

test('invalid duplicate player and slot references are rejected', () => {
  assert.equal(validateLineupSlots(slots.slice(1)).ok, false);
  assert.equal(validateLineupSlots(slots.map(slot => ({ ...slot, slotIndex: 0 }))).ok, false);
  assert.equal(validateLineupSlots(slots.map(slot => ({ ...slot, playerId: 'same' }))).ok, false);
});

test('usage is derived from filled slots across saved weeks, never empty slots', () => {
  const partial = slots.map((slot, index) => ({ ...slot, playerId: index === 0 ? 'qb-1' : null }));
  assert.deepEqual([...toUsageMap([{ slots: partial }, { slots: partial }, { slots }])], [['qb-1', 2]]);
});

test('weeks played exclude empty saved lineups and include partial lineups regardless of score', () => {
  const now = new Date('2026-09-07T12:00:00Z');
  const partial = slots.map((slot, index) => ({ ...slot, playerId: index === 0 ? 'qb-1' : null }));
  assert.equal(isPlayedLineup({ week: 0, slots: [] }, now), false);
  assert.equal(isPlayedLineup({ week: 0, slots }, now), false);
  assert.equal(isPlayedLineup({ week: 1, slots }, now), false);
  for (const actualPoints of [null, 0, -2, 19]) {
    const lineup = { week: 0, slots: partial, actualPoints };
    assert.equal(isPlayedLineup(lineup, now), true);
  }
  const saved = [{ week: 0, slots }, { week: 1, slots: partial }, { week: 2, slots: partial }];
  assert.deepEqual(saved.filter(row => isPlayedLineup(row, now)).map(row => row.week), [1]);
  assert.deepEqual(saved.filter(row => isPlayedLineup({ ...row, slots }, now)), []);
});

test('a selected lineup counts from the week opening boundary, never before it', () => {
  const boundary = weekBoundary(2)!;
  const lineup = { week: 2, slots: [{ ...slots[0], playerId: 'qb-1' }] };
  assert.equal(isPlayedLineup(lineup, new Date(boundary.getTime() - 1)), false);
  assert.equal(isPlayedLineup(lineup, boundary), true);
  assert.equal(isPlayedLineup({ ...lineup, slots }, boundary), false);
});

test('historical slot layouts still count toward usage without rewriting saved data', () => {
  const historical = [{ slotIndex: 7, position: 'QB', playerId: 'qb-1' }];
  const before = structuredClone(historical);
  assert.deepEqual([...toUsageMap([{ slots: historical }])], [['qb-1', 1]]);
  assert.deepEqual(historical, before);
});

test('filtered player results cannot remove selected player identities', () => {
  const player: Player = { id: 'qb-1', name: 'Example Player', team: 'Alpha', conference: 'Test', position: 'QB', projectedPoints: 10 };
  const original = [player];
  assert.equal(mergePlayerPool(original, []), original);
  assert.equal(mergePlayerPool(original, [player]), original);
  assert.equal(hydrateSlots([{ slotIndex: 0, position: 'QB', playerId: player.id }], new Map(original.map(p => [p.id, p])))[0].player, player);
});
