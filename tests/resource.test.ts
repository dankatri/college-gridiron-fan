import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createResource } from '../src/lib/async-resource';

test('unchanged source content retains its data identity while freshness advances', async () => {
  let observation = 0;
  const resource = createResource(async () => ({
    data: ['same facts'], contentVersion: 'v1:unchanged',
    sourceCheckedAt: String(++observation),
  }), { ttlMs: 0 });
  const first = await resource.read();
  const second = await resource.read(true);
  assert.equal(first, second);
  assert.equal(resource.getSnapshot().sourceCheckedAt, '2');
});

test('a resource deduplicates requests and keeps its snapshot stable until an update', async () => {
  let calls = 0;
  const resource = createResource(async () => ({ data: [++calls] }), { ttlMs: 60_000 });
  const initial = resource.getSnapshot();
  assert.equal(resource.getSnapshot(), initial);
  const first = resource.refresh();
  assert.equal(resource.refresh(), first);
  await first;
  const snapshot = resource.getSnapshot();
  assert.equal(await resource.read(), snapshot.data);
  assert.equal(resource.getSnapshot(), snapshot);
  assert.equal(calls, 1);
});

test('a failed refresh preserves last-good data and exposes the failure', async () => {
  let fail = false;
  const resource = createResource(async () => {
    if (fail) throw new Error('offline');
    return { data: ['locked-team'] };
  }, { ttlMs: 60_000 });
  const original = await resource.read();
  fail = true;
  await assert.rejects(resource.read(true), /offline/);
  assert.equal(resource.getSnapshot().data, original);
  assert.equal(resource.getSnapshot().error?.message, 'offline');
  fail = false;
  await resource.refresh();
  assert.equal(resource.getSnapshot().error, null);
});

test('an invalidated response cannot overwrite a newer snapshot', async () => {
  let resolveOld: (value: { data: string }) => void;
  let calls = 0;
  const resource = createResource(async () => ++calls === 1
    ? new Promise<{ data: string }>(resolve => { resolveOld = resolve; })
    : { data: 'new' }, { ttlMs: 0 });
  const old = resource.refresh();
  await Promise.resolve();
  resource.invalidate(true);
  await resource.refresh();
  resolveOld!({ data: 'old' });
  await old;
  assert.equal(resource.getSnapshot().data, 'new');
});

test('a hanging request times out even if its loader ignores abort, allowing retry', async () => {
  let hang = true;
  const resource = createResource(async () => hang
    ? new Promise<{ data: string }>(() => {})
    : { data: 'recovered' }, { ttlMs: 0, timeoutMs: 10 });
  await assert.rejects(resource.read(), /timed out/);
  assert.equal(resource.getSnapshot().isLoading, false);
  hang = false;
  assert.equal(await resource.read(), 'recovered');
});
