import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDisposableDatabase, deleteDisposableDatabase, verifyDisposableDatabase } from '../scripts/lib/test-database';

const project = { id: 'fixture-project', expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() };
const registration = {
  identity_assertion: 'synthetic-identity', project,
  capabilities: [{ capability: 'postgres', granted: true }],
};
const token = { access_token: 'synthetic-access-token' };
const credentials = {
  project_id: project.id,
  database_url: 'postgresql://fixture:fixture@ep-fixture.neon.tech/neondb?sslmode=require',
};
function transport(bodies: Array<object | number>) {
  const calls: Array<{ url: string; method: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET' });
    const next = bodies.shift();
    assert.notEqual(next, undefined, 'Unexpected extra request');
    return typeof next === 'number' ? new Response(null, { status: next })
      : new Response(JSON.stringify(next), { headers: { 'content-type': 'application/json' } });
  };
  return { fetcher, calls };
}

test('hosted fixtures provision, confirm scoped credentials and delete only their own project', async () => {
  const { fetcher, calls } = transport([registration, token, credentials, token, credentials, token, 204]);
  const database = await createDisposableDatabase(fetcher);
  await verifyDisposableDatabase(database, fetcher);
  await deleteDisposableDatabase(database, fetcher);
  assert.equal(database.databaseUrl, credentials.database_url);
  assert.deepEqual(calls[calls.length - 1], {
    url: 'https://claimable.neon.tech/v1/projects/fixture-project', method: 'DELETE',
  });
});

test('denied capability and unsafe credentials fail provisioning and still clean up', async () => {
  for (const responses of [
    [{ ...registration, capabilities: [] }, token, 204],
    [registration, token, { ...credentials, database_url: 'postgresql://fixture:fixture@other.example/test?sslmode=require' }, token, 204],
  ]) {
    const { fetcher, calls } = transport(responses);
    await assert.rejects(createDisposableDatabase(fetcher));
    assert.equal(calls[calls.length - 1].method, 'DELETE');
  }
});

test('fixture identity mismatch and failed cleanup cannot count as success', async () => {
  const { fetcher } = transport([registration, token, credentials, token, {
    ...credentials, database_url: credentials.database_url.replace('/neondb?', '/different?'),
  }, token, 500]);
  const database = await createDisposableDatabase(fetcher);
  await assert.rejects(verifyDisposableDatabase(database, fetcher), /does not match/);
  await assert.rejects(deleteDisposableDatabase(database, fetcher), /cleanup failed/);
});
