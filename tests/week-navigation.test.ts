import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_WEEKS } from '../src/lib/types';
import { REGULAR_SEASON_LAST_WEEK, weekBoundary } from '../src/lib/season-config';
import { groupNavigationWeeks } from '../src/lib/week-navigation';

test('week navigation groups only closed weeks and puts championships after rivalry in Post season', () => {
  const groups = groupNavigationWeeks(new Date('2026-09-09T06:00:00Z'));
  assert.deepEqual(groups.completed, [0, 1]);
  assert.deepEqual(groups.regular, ALL_WEEKS.filter(week => week >= 2 && week <= 13));
  assert.deepEqual(groups.postseason, [14, 15, 16, 17, 18]);
  assert.equal(REGULAR_SEASON_LAST_WEEK, 14, 'Navigation does not change the data API season classification');
});

test('completed week grouping follows the exact closing boundary', () => {
  const boundary = weekBoundary(2)!;
  const before = groupNavigationWeeks(new Date(boundary.getTime() - 1));
  const after = groupNavigationWeeks(boundary);
  assert.ok(before.regular.includes(1));
  assert.ok(!before.completed.includes(1));
  assert.ok(after.completed.includes(1));
  assert.ok(!after.regular.includes(1));
});

test('postseason weeks move into Completed weeks only after closing', () => {
  const groups = groupNavigationWeeks(weekBoundary(15)!);
  assert.deepEqual(groups.regular, []);
  assert.ok(groups.completed.includes(14));
  assert.deepEqual(groups.postseason, [15, 16, 17, 18]);
});

test('navigation remains complete before and after the season with no duplicate weeks', () => {
  const preseason = groupNavigationWeeks(new Date('2026-08-01T00:00:00Z'));
  assert.deepEqual(preseason.completed, []);
  assert.ok(preseason.regular.includes(0) && preseason.regular.includes(13));
  const finalBoundary = weekBoundary(19)!;
  assert.deepEqual(groupNavigationWeeks(new Date(finalBoundary.getTime() - 1)).postseason, [18]);
  const finished = groupNavigationWeeks(finalBoundary);
  assert.deepEqual(finished, { completed: ALL_WEEKS, regular: [], postseason: [] });
  for (const groups of [preseason, groupNavigationWeeks(weekBoundary(14)!), finished]) {
    assert.deepEqual([...groups.completed, ...groups.regular, ...groups.postseason], ALL_WEEKS);
  }
});
