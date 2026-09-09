import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hydrateSlots, mergePlayerPool, toSlotPayload } from '../src/lib/lineup-state';
import { normalizeSlots, toUsageMap, validateLineupSlots } from '../src/server/lineup-utils';
import type { LineupSlotInput } from '../src/server/lineup-utils';
import type { Player } from '../src/lib/types';

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
