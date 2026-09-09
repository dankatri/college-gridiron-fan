/**
 * Reads and writes the `data_cache` table used by the /api/* read endpoints.
 *
 * Imported lazily by the scripts so that env vars are loaded before
 * src/server/db.ts reads DATABASE_URL at module scope.
 */

import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { allocateCacheRun, claimCacheSource, failCacheSource, publishCacheSource, type CacheRun } from '../../src/server/cache-publication';
import { logStep } from './runner';

export class IncompleteSourceError extends Error {}

function semanticValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(semanticValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== 'updatedAt' && key !== 'lastUpdated')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, field]) => [key, semanticValue(field)]));
  }
  return value;
}

export function cacheContentVersion(data: unknown): string {
  return `v1:${createHash('sha256').update(JSON.stringify(semanticValue(data))).digest('hex')}`;
}

export async function beginCacheRun(): Promise<CacheRun> {
  const { db } = await import('../../src/server/db');
  const result = await db.execute<{ generation: number | string; sourceAttemptedAt: string }>(allocateCacheRun());
  const generation = Number(result.rows[0]?.generation);
  if (!Number.isSafeInteger(generation) || generation < 1) throw new Error('Invalid cache publication generation');
  return { generation, sourceAttemptedAt: new Date(result.rows[0].sourceAttemptedAt).toISOString() };
}

export async function refreshCache<T>(key: string, run: CacheRun, load: () => Promise<T>): Promise<void> {
  const { db } = await import('../../src/server/db');
  const claim = await db.execute(claimCacheSource(key, run));
  if (!claim.rows.length) {
    logStep('source refresh superseded', { key, generation: run.generation });
    return;
  }
  try {
    const data = await load();
    const result = await db.execute<{ accepted: boolean; changed: boolean }>(
      publishCacheSource(key, data, run, cacheContentVersion(data)),
    );
    logStep('source publication', { key, generation: run.generation, ...result.rows[0] });
  } catch (error) {
    try {
      await db.execute(failCacheSource(key, run, error instanceof IncompleteSourceError ? 'incomplete' : 'failed'));
    } catch (metadataError) {
      console.error('Could not record source refresh failure', metadataError);
    }
    throw error;
  }
}

export async function readCache<T>(key: string): Promise<T | null> {
  const { db } = await import('../../src/server/db');
  const { dataCache } = await import('../../src/server/schema');

  const rows = await db.select().from(dataCache).where(eq(dataCache.key, key)).limit(1);
  const row = rows[0];
  return row ? (row.data as T) : null;
}
