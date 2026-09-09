import { inArray, sql } from 'drizzle-orm';
import { dataCache } from './schema';
import { sourceMetadataKey, type SourceStatus } from './cache-publication';

export interface SourceMetadata {
  sourceCheckedAt: string | null;
  sourceAttemptedAt: string | null;
  contentVersion: string | null;
  sourceStatus: SourceStatus;
}

interface PublishedCacheRow {
  key: string;
  data: unknown;
  updatedAt: Date;
  revision: string;
}

/** One MVCC snapshot keeps the body and its source metadata coherent. */
export async function readPublishedCache<T>(key: string) {
  const { db } = await import('./db');
  const rows = await db.select({
    key: dataCache.key, data: dataCache.data, updatedAt: dataCache.updatedAt,
    revision: sql<string>`to_char(${dataCache.updatedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  }).from(dataCache).where(inArray(dataCache.key, [key, sourceMetadataKey(key)]));
  return publishedCacheSnapshot<T>(key, rows);
}

export function publishedCacheSnapshot<T>(key: string, rows: PublishedCacheRow[]) {
  const row = rows.find(item => item.key === key);
  const metadata = rows.find(item => item.key === sourceMetadataKey(key))?.data as (Partial<SourceMetadata> & { dataRevision?: string }) | undefined;
  // An older producer or operator may have replaced the raw row. Do not attach
  // a stale semantic version to different facts during a staged rollback.
  const aligned = !!row && metadata?.dataRevision === row.revision;
  const currentAttempt = aligned || (!!metadata?.sourceAttemptedAt &&
    (!row || Date.parse(metadata.sourceAttemptedAt) >= row.updatedAt.getTime()));
  return {
    data: (row?.data ?? null) as T | null,
    updatedAt: row?.updatedAt ?? null,
    sourceCheckedAt: aligned ? metadata?.sourceCheckedAt ?? null : row?.updatedAt?.toISOString() ?? null,
    sourceAttemptedAt: currentAttempt ? metadata?.sourceAttemptedAt ?? null : null,
    contentVersion: aligned ? metadata?.contentVersion ?? null : null,
    sourceStatus: currentAttempt ? metadata?.sourceStatus ?? 'ready' : 'ready',
  };
}
