import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { eq, sql } from 'drizzle-orm';
import { fixture, isolatedDatabaseURL, partial } from './fixture';
import { saveLineupInTransaction } from '../../src/server/save-lineup';
import { leagueMembers, lineupAuditLog, lineups, playerUsage } from '../../src/server/schema';
import { HttpError } from '../../src/server/http';
import { weekBoundary } from '../../src/lib/season-config';
import { LAST_WEEK } from '../../src/lib/types';

const preseason = () => new Date('2026-08-01T00:00:00.000Z');

test('isolated Neon transaction and concurrency release gate', { timeout: 120_000 }, async suite => {
  const url = isolatedDatabaseURL();

  await suite.test('partial writes rebuild drifted usage from lineups', async t => {
    const f = await fixture(t, url);
    await f.run(tx => tx.insert(playerUsage).values({ leagueId: f.leagueId, userId: f.userId, season: 2026, playerId: 'qb-a', timesUsed: 99 }));
    const saved = await f.run(tx => saveLineupInTransaction(tx, {
      leagueId: f.leagueId, actorId: f.userId, targetUserId: f.userId, week: 0, slots: partial(),
    }, preseason));
    assert.equal(saved.lineup.slots.filter(slot => slot.playerId).length, 1);
    assert.deepEqual(saved.playerUsage, [{ playerId: 'qb-a', timesUsed: 1 }]);
  });

  for (const adminContender of [false, true]) {
    await suite.test(`different-week saves share the cap, admin contender=${adminContender}`, async t => {
      const f = await fixture(t, url);
      const input = { leagueId: f.leagueId, actorId: f.userId, targetUserId: f.userId, slots: partial() };
      for (const week of [0, 1]) await f.run(tx => saveLineupInTransaction(tx, { ...input, week }, preseason));
      const results = await Promise.allSettled([
        f.run(tx => saveLineupInTransaction(tx, { ...input, week: 2 }, preseason)),
        f.run(tx => saveLineupInTransaction(tx, {
          ...input, week: 3, admin: adminContender, actorId: adminContender ? f.ownerId : f.userId,
        }, preseason)),
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      const rejected = results.find(result => result.status === 'rejected');
      assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof HttpError);
      assert.equal(rejected.reason.status, 409);
      const state = await f.run(async tx => ({
        lineups: await tx.select().from(lineups), usage: await tx.select().from(playerUsage),
        audit: await tx.select().from(lineupAuditLog),
      }));
      assert.equal(state.lineups.length, 3);
      assert.equal(state.usage[0].timesUsed, 3);
      assert.equal(state.audit.length, adminContender && results[1].status === 'fulfilled' ? 1 : 0);
    });
  }

  for (const stage of ['lineup', 'usage-delete', 'usage-insert', 'audit'] as const) {
    await suite.test(`an injected ${stage} failure rolls back lineup, usage and audit`, async t => {
      const f = await fixture(t, url);
      const input = { leagueId: f.leagueId, actorId: f.userId, targetUserId: f.userId, week: 1, slots: partial() };
      await f.run(tx => saveLineupInTransaction(tx, input, preseason));
      const snapshot = () => f.run(async tx => ({
        lineups: await tx.select().from(lineups), usage: await tx.select().from(playerUsage),
        audit: await tx.select().from(lineupAuditLog),
      }));
      const before = await snapshot();
      await f.run(async tx => {
        await tx.execute(sql`create function fail_write() returns trigger language plpgsql as
          $$ begin raise exception 'injected write failure'; end $$`);
        const target = stage === 'lineup' ? sql`before insert or update on lineups`
          : stage === 'usage-delete' ? sql`before delete on player_usage`
          : stage === 'usage-insert' ? sql`before insert on player_usage` : sql`before insert on lineup_audit_log`;
        await tx.execute(sql`create trigger fail_write ${target} for each row execute function fail_write()`);
      });
      await assert.rejects(f.run(tx => saveLineupInTransaction(tx, {
        ...input, actorId: f.ownerId, admin: true, slots: partial('qb-b'), reason: 'Rollback fixture',
      }, preseason)));
      assert.deepEqual(await snapshot(), before);
    });
  }

  await suite.test('kickoff is evaluated after the member-row wait', async t => {
    const f = await fixture(t, url);
    let unlock!: () => void;
    const held = new Promise<void>(resolve => { unlock = resolve; });
    let confirmLock!: () => void;
    const ready = new Promise<void>(resolve => { confirmLock = resolve; });
    let now = new Date('2026-09-05T17:59:59.000Z');
    const holder = f.run(async tx => {
      await tx.select().from(leagueMembers).where(eq(leagueMembers.userId, f.userId)).for('update');
      confirmLock();
      await held;
    });
    await ready;
    let announcePid!: (pid: number) => void;
    const pidReady = new Promise<number>(resolve => { announcePid = resolve; });
    const contender = f.run(async tx => {
      const result = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      announcePid(result.rows[0].pid);
      return saveLineupInTransaction(tx, {
        leagueId: f.leagueId, actorId: f.userId, targetUserId: f.userId, week: 1, slots: partial(),
      }, () => now);
    }).then(value => ({ value, error: null }), error => ({ value: null, error }));
    try {
      const pid = await pidReady;
      let blocked = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        const result = await f.run(tx => tx.execute<{ blocked: boolean }>(
          sql`select cardinality(pg_blocking_pids(${pid})) > 0 as blocked`,
        ));
        if (result.rows[0].blocked) { blocked = true; break; }
        await delay(25);
      }
      assert.equal(blocked, true, 'The competing request must actually wait for the member lock');
      now = new Date('2026-09-05T18:00:01.000Z');
    } finally {
      unlock();
      await holder;
    }
    const result = await contender;
    assert.ok(result.error instanceof HttpError);
    assert.equal(result.error.status, 409);
    assert.equal((await f.run(tx => tx.select().from(lineups))).length, 0);
  });

  await suite.test('the final boundary blocks members but permits an audited partial owner override', async t => {
    const f = await fixture(t, url);
    const input = { leagueId: f.leagueId, actorId: f.userId, targetUserId: f.userId, week: LAST_WEEK, slots: partial() };
    const afterFinal = () => weekBoundary(LAST_WEEK + 1)!;
    await assert.rejects(f.run(tx => saveLineupInTransaction(tx, input, afterFinal)), (error: unknown) => error instanceof HttpError && error.status === 409);
    const result = await f.run(tx => saveLineupInTransaction(tx, { ...input, actorId: f.ownerId, admin: true }, afterFinal));
    assert.equal(result.auditEntry?.wasLocked, 1);
    assert.equal(result.lineup.slots.filter(slot => slot.playerId).length, 1);
  });
});
