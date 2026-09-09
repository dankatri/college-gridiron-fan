import { sql } from 'drizzle-orm';

export type CacheRun = { generation: number; sourceAttemptedAt: string };
export type SourceStatus = 'refreshing' | 'ready' | 'incomplete' | 'failed';
export const sourceMetadataKey = (key: string) => `source:${key}`;

export function allocateCacheRun() {
  return sql`
    insert into data_cache(key, data) values ('refresh-generation', '{"generation":1}'::jsonb)
    on conflict(key) do update
      set data = jsonb_build_object('generation', (data_cache.data->>'generation')::bigint + 1),
          updated_at = clock_timestamp()
    returning (data->>'generation')::bigint as generation, updated_at as "sourceAttemptedAt"`;
}

export function claimCacheSource(key: string, run: CacheRun) {
  const metadata = JSON.stringify({ ...run, sourceStatus: 'refreshing' });
  return sql`
    insert into data_cache(key, data) values (${sourceMetadataKey(key)}, ${metadata}::jsonb)
    on conflict(key) do update set
      data = data_cache.data || excluded.data, updated_at = clock_timestamp()
    where coalesce((data_cache.data->>'generation')::bigint, 0) <= ${run.generation}
    returning key`;
}

export function failCacheSource(key: string, run: CacheRun, status: 'failed' | 'incomplete') {
  return sql`
    update data_cache set data = data || jsonb_build_object('sourceStatus', ${status}::text),
      updated_at = clock_timestamp()
    where key = ${sourceMetadataKey(key)} and (data->>'generation')::bigint = ${run.generation}`;
}

/** Data and observation metadata commit together under the claimed generation. */
export function publishCacheSource(key: string, data: unknown, run: CacheRun, contentVersion: string) {
  return sql`
    with claimed as (
      select data->>'contentVersion' as previous_version,
        data->>'dataRevision' as previous_revision from data_cache
      where key = ${sourceMetadataKey(key)} and (data->>'generation')::bigint = ${run.generation}
      for update
    ), content_write as (
      insert into data_cache(key, data)
        select ${key}, ${JSON.stringify(data)}::jsonb from claimed
        where previous_version is distinct from ${contentVersion}
          or not exists(
            select 1 from data_cache where key = ${key}
              and to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') = previous_revision
          )
      on conflict(key) do update set data = excluded.data, updated_at = clock_timestamp()
      returning key, updated_at
    ), metadata_write as (
      update data_cache m set data = m.data || jsonb_build_object(
        'contentVersion', ${contentVersion}::text,
        'dataRevision', to_char(coalesce(
          (select updated_at from content_write),
          (select updated_at from data_cache where key = ${key})
        ) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'sourceCheckedAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'sourceStatus', 'ready'
      ), updated_at = clock_timestamp()
      from claimed where m.key = ${sourceMetadataKey(key)}
      returning m.key
    )
    select exists(select 1 from metadata_write) as accepted,
      exists(select 1 from content_write) as changed`;
}
