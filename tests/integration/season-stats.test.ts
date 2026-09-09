import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import { fixture, isolatedDatabaseURL } from './fixture';
import { dataCache } from '../../src/server/schema';
import { liveStatsCacheKey } from '../../src/server/cache-keys';
import { projectSeasonStats, seasonStatsSnapshot, type SeasonStatsProjection } from '../../src/server/season-stats';
import { seasonStatsSchema } from '../../src/lib/season-stats';

test('season SQL sums actual opened weeks, deduplicates players and excludes unavailable sources', async t => {
  const f = await fixture(t, isolatedDatabaseURL());
  await f.run(tx => tx.insert(dataCache).values([
    { key: liveStatsCacheKey(2026, 0), data: { week: 0, unused: 'x'.repeat(50_000), stats: [
      { playerId: 'p', fantasyPoints: 999, passingYards: 999 },
      { playerId: 'p', fantasyPoints: 7.5, passingYards: 150, kickReturnYards: 5, puntReturnYards: 3 },
      { playerId: 'negative', fantasyPoints: -3, rushingYards: -5 },
    ] } },
    { key: liveStatsCacheKey(2026, 1), data: { week: 1, stats: [
      { playerId: 'p', fantasyPoints: 10.2, passingYards: 200, kickReturnYards: 7, puntReturnYards: 4 },
      { playerId: 'zero', fantasyPoints: 0 },
    ] } },
    { key: liveStatsCacheKey(2026, 2), data: { week: 2, stats: null } },
    { key: liveStatsCacheKey(2026, 3), data: { week: 3, stats: [] } },
    { key: liveStatsCacheKey(2026, 4), data: { week: 99, stats: [{ playerId: 'p', fantasyPoints: 999 }] } },
    { key: liveStatsCacheKey(2026, 18), data: { week: 18, stats: [{ playerId: 'p', fantasyPoints: 999 }] } },
    { key: liveStatsCacheKey(2025, 0), data: { week: 0, stats: [{ playerId: 'p', fantasyPoints: 999 }] } },
  ]));
  const read = async (weeks: number[]) => {
    const result = await f.run(tx => tx.execute<SeasonStatsProjection>(projectSeasonStats(2026, weeks)));
    return seasonStatsSchema.parse(seasonStatsSnapshot(2026, weeks, result.rows[0]));
  };
  const season = await read([0, 1]);
  const player = season.stats.find(row => row.playerId === 'p')!;
  assert.equal(player.fantasyPoints, 17.7);
  assert.equal(player.passingYards, 350);
  assert.equal(player.kickReturnYards + player.puntReturnYards, 19);
  assert.equal(player.completions, 0);
  assert.equal(season.stats.find(row => row.playerId === 'negative')!.rushingYards, -5);
  assert.equal(season.stats.find(row => row.playerId === 'zero')!.fantasyPoints, 0);
  assert.deepEqual(season.availableWeeks, [0, 1]);
  assert.deepEqual(season.missingWeeks, []);
  assert.ok(JSON.stringify(season).length < 5000, 'Raw box scores and unrelated cache data must stay in Postgres');
  const partial = await read([0, 1, 2, 3, 4, 5]);
  assert.deepEqual(partial.availableWeeks, [0, 1, 3]);
  assert.deepEqual(partial.missingWeeks, [2, 4, 5]);
  assert.equal(partial.sourceStatus, 'incomplete');
  assert.deepEqual((await read([])).stats, []);
  await f.run(tx => tx.update(dataCache).set({
    data: { week: 1, stats: [{ playerId: 'p', fantasyPoints: 'not a number' }] },
  }).where(eq(dataCache.key, liveStatsCacheKey(2026, 1))));
  await assert.rejects(read([0, 1]));
});
