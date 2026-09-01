/**
 * Reads and writes the `data_cache` table used by the /api/* read endpoints.
 *
 * Imported lazily by the scripts so that env vars are loaded before
 * src/server/db.ts reads DATABASE_URL at module scope.
 */

import { eq, sql } from 'drizzle-orm';

export async function writeCache(key: string, data: unknown): Promise<void> {
  const { db } = await import('../../src/server/db');
  const { dataCache } = await import('../../src/server/schema');

  await db
    .insert(dataCache)
    .values({ key, data })
    .onConflictDoUpdate({
      target: dataCache.key,
      set: { data, updatedAt: sql`now()` },
    });
}

export async function readCache<T>(key: string): Promise<T | null> {
  const { db } = await import('../../src/server/db');
  const { dataCache } = await import('../../src/server/schema');

  const rows = await db.select().from(dataCache).where(eq(dataCache.key, key)).limit(1);
  const row = rows[0];
  return row ? (row.data as T) : null;
}
