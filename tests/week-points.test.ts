import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Player, WeeklyGame } from '../src/lib/types';
import { createEmptyStats } from '../src/lib/stats-utils';
import { describeWeekPoints, resolveWeekPoints } from '../src/lib/week-actuals';
import { LineupPositionGroup } from '../src/components/LineupPositionGroup';
import { LineupSummary } from '../src/components/LineupSummary';
import { PlayerCard } from '../src/components/PlayerCard';

const game: WeeklyGame = { week: 1, isByeWeek: false, isHomeGame: true, isCompleted: false };
const player: Player = {
  id: 'qb-test', name: 'Example Quarterback', team: 'Example', conference: 'Test',
  position: 'QB', projectedPoints: 9876.5,
};
const slots = [{ position: player.position, slotIndex: 0, player }];

test('recorded positive, zero and negative scores remain visible without predicted comparisons', () => {
  for (const fantasyPoints of [19, 0, -2]) {
    const stats = { ...createEmptyStats(player.id, 1), fantasyPoints };
    assert.deepEqual(resolveWeekPoints(stats, game, 'missing'), { kind: 'actual', points: fantasyPoints });
    const display = describeWeekPoints({ showActuals: true, stats, game, weekName: 'Week 1' });
    assert.equal(display.label, 'Scored');
    assert.equal(display.text, fantasyPoints.toFixed(1));
    const html = renderToStaticMarkup(createElement(LineupSummary, { lineup: slots, actualPoints: fantasyPoints }));
    assert.match(html, /Actual Points/);
    assert.ok(html.includes(fantasyPoints.toFixed(1)));
    assert.doesNotMatch(html, /9876\.5|project|vs\./i);
  }
});

test('unfinished and future games await recorded stats rather than showing projections or zero', () => {
  for (const status of ['ready', 'loading', 'missing'] as const) {
    assert.deepEqual(resolveWeekPoints(undefined, game, status), { kind: 'pending' });
    for (const showActuals of [true, false]) {
      const display = describeWeekPoints({ showActuals, status, game, weekName: 'Week 1' });
      assert.equal(display.label, 'Pending');
      assert.equal(display.text, '-');
      assert.equal(display.summary, 'Awaiting stats');
      assert.doesNotMatch(display.title, /project/i);
    }
  }
});

test('no game, unavailable data and a confirmed final zero remain distinct', () => {
  const final = { ...game, isCompleted: true };
  assert.deepEqual(resolveWeekPoints(undefined, final), { kind: 'zero', points: 0 });
  assert.deepEqual(resolveWeekPoints(undefined, final, 'missing'), { kind: 'unavailable' });
  assert.deepEqual(resolveWeekPoints(undefined, undefined, 'missing'), { kind: 'unavailable' });
  assert.deepEqual(resolveWeekPoints(undefined, undefined), { kind: 'none' });
  assert.deepEqual(resolveWeekPoints(undefined, { ...game, isByeWeek: true }, 'missing'), { kind: 'none' });
  assert.equal(describeWeekPoints({ showActuals: false, game: { ...game, isByeWeek: true }, weekName: 'Week 2' }).label, 'No game');
  assert.equal(describeWeekPoints({ showActuals: true, game: final, weekName: 'Week 1' }).text, '0.0');
  assert.equal(describeWeekPoints({ showActuals: true, game: final, status: 'missing', weekName: 'Week 1' }).label, 'Unavailable');
});

test('a finished week keeps its recorded zeros while its snapshot arrives or is re-observed', () => {
  const final = { ...game, isCompleted: true };
  // Data still on its way is awaited, never concluded to be absent.
  assert.deepEqual(resolveWeekPoints(undefined, final, 'loading'), { kind: 'pending' });
  assert.deepEqual(resolveWeekPoints(undefined, undefined, 'loading'), { kind: 'pending' });
  assert.equal(
    describeWeekPoints({ showActuals: true, game: final, status: 'loading', weekName: 'Week 1' }).summary,
    'Awaiting stats',
  );
  // An accepted snapshot stays usable across refreshes, so a player absent from
  // a finished box score keeps reading as the zero it is.
  const display = describeWeekPoints({ showActuals: true, game: final, status: 'ready', weekName: 'Week 1' });
  assert.equal(display.label, 'Scored');
  assert.equal(display.text, '0.0');
});

test('cards and lineup rows never fall back to stored projected points when scores are absent', () => {
  const summary = renderToStaticMarkup(createElement(LineupSummary, { lineup: slots }));
  const row = renderToStaticMarkup(createElement(LineupPositionGroup, { position: 'QB', slots }));
  const card = renderToStaticMarkup(createElement(PlayerCard, { player, playerUsage: [] }));
  for (const html of [summary, row, card]) assert.doesNotMatch(html, /9876\.5|\bproj(?:ected|ection)?\b/i);
  assert.doesNotMatch(summary, /Actual Points/);
  assert.match(summary, /Lineup Progress/);
  assert.match(row, /Awaiting stats/);
});
