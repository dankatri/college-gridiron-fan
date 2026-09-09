import { sql } from 'drizzle-orm';
import { SEASON_STAT_FIELDS, type SeasonPlayerStats, type SeasonStatsPayload } from '../lib/season-stats';
import { liveStatsCacheKey } from './cache-keys';
import { sourceMetadataKey } from './cache-publication';
import { publishedCacheSnapshot } from './read-published-cache';

export type SeasonStatsProjection = {
  stats: SeasonPlayerStats[];
  snapshots: Array<{ key: string; data: unknown; updatedAt: string; revision: string }>;
};

/** Aggregate in Postgres so only season totals and small freshness records cross the DB boundary. */
export function projectSeasonStats(year: number, weeks: readonly number[]) {
  const expected = Object.fromEntries(weeks.map(week => [liveStatsCacheKey(year, week), week]));
  const keys = Object.keys(expected).flatMap(key => [key, sourceMetadataKey(key)]);
  const keyFilter = keys.length ? sql`c.key in (${sql.join(keys.map(key => sql`${key}`), sql`, `)})` : sql`false`;
  const sums = SEASON_STAT_FIELDS.map(field => sql`
    ${field}::text, sum(coalesce((value->>${field})::numeric, 0))`);
  return sql`
    with expected as (
      select key, value from jsonb_each_text(${JSON.stringify(expected)}::jsonb)
    ), cache_rows as materialized (
      select c.key, c.data, c.updated_at,
        to_char(c.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as revision
      from data_cache c where ${keyFilter}
    ), snapshots as materialized (
      select c.key, c.data->'stats' as stats
      from cache_rows c join expected e on e.key = c.key
      where jsonb_typeof(c.data->'stats') = 'array' and c.data->>'week' = e.value
    ), latest as (
      select distinct on (c.key, s.value->>'playerId') s.value
      from snapshots c
      cross join lateral jsonb_array_elements(c.stats) with ordinality as s(value, ordinality)
      order by c.key, s.value->>'playerId', s.ordinality desc
    ), totals as (
      select jsonb_build_object(
        'playerId', value->>'playerId', ${sql.join(sums, sql`, `)}
      ) as stat
      from latest group by value->>'playerId'
    )
    select
      (select coalesce(jsonb_agg(stat order by stat->>'playerId'), '[]'::jsonb) from totals) as stats,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'key', c.key, 'updatedAt', c.updated_at, 'revision', c.revision,
        'data', case when e.key is not null
          then jsonb_build_object('statsAvailable', s.key is not null) else c.data end
      )), '[]'::jsonb)
      from cache_rows c
      left join expected e on e.key = c.key
      left join snapshots s on s.key = c.key) as snapshots`;
}

export function seasonStatsSnapshot(
  season: number,
  weeks: readonly number[],
  projection: SeasonStatsProjection,
): SeasonStatsPayload {
  const rows = projection.snapshots.map(row => ({ ...row, updatedAt: new Date(row.updatedAt) }));
  const sources = weeks.map(week => ({
    week,
    ...publishedCacheSnapshot<{ statsAvailable: boolean }>(liveStatsCacheKey(season, week), rows),
  }));
  const availableWeeks = sources.filter(source => source.data?.statsAvailable).map(source => source.week);
  const missingWeeks = weeks.filter(week => !availableWeeks.includes(week));
  const latest = (dates: Array<string | Date | null>) => {
    const sorted = dates.flatMap(date => date === null ? [] : [new Date(date).toISOString()]).sort();
    return sorted[sorted.length - 1] ?? null;
  };
  return {
    season, stats: projection.stats, availableWeeks, missingWeeks,
    updatedAt: latest(sources.map(source => source.updatedAt)),
    sourceCheckedAt: latest(sources.map(source => source.sourceCheckedAt)),
    sourceAttemptedAt: latest(sources.map(source => source.sourceAttemptedAt)),
    contentVersion: null,
    sourceStatus: missingWeeks.length || sources.some(source => source.sourceStatus === 'incomplete')
      ? 'incomplete'
      : sources.some(source => source.sourceStatus === 'failed') ? 'failed'
        : sources.some(source => source.sourceStatus === 'refreshing') ? 'refreshing' : 'ready',
  };
}
