import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { fixture, isolatedDatabaseURL } from './fixture';
import { dataCache } from '../../src/server/schema';
import { allocateCacheRun, claimCacheSource, failCacheSource, publishCacheSource, sourceMetadataKey, type CacheRun } from '../../src/server/cache-publication';
import { cacheContentVersion } from '../../scripts/lib/cache';

test('isolated source-generation and coherent-publication gate', async t => {
  const f = await fixture(t, isolatedDatabaseURL());
  const key = 'live-stats-2026-week-1';
  const start = async (): Promise<CacheRun> => {
    const result = await f.run(tx => tx.execute<{ generation: string; sourceAttemptedAt: string }>(allocateCacheRun()));
    return { generation: Number(result.rows[0].generation), sourceAttemptedAt: new Date(result.rows[0].sourceAttemptedAt).toISOString() };
  };
  const old = await start();
  await f.run(tx => tx.execute(claimCacheSource(key, old)));
  const newer = await start();
  await f.run(tx => tx.execute(claimCacheSource(key, newer)));
  const data = { week: 1, updatedAt: '2026-09-07T00:00:00Z', stats: [{ playerId: 'qb-a', fantasyPoints: 12, lastUpdated: '2026-09-07T00:00:00Z' }] };
  await f.run(tx => tx.execute(publishCacheSource(key, data, newer, cacheContentVersion(data))));
  const rejected = await f.run(tx => tx.execute<{ accepted: boolean }>(
    publishCacheSource(key, { ...data, stats: [] }, old, 'older-representation'),
  ));
  assert.equal(rejected.rows[0].accepted, false);
  const [before] = await f.run(tx => tx.select().from(dataCache).where(eq(dataCache.key, key)));
  assert.deepEqual(before.data, data);
  const observed = await start();
  await f.run(tx => tx.execute(claimCacheSource(key, observed)));
  const same = { ...data, updatedAt: '2026-09-07T01:00:00Z', stats: data.stats.map(stat => ({ ...stat, lastUpdated: '2026-09-07T01:00:00Z' })) };
  const unchanged = await f.run(tx => tx.execute<{ accepted: boolean; changed: boolean }>(
    publishCacheSource(key, same, observed, cacheContentVersion(same)),
  ));
  assert.deepEqual(unchanged.rows[0], { accepted: true, changed: false });
  const [after] = await f.run(tx => tx.select().from(dataCache).where(eq(dataCache.key, key)));
  assert.deepEqual(after, before);
  const failed = await start();
  await f.run(tx => tx.execute(claimCacheSource(key, failed)));
  await f.run(tx => tx.execute(failCacheSource(key, failed, 'incomplete')));
  const [metadata] = await f.run(tx => tx.select().from(dataCache).where(eq(dataCache.key, sourceMetadataKey(key))));
  assert.equal((metadata.data as { sourceStatus: string }).sourceStatus, 'incomplete');
  assert.deepEqual((await f.run(tx => tx.select().from(dataCache).where(eq(dataCache.key, key))))[0], before);

  // A legacy producer can replace the raw row without updating its sidecar.
  await f.run(tx => tx.update(dataCache).set({
    data: { ...data, stats: [] }, updatedAt: sql`clock_timestamp()`,
  }).where(eq(dataCache.key, key)));
  const repair = await start();
  await f.run(tx => tx.execute(claimCacheSource(key, repair)));
  const repaired = await f.run(tx => tx.execute<{ accepted: boolean; changed: boolean }>(
    publishCacheSource(key, data, repair, cacheContentVersion(data)),
  ));
  assert.deepEqual(repaired.rows[0], { accepted: true, changed: true });
  assert.deepEqual((await f.run(tx => tx.select().from(dataCache).where(eq(dataCache.key, key))))[0].data, data);

  await f.run(tx => tx.delete(dataCache).where(eq(dataCache.key, key)));
  const restore = await start();
  await f.run(tx => tx.execute(claimCacheSource(key, restore)));
  const restored = await f.run(tx => tx.execute<{ accepted: boolean; changed: boolean }>(
    publishCacheSource(key, data, restore, cacheContentVersion(data)),
  ));
  assert.deepEqual(restored.rows[0], { accepted: true, changed: true });
  assert.deepEqual((await f.run(tx => tx.select().from(dataCache).where(eq(dataCache.key, key))))[0].data, data);
});
