import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveLineupSchema } from '../src/server/lineup-input';
import { findIneligibleSlot, findLockedSlotChange, lockedPlayersFromData, playerIdentitiesFromData } from '../src/server/lineup-lock';
import { HttpError, jsonResponse } from '../src/server/http';
import { describeWeekPoints } from '../src/lib/week-actuals';
import { FCS_WEEK } from '../src/lib/week-divisions';

const slots = ['QB', 'QB', 'RB', 'RB', 'WR', 'WR'].map((position, slotIndex) => ({ position, slotIndex, playerId: null }));

test('write contracts accept Week 0 partial slots and reject malformed references', () => {
  assert.equal(saveLineupSchema.safeParse({ week: 0, slots }).success, true);
  for (const week of [-1, 19, 1.5, '1', null]) {
    assert.equal(saveLineupSchema.safeParse({ week, slots }).success, false);
  }
  for (const invalid of [null, [{ position: 'QB' }], slots.map(slot => ({ ...slot, slotIndex: -1 }))]) {
    assert.equal(saveLineupSchema.safeParse({ week: 0, slots: invalid }).success, false);
  }
});

test('missing or malformed source data cannot produce an unlocked server snapshot', () => {
  for (const data of [undefined, null, [], [{}]]) {
    assert.throws(() => lockedPlayersFromData(data, [], 1, new Date()), HttpError);
  }
});

test('completion locks a player, while absence of that team is conservatively locked', () => {
  const locked = lockedPlayersFromData(
    [{ teamId: 'a', teamName: 'Alpha', conference: 'Test', byeWeeks: [], weeklyGames: [
      { week: 1, isByeWeek: false, isHomeGame: true, isCompleted: true },
    ] }],
    [{ id: 'a', name: 'Alpha Player', team: 'Alpha' }, { id: 'b', team: 'Missing' }],
    1, new Date('2026-09-07T00:00:00Z'),
  );
  assert.deepEqual([...locked.ids].sort(), ['a', 'b']);
  const selected = saveLineupSchema.parse({ week: 1, slots: slots.map((slot, index) => ({ ...slot, playerId: index === 0 ? 'a' : null })) }).slots;
  assert.match(findLockedSlotChange(selected, saveLineupSchema.parse({ week: 1, slots }).slots, locked)!, /cannot be removed/);
});

test('unavailable weekly scoring is not a final zero and private responses never enter shared caches', () => {
  const points = describeWeekPoints({
    showActuals: true, status: 'missing', weekName: 'Week 1',
    game: { week: 1, isByeWeek: false, isHomeGame: true, isCompleted: true },
  });
  assert.equal(points.label, 'Unavailable');
  assert.equal(points.text, '?');
  assert.equal(jsonResponse({}).headers.get('cache-control'), 'private, no-store');
});

const filledSlots = (playerId: string | null) => slots.map((slot, index) => ({ ...slot, playerId: index === 0 ? playerId : null }));

test('week 9 only accepts FCS players and every other week only accepts FBS players, by cached id', () => {
  const identities = playerIdentitiesFromData([
    { id: 'fbs-1', name: 'Fenwick Back', team: 'Alpha', classification: 'fbs' },
    { id: 'fcs-1', name: 'Founders Wideout', team: 'Beta', classification: 'fcs' },
    { id: 'legacy-1', name: 'Legacy Runner', team: 'Alpha' },
  ]);

  // a. An FBS player in week 9 is rejected, and the error names the player.
  const week9Fbs = findIneligibleSlot(saveLineupSchema.parse({ week: FCS_WEEK, slots: filledSlots('fbs-1') }).slots, identities, FCS_WEEK);
  assert.match(week9Fbs!, /Fenwick Back/);

  // b. An FCS player in week 9 is accepted.
  assert.equal(findIneligibleSlot(saveLineupSchema.parse({ week: FCS_WEEK, slots: filledSlots('fcs-1') }).slots, identities, FCS_WEEK), null);

  // c. An FCS player in an ordinary week is rejected.
  const ordinaryFcs = findIneligibleSlot(saveLineupSchema.parse({ week: 8, slots: filledSlots('fcs-1') }).slots, identities, 8);
  assert.match(ordinaryFcs!, /Founders Wideout/);

  // d. A player absent from the cached `classification` field (a legacy snapshot)
  // is treated as FBS: fine for an ordinary week, rejected for the FCS-only week.
  assert.equal(findIneligibleSlot(saveLineupSchema.parse({ week: 8, slots: filledSlots('legacy-1') }).slots, identities, 8), null);
  assert.match(
    findIneligibleSlot(saveLineupSchema.parse({ week: FCS_WEEK, slots: filledSlots('legacy-1') }).slots, identities, FCS_WEEK)!,
    /Legacy Runner/,
  );

  // An id the cache has never heard of is not this gate's concern — that is the
  // separate "not in the current player data" 503 handled in save-lineup.ts.
  assert.equal(findIneligibleSlot(saveLineupSchema.parse({ week: FCS_WEEK, slots: filledSlots('unknown') }).slots, identities, FCS_WEEK), null);
});

test('the division gate is wired the same way on the admin save path, which skips locks but not eligibility', () => {
  // e. save-lineup.ts builds admin identities with exactly this helper, reading the
  // players cache straight (no schedule, no kickoff-lock bookkeeping needed).
  const identities = playerIdentitiesFromData([{ id: 'fbs-1', name: 'Fenwick Back', team: 'Alpha', classification: 'fbs' }]);
  const week9Slots = saveLineupSchema.parse({ week: FCS_WEEK, slots: filledSlots('fbs-1') }).slots;
  assert.match(findIneligibleSlot(week9Slots, identities, FCS_WEEK)!, /Fenwick Back/);
  // A players cache that fails to parse (e.g. missing during an admin correction)
  // yields no known identities rather than throwing — there is simply nothing to reject.
  assert.equal(findIneligibleSlot(week9Slots, playerIdentitiesFromData(undefined), FCS_WEEK), null);
});
