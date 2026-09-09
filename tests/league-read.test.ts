import assert from 'node:assert/strict';
import { test } from 'node:test';

test('league read handlers authorize before parallel queries and preserve private response contracts', async t => {
  const originalURL = process.env.DATABASE_URL;
  const originalSecret = process.env.SESSION_SECRET;
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@localhost/unit_test';
  process.env.SESSION_SECRET = 'isolated-league-read-test-secret';
  t.after(() => {
    if (originalURL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalURL;
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('These handler tests must not contact a database or network');
  });
  const [{ db }, { createSessionToken }, { default: details }, { default: standings }] = await Promise.all([
    import('../src/server/db'), import('../src/server/auth-utils'),
    import('../api/leagues/[id]'), import('../api/leagues/[id]/leaderboard'),
  ]);
  const user = { id: 'fixture-user', email: 'member@example.test', displayName: 'Member' };
  const token = await createSessionToken(user.id);
  const league = { id: 'fixture-league', ownerId: user.id, name: 'Fixture league', season: 2026 };
  for (const [name, handler, path] of [
    ['details', details, '/api/leagues/fixture-league'],
    ['standings', standings, '/api/leagues/fixture-league/leaderboard'],
  ] as const) {
    await t.test(`${name}: anonymous and non-members cannot run league data queries`, async child => {
      let queries = 0;
      child.mock.method(db, 'select', () => {
        const rows = ++queries === 1 ? [user] : [];
        return {
          from() { return this; },
          where() { return this; },
          limit() { return Promise.resolve(rows); },
        };
      });
      const anonymous = await handler(new Request(`http://fixture.test${path}`));
      assert.equal(anonymous.status, 401);
      assert.equal(anonymous.headers.get('cache-control'), 'private, no-store');
      assert.equal(queries, 0);
      const denied = await handler(new Request(`http://fixture.test${path}`, { headers: { cookie: `cgf-session=${token}` } }));
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get('cache-control'), 'private, no-store');
      assert.equal(queries, 2);
    });

    await t.test(`${name}: independent reads start together after authorization`, { timeout: 2_000 }, async child => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      let signal!: () => void;
      const thirdStarted = new Promise<void>(resolve => { signal = resolve; });
      const rows: unknown[][] = name === 'details'
        ? [[user], [{ userId: user.id }], [league], [{ userId: user.id }, { userId: 'another-member' }]]
        : [[user], [{ userId: user.id }], [{ userId: user.id, username: user.displayName }], []];
      let queries = 0;
      const started: number[] = [];
      child.mock.method(db, 'select', () => {
        const index = queries++;
        return {
          from() { return this; },
          innerJoin() { return this; },
          where() { return this; },
          limit() { return this; },
          then(resolve: (value: unknown[]) => unknown, reject: (cause: unknown) => unknown) {
            started.push(index);
            const result = index === 2
              ? gate.then(() => rows[index])
              : Promise.resolve(rows[index]);
            if (index === 2) signal();
            return result.then(resolve, reject);
          },
        };
      });
      const pending = handler(new Request(`http://fixture.test${path}`, { headers: { cookie: `cgf-session=${token}` } }));
      try {
        await thirdStarted;
        assert.deepEqual(started, [0, 1, 2, 3], 'The fourth read must start without waiting for the third');
        assert.equal(queries, 4, 'Details must not issue a redundant member-count query');
      } finally {
        release();
      }
      const response = await pending;
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const body = await response.json();
      if (name === 'details') {
        assert.equal(body.league.id, league.id);
        assert.equal(body.league.memberCount, body.league.members.length);
        assert.equal(body.league.memberCount, 2);
      } else {
        assert.equal(body.leaderboard[0].userId, user.id);
        assert.equal(body.leaderboard[0].totalPoints, 0);
        assert.equal(body.leaderboard[0].weeksScored, 0);
      }
      assert.equal(queries, 4);
    });
  }
});
