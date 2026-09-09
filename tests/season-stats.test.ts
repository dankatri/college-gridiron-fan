import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seasonStatValue, seasonPlayerStatsSchema, SEASON_STAT_FIELDS } from '../src/lib/season-stats';
import { seasonStatsSnapshot, type SeasonStatsProjection } from '../src/server/season-stats';
import { liveStatsCacheKey } from '../src/server/cache-keys';
import { sourceMetadataKey } from '../src/server/cache-publication';

test('season columns use actual values, combine returns and distinguish missing data from zero', () => {
  const stats = seasonPlayerStatsSchema.parse({
    ...Object.fromEntries(SEASON_STAT_FIELDS.map(field => [field, 0])),
    playerId: 'p', fantasyPoints: -2.5, kickReturnYards: 10, puntReturnYards: 7,
  });
  assert.equal(seasonStatValue(stats, 'returnYards', true), 17);
  assert.equal(seasonStatValue(stats, 'fantasyPoints', true), -2.5);
  assert.equal(seasonStatValue(undefined, 'fantasyPoints', true), 0);
  assert.equal(seasonStatValue(undefined, 'passingYards', false), undefined);
  assert.equal(seasonStatValue(stats, 'fantasyPoints', false), -2.5);
});

test('season metadata preserves unavailable weeks and source refresh failures', () => {
  const key = liveStatsCacheKey(2026, 0);
  const updatedAt = '2026-09-07T12:00:00.000Z';
  const revision = '2026-09-07T12:00:00.000000Z';
  const projection: SeasonStatsProjection = {
    stats: [],
    snapshots: [
      { key, data: { statsAvailable: true }, updatedAt, revision },
      { key: sourceMetadataKey(key), updatedAt, revision, data: {
        dataRevision: revision, sourceStatus: 'failed', sourceCheckedAt: updatedAt,
        sourceAttemptedAt: '2026-09-08T12:00:00.000Z',
      } },
    ],
  };
  const missing = seasonStatsSnapshot(2026, [0, 1], projection);
  assert.deepEqual(missing.availableWeeks, [0]);
  assert.deepEqual(missing.missingWeeks, [1]);
  assert.equal(missing.sourceStatus, 'incomplete');
  assert.equal(missing.sourceAttemptedAt, '2026-09-08T12:00:00.000Z');
  assert.equal(seasonStatsSnapshot(2026, [0], projection).sourceStatus, 'failed');
  const beforeSeason = seasonStatsSnapshot(2026, [], { stats: [], snapshots: [] });
  assert.deepEqual(beforeSeason.missingWeeks, []);
  assert.equal(beforeSeason.sourceStatus, 'ready');
});
