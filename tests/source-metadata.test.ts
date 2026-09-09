import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishedCacheSnapshot } from '../src/server/read-published-cache';
import { sourceMetadataKey } from '../src/server/cache-publication';

const key = 'live-stats-2026-week-1';
const revision = '2026-09-07T10:00:00.123456Z';
const raw = { key, data: { stats: [] }, updatedAt: new Date(revision), revision };
const metadata = {
  key: sourceMetadataKey(key), updatedAt: new Date('2026-09-07T10:01:00Z'),
  revision: '2026-09-07T10:01:00.000000Z',
  data: {
    dataRevision: revision, contentVersion: 'accepted-content',
    sourceStatus: 'incomplete',
    sourceCheckedAt: '2026-09-07T10:00:00Z', sourceAttemptedAt: '2026-09-07T10:01:00Z',
  },
};

test('aligned source metadata preserves content identity and a failed refresh status', () => {
  const result = publishedCacheSnapshot(key, [raw, metadata]);
  assert.equal(result.data, raw.data);
  assert.equal(result.contentVersion, 'accepted-content');
  assert.equal(result.sourceStatus, 'incomplete');
  assert.equal(result.sourceCheckedAt, metadata.data.sourceCheckedAt);
});

test('legacy raw-row replacement cannot inherit an old semantic content version', () => {
  const replacement = {
    ...raw, data: { stats: ['replacement'] },
    updatedAt: new Date('2026-09-07T10:02:00Z'), revision: '2026-09-07T10:02:00.000000Z',
  };
  const result = publishedCacheSnapshot(key, [replacement, metadata]);
  assert.equal(result.data, replacement.data);
  assert.equal(result.contentVersion, null);
  assert.equal(result.sourceStatus, 'ready');
  assert.equal(result.sourceAttemptedAt, null);
  assert.equal(result.sourceCheckedAt, replacement.updatedAt.toISOString());
});

test('missing data and microsecond revision mismatches never reuse a semantic version', () => {
  const missing = publishedCacheSnapshot(key, [metadata]);
  assert.equal(missing.data, null);
  assert.equal(missing.contentVersion, null);
  assert.equal(missing.sourceStatus, 'incomplete');
  const changed = publishedCacheSnapshot(key, [{ ...raw, revision: '2026-09-07T10:00:00.123457Z' }, metadata]);
  assert.equal(changed.contentVersion, null);
  assert.equal(changed.sourceStatus, 'incomplete');
});
