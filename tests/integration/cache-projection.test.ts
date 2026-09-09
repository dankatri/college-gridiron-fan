import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq, like, sql } from 'drizzle-orm';
import { fixture, isolatedDatabaseURL } from './fixture';
import { dataCache } from '../../src/server/schema';
import { liveStatsCacheKey, playersCacheKey, schedulesCacheKey } from '../../src/server/cache-keys';
import { projectPlayerLog, projectPlayers, projectTeamSchedule, projectWeeklyScores } from '../../src/server/cache-projections';

type Stat = { playerId: string; week: number; fantasyPoints: number; passingYards: number; lastUpdated: string };
type Payload = { week?: number; stats?: Stat[] | null; statsAvailable?: boolean };
type Row = { key: string; data: Payload; updatedAt: Date };

test('isolated SQL projection parity and returned-byte gate', async t => {
  const f = await fixture(t, isolatedDatabaseURL());
  const rows = Array.from({ length: 19 }, (_, week) => ({
    key: liveStatsCacheKey(2026, week),
    data: {
      week,
      stats: week === 5 ? null : week === 7 ? [] : [
        { playerId: 'qb-a', week, fantasyPoints: week - 3, passingYards: 120, lastUpdated: '2026-09-07T00:00:00Z' },
        ...Array.from({ length: 300 }, (_, index) => ({
          playerId: `unrelated-${index}`, week, fantasyPoints: index, passingYards: 200,
          lastUpdated: '2026-09-07T00:00:00Z',
        })),
        { playerId: 'qb-a', week, fantasyPoints: week + 4, passingYards: 180, lastUpdated: '2026-09-07T00:00:00Z' },
      ],
    },
  }));
  await f.run(tx => tx.insert(dataCache).values(rows));
  const legacy = await f.run(tx => tx.select().from(dataCache).where(like(dataCache.key, 'live-stats-2026-week-%')).orderBy(dataCache.key));
  const playerLog = await f.run(tx => tx.execute<Row>(projectPlayerLog(2026, 'qb-a')));
  const expectedLog = legacy.flatMap(row => {
    const stat = (row.data as Payload).stats?.find(item => item.playerId === 'qb-a');
    return stat ? [{ key: row.key, stat }] : [];
  });
  assert.deepEqual(playerLog.rows.map(row => ({ key: row.key, stat: row.data.stats![0] })), expectedLog);
  const absent = await f.run(tx => tx.execute<Row>(projectPlayerLog(2026, 'not-found')));
  assert.deepEqual(absent.rows, []);
  const requested = { 0: ['qb-a'], 1: ['qb-a'], 18: ['qb-a'] };
  const projected = await f.run(tx => tx.execute<Row>(projectWeeklyScores(2026, requested)));
  for (const row of projected.rows) {
    const full = legacy.find(candidate => candidate.key === row.key)!.data as Payload;
    const oldScores = new Map((full.stats ?? []).map(stat => [stat.playerId, stat.fantasyPoints]));
    const newScores = new Map((row.data.stats ?? []).map(stat => [stat.playerId, stat.fantasyPoints]));
    assert.equal(newScores.get('qb-a'), oldScores.get('qb-a'));
    assert.equal(newScores.size, 1);
  }
  assert.equal(projected.rows.length, 3);
  const empty = await f.run(tx => tx.execute<Row>(projectWeeklyScores(2026, { 5: ['qb-a'], 7: ['qb-a'] })));
  assert.deepEqual(empty.rows.map(row => row.data.stats), [[], []]);
  assert.deepEqual(empty.rows.map(row => row.data.statsAvailable), [false, true]);
  const unrequested = await f.run(tx => tx.execute<Row>(projectWeeklyScores(2026, {})));
  assert.deepEqual(unrequested.rows, []);
  const before = Buffer.byteLength(JSON.stringify(legacy));
  const after = Buffer.byteLength(JSON.stringify(projected.rows));
  assert.ok(after < before, 'Only requested facts should cross the DB boundary');
  t.diagnostic(JSON.stringify({ legacyBytes: before, projectedBytes: after }));
  const plan = await f.run(tx => tx.execute(sql`explain (analyze, buffers, format json) ${projectWeeklyScores(2026, requested)}`));
  t.diagnostic(JSON.stringify({ projectedQueryPlan: plan.rows }));

  const catalogue = [
    { id: 'qb-a', name: 'Alpha', team: 'Alpha', headshot: '/alpha.png', stats: { passingYards: 120 } },
    ...Array.from({ length: 7646 }, (_, index) => ({ id: `other-${index}`, name: `Other ${index}` })),
    { id: 'qb-a', name: 'Later duplicate', team: 'Beta', headshot: null, stats: { passingYards: 0 } },
  ];
  await f.run(tx => tx.update(dataCache).set({ data: catalogue }).where(eq(dataCache.key, playersCacheKey(2026))));
  const selected = await f.run(tx => tx.execute<{ data: unknown[] }>(projectPlayers(2026, ['qb-a'])));
  assert.deepEqual(selected.rows[0].data, [catalogue[0], catalogue[catalogue.length - 1]]);
  const none = await f.run(tx => tx.execute<{ data: unknown[] }>(projectPlayers(2026, ['missing'])));
  assert.deepEqual(none.rows[0].data, []);
  const schedules = await f.run(tx => tx.select().from(dataCache).where(eq(dataCache.key, schedulesCacheKey(2026))));
  const schedule = await f.run(tx => tx.execute<{ data: unknown[] }>(projectTeamSchedule(2026, 'Alpha')));
  assert.deepEqual(schedule.rows[0].data, schedules[0].data);
  const missingTeam = await f.run(tx => tx.execute<{ data: unknown[] }>(projectTeamSchedule(2026, 'Missing')));
  assert.deepEqual(missingTeam.rows[0].data, []);
});
