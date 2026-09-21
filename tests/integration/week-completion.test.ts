import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq, inArray, sql } from 'drizzle-orm';
import { fixture, isolatedDatabaseURL } from './fixture';
import { dataCache } from '../../src/server/schema';
import { schedulesCacheKey } from '../../src/server/cache-keys';
import { projectCompletedGameWeeks } from '../../src/server/cache-projections';
import { completedGameWeeksFromCache } from '../../src/server/week-completion';
import { allocateCacheRun, claimCacheSource, failCacheSource, publishCacheSource, sourceMetadataKey, type CacheRun } from '../../src/server/cache-publication';
import { cacheContentVersion } from '../../scripts/lib/cache';

test('completed-week SQL matches pure schedule evidence, including malformed and conflicting snapshots', async t => {
  const f = await fixture(t, isolatedDatabaseURL());
  const game = { week: 3, gameId: 'final', isByeWeek: false, isCompleted: true, teamPoints: 0, opponentPoints: 7 };
  const snapshots: unknown[] = [
    null, {}, [], [{ weeklyGames: null }], [{ weeklyGames: [] }],
    [{ weeklyGames: [game] }],
    [{ weeklyGames: [game, { ...game, week: 18, gameId: 'championship' }] }],
    [{ weeklyGames: [{ ...game, isByeWeek: true }] }],
    [{ weeklyGames: [game, { ...game, isCompleted: false }] }],
    [{ weeklyGames: [game] }, { weeklyGames: [{ ...game, isCompleted: false }] }],
    [{ weeklyGames: [{ ...game, gameId: '' }] }],
    [{ weeklyGames: [{ ...game, teamPoints: undefined }] }],
    [{ weeklyGames: [{ ...game, opponentPoints: null }] }],
    [{ weeklyGames: [game, { ...game, week: 'invalid' }] }],
    [{ weeklyGames: [game, { ...game, week: 3.5 }] }],
    [{ weeklyGames: [game, { ...game, isCompleted: 'true' }] }],
  ];
  await f.run(async tx => {
    await tx.insert(dataCache).values({
      key: `source:${schedulesCacheKey(2026)}`, data: { sourceStatus: 'failed' },
    });
    for (const data of snapshots) {
      await tx.execute(sql`update data_cache set data = ${JSON.stringify(data)}::jsonb
        where key = ${schedulesCacheKey(2026)}`);
      const result = await tx.execute<{ week: number }>(projectCompletedGameWeeks(2026));
      assert.deepEqual(result.rows.map(row => row.week), [...completedGameWeeksFromCache(data)].sort((a, b) => a - b), JSON.stringify(data));
      assert.ok(JSON.stringify(result.rows).length < 1024, 'Only candidate week numbers should cross the database boundary');
    }
  });
});

test('a metadata-publication failure rolls back schedule corrections without losing accepted finals', async t => {
  const f = await fixture(t, isolatedDatabaseURL());
  const key = schedulesCacheKey(2026);
  const data = [{ weeklyGames: [{
    week: 3, gameId: 'final', isByeWeek: false, isCompleted: true, teamPoints: 21, opponentPoints: 7,
  }] }];
  const { before, run } = await f.run(async tx => {
    const start = async (): Promise<CacheRun> => {
      const result = await tx.execute<{ generation: string; sourceAttemptedAt: string }>(allocateCacheRun());
      return { generation: Number(result.rows[0].generation), sourceAttemptedAt: new Date(result.rows[0].sourceAttemptedAt).toISOString() };
    };
    const first = await start();
    await tx.execute(claimCacheSource(key, first));
    await tx.execute(publishCacheSource(key, data, first, cacheContentVersion(data)));
    const run = await start();
    await tx.execute(claimCacheSource(key, run));
    const before = await tx.select().from(dataCache).where(inArray(dataCache.key, [key, sourceMetadataKey(key)])).orderBy(dataCache.key);
    await tx.execute(sql`
      create function fail_ready_metadata() returns trigger language plpgsql as
      $$ begin
        if new.key like 'source:%' and new.data->>'sourceStatus' = 'ready' then
          raise exception 'injected metadata publication failure';
        end if;
        return new;
      end $$;
      create trigger fail_ready_metadata before update on data_cache
        for each row execute function fail_ready_metadata();
    `);
    return { before, run };
  });
  const corrected = [{ weeklyGames: [{ ...data[0].weeklyGames[0], teamPoints: 14 }] }];
  await assert.rejects(f.run(tx => tx.execute(publishCacheSource(key, corrected, run, cacheContentVersion(corrected)))));
  await f.run(async tx => {
    const after = await tx.select().from(dataCache).where(inArray(dataCache.key, [key, sourceMetadataKey(key)])).orderBy(dataCache.key);
    assert.deepEqual(after, before);
    await tx.execute(failCacheSource(key, run, 'failed'));
    const [accepted] = await tx.select().from(dataCache).where(eq(dataCache.key, key));
    assert.deepEqual([...completedGameWeeksFromCache(accepted.data)], [3]);
    assert.deepEqual((await tx.execute<{ week: number }>(projectCompletedGameWeeks(2026))).rows, [{ week: 3 }]);
  });
});
