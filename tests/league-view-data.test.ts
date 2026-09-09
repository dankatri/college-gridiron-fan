import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLeagueViewCache, isLeagueAccessError } from '../src/lib/league-view-data';

const league = {
  id: 'league-a', name: 'League A', ownerId: 'user-a', season: 2026,
  maxMembers: 20, isPublic: false, allowLateJoins: true,
  createdAt: '2026-09-01T00:00:00Z', memberCount: 1,
  members: [{ userId: 'user-a', displayName: 'Member A', joinedAt: '2026-09-01T00:00:00Z', role: 'owner' }],
};
const leaderboard = (points = 19) => [{
  rank: 1, userId: 'user-a', username: 'Member A',
  totalPoints: points, weeklyPoints: { 1: points }, weeksScored: 1, winningWeeks: 0,
}];

test('league resources are stable, deduplicated and reused until their independent TTLs expire', async t => {
  let now = 1_000;
  t.mock.method(Date, 'now', () => now);
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (path: string, init: RequestInit) => {
    assert.equal(init.credentials, 'include');
    assert.ok(init.signal instanceof AbortSignal);
    requests.push(path);
    return Response.json(path.endsWith('/leaderboard') ? { leaderboard: leaderboard(requests.length) } : { league });
  });
  const cache = createLeagueViewCache('user-a');
  const resources = cache.get(league.id);
  assert.equal(cache.get(league.id), resources);
  const [first, duplicate] = await Promise.all([resources.standings.read(), resources.standings.read()]);
  assert.equal(first, duplicate);
  assert.deepEqual(requests, ['/api/leagues/league-a/leaderboard']);
  await resources.details.read();
  now += 29_999;
  assert.equal(await resources.standings.read(), first);
  assert.equal(requests.length, 2);
  now++;
  assert.notEqual(await resources.standings.read(), first);
  await resources.details.read();
  assert.equal(requests.length, 3);
  now += 270_000;
  await resources.details.read();
  assert.equal(requests.length, 4);
});

test('transient errors retain explicitly stale standings; access errors discard them even for non-JSON bodies', async t => {
  let status = 200;
  t.mock.method(globalThis, 'fetch', async () => status === 200
    ? Response.json({ leaderboard: leaderboard() })
    : status === 503
      ? Response.json({ error: 'Standings unavailable' }, { status })
      : new Response('Access denied', { status }));
  const resource = createLeagueViewCache('user-a').get(league.id).standings;
  const first = await resource.read();
  status = 503;
  await assert.rejects(resource.read(true), /Standings unavailable/);
  assert.equal(resource.getSnapshot().data, first);
  assert.equal(isLeagueAccessError(resource.getSnapshot().error), false);
  for (const denied of [401, 403, 404]) {
    status = 200;
    await resource.read(true);
    status = denied;
    await assert.rejects(resource.read(true), /sign in again|no longer available/);
    assert.equal(resource.getSnapshot().data, undefined);
    assert.equal(isLeagueAccessError(resource.getSnapshot().error), true);
  }
});

test('invalid success bodies cannot become empty standings or another league detail', async t => {
  let payload: unknown = {};
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const resources = createLeagueViewCache('user-a').get(league.id);
  await assert.rejects(resources.standings.read());
  assert.equal(resources.standings.getSnapshot().data, undefined);
  payload = { league: { ...league, id: 'league-b' } };
  await assert.rejects(resources.details.read(), /Invalid league details/);
  payload = { league: { ...league, members: undefined } };
  await assert.rejects(resources.details.read(), /Invalid league details/);
  assert.equal(resources.details.getSnapshot().data, undefined);
});

test('observing access errors does not fetch unused details but catches their late denials', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (path: string) => {
    requests++;
    return path.endsWith('/leaderboard')
      ? Response.json({ leaderboard: leaderboard() })
      : new Response('No access', { status: 403 });
  });
  const resources = createLeagueViewCache('user-a').get(league.id);
  let notified = 0;
  const stop = resources.observeAccess(() => { notified++; });
  assert.equal(requests, 0);
  await resources.standings.read();
  assert.equal(requests, 1);
  assert.equal(resources.getAccessError(), null);
  await assert.rejects(resources.details.read());
  assert.equal(isLeagueAccessError(resources.getAccessError()), true);
  assert.equal(resources.getAccessError(), resources.getAccessError());
  assert.ok(notified > 0);
  stop();
  notified = 0;
  resources.details.invalidate(true);
  await Promise.resolve();
  assert.equal(notified, 0);
  assert.equal(requests, 2, 'Passive observers must not cause revalidation');
});

test('lineup and membership invalidations are league-scoped, with authoritative pruning', async t => {
  t.mock.method(globalThis, 'fetch', async (path: string) => Response.json(
    path.endsWith('/leaderboard') ? { leaderboard: leaderboard() } : { league },
  ));
  const cache = createLeagueViewCache('user-a');
  const a = cache.get('league-a');
  const b = cache.get('league-b');
  await Promise.all([a.standings.read(), a.details.read(), b.standings.read()]);
  const details = a.details.getSnapshot().data;
  const otherStandings = b.standings.getSnapshot().data;
  cache.invalidateStandings('league-a');
  assert.equal(a.standings.getSnapshot().data, undefined);
  assert.equal(a.details.getSnapshot().data, details);
  assert.equal(b.standings.getSnapshot().data, otherStandings);
  await a.standings.read();
  cache.invalidate('league-a');
  assert.equal(a.standings.getSnapshot().data, undefined);
  assert.equal(a.details.getSnapshot().data, undefined);
  cache.retain(['league-a']);
  assert.equal(b.standings.getSnapshot().data, undefined);
  assert.equal(cache.get('league-a'), a);
  assert.notEqual(cache.get('league-b'), b);
  cache.clear();
  assert.notEqual(cache.get('league-a'), a);
  assert.throws(() => createLeagueViewCache(null).get('league-a'), /signed-in user/);
});

test('disposing an account aborts late results without revalidating mounted subscribers or affecting another account', async t => {
  let release!: (response: Response) => void;
  let oldSignal: AbortSignal | null | undefined;
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (_path: string, init: RequestInit) => {
    if (++requests === 1) {
      oldSignal = init.signal;
      return new Promise<Response>(resolve => { release = resolve; });
    }
    return Response.json({ leaderboard: leaderboard(44) });
  });
  const oldCache = createLeagueViewCache('user-a');
  const old = oldCache.get(league.id).standings;
  const unsubscribe = old.subscribe(() => {});
  const pending = old.refresh();
  await Promise.resolve();
  oldCache.clear();
  assert.equal(oldSignal?.aborted, true);
  await pending;
  assert.equal(requests, 1);
  const next = createLeagueViewCache('user-b').get(league.id).standings;
  await next.read();
  release(Response.json({ leaderboard: leaderboard(999) }));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(old.getSnapshot().data, undefined);
  assert.equal(next.getSnapshot().data?.[0].totalPoints, 44);
  assert.equal(requests, 2);
  unsubscribe();
});
