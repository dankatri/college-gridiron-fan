import assert from 'node:assert/strict';
import { test } from 'node:test';

test('private APIs use the same early closure for peer visibility, participation, wins and owner status', async t => {
  const environment = { ...process.env };
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@localhost/week_completion_test';
  process.env.SESSION_SECRET = 'isolated-week-completion-test-secret';
  process.env.MEMBER_LINEUP_QUERY_MODE = 'legacy';
  process.env.LEADERBOARD_QUERY_MODE = 'legacy';
  t.after(() => {
    for (const key of ['DATABASE_URL', 'SESSION_SECRET', 'MEMBER_LINEUP_QUERY_MODE', 'LEADERBOARD_QUERY_MODE']) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
  });
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-21T08:00:00Z') });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('No network or database access in handler tests'); });
  const [{ db }, { createSessionToken }, { default: memberLineup }, { default: admin }, { default: leaderboard }] = await Promise.all([
    import('../src/server/db'), import('../src/server/auth-utils'),
    import('../api/leagues/[id]/member-lineup'), import('../api/leagues/[id]/admin'),
    import('../api/leagues/[id]/leaderboard'),
  ]);
  const user = { id: '00000000-0000-4000-8000-000000000001', displayName: 'Owner', email: 'owner@example.test' };
  const peerId = '00000000-0000-4000-8000-000000000002';
  const leagueId = '00000000-0000-4000-8000-000000000003';
  const token = await createSessionToken(user.id);
  const headers = { cookie: `cgf-session=${token}` };
  const slots = [{ slotIndex: 0, position: 'QB', playerId: 'qb' }];
  const mockRows = (child: typeof t, rows: unknown[][]) => {
    let queries = 0;
    child.mock.method(db, 'select', () => {
      const index = queries++;
      assert.ok(index < rows.length, 'Unexpected private data query');
      return {
        from() { return this; }, where() { return this; }, innerJoin() { return this; },
        limit() { return this; }, orderBy() { return this; },
        then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) {
          return Promise.resolve(rows[index]).then(resolve, reject);
        },
      };
    });
    return () => queries;
  };

  for (const mode of ['unfinished', 'finished', 'calendar', 'own', 'non-member'] as const) {
    await t.test(`peer reveal: ${mode}`, async child => {
      const week = mode === 'calendar' ? 2 : mode === 'own' ? 4 : 3;
      const targetId = mode === 'own' ? user.id : peerId;
      const getQueries = mockRows(child, [
        [user], mode === 'non-member' ? [] : [{ userId: user.id }, { userId: targetId }],
        [{ id: targetId, username: 'Member', avatarUrl: null }],
        [{ slots, projectedPoints: '0' }], [{ week: 2 }, { week: 3 }, { week: 4 }],
        [{ data: [{ id: 'qb', name: 'Quarterback', team: 'Alpha' }] }],
        [{ data: { week, stats: [{ playerId: 'qb', fantasyPoints: 19 }] } }],
      ]);
      let completionReads = 0;
      child.mock.method(db, 'execute', async () => {
        completionReads += 1;
        return { rows: mode === 'finished' ? [{ week: 3 }] : [] };
      });
      const response = await memberLineup(new Request(
        `http://fixture.test/api/leagues/${leagueId}/member-lineup?userId=${targetId}&week=${week}`, { headers },
      ));
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      if (mode === 'unfinished' || mode === 'non-member') {
        assert.equal(response.status, 403);
        assert.equal(getQueries(), 2, 'No target or lineup may be read before the visibility gate');
      } else {
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.slots[0].name, 'Quarterback');
        assert.equal(body.totalPoints, 19);
        assert.deepEqual(body.availableWeeks, mode === 'own' ? [2, 3, 4] : mode === 'finished' ? [2, 3] : [2]);
      }
      assert.equal(completionReads, mode === 'own' || mode === 'non-member' ? 0 : 1);
    });
  }

  await t.test('owner summaries flag early closure and count a played lineup without a live snapshot', async child => {
    mockRows(child, [
      [user], [{ id: leagueId, ownerId: user.id, season: 2026 }],
      [{ userId: peerId, displayName: 'Member', role: 'member' }],
      [{ userId: peerId, week: 3, slots }], [],
    ]);
    let executions = 0;
    child.mock.method(db, 'execute', async () => ({ rows: ++executions === 1 ? [] : [{ week: 3 }] }));
    const response = await admin(new Request(`http://fixture.test/api/leagues/${leagueId}/admin?week=3`, { headers }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.isWeekLocked, true);
    assert.equal(body.members[0].weeksSet, 1);
    assert.equal(executions, 2);
  });

  for (const available of [false, true]) {
    await t.test(`standings: early completion with scoring snapshot available=${available}`, async child => {
      mockRows(child, [
        [user], [{ userId: user.id }], [{ userId: peerId, username: 'Member' }],
        [{ userId: peerId, week: 3, slots, projectedPoints: '0' }],
        [{ data: { week: 3, stats: available ? [{ playerId: 'qb', fantasyPoints: 19 }] : null } }],
      ]);
      child.mock.method(db, 'execute', async () => ({ rows: [{ week: 3 }] }));
      const response = await leaderboard(new Request(`http://fixture.test/api/leagues/${leagueId}/leaderboard`, { headers }));
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.leaderboard[0].weeksScored, 1);
      assert.equal(body.leaderboard[0].winningWeeks, available ? 1 : 0);
      assert.equal(body.leaderboard[0].totalPoints, available ? 19 : 0);
    });
  }
});
