import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveLineupSchema } from '../src/server/lineup-input';
import { lockedPlayersFromData, findLockedSlotChange } from '../src/server/lineup-lock';
import { HttpError, jsonResponse } from '../src/server/http';
import { describeWeekPoints } from '../src/lib/week-actuals';

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
