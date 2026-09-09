import { sql } from 'drizzle-orm';
import { playersCacheKey, schedulesCacheKey } from './cache-keys';

/** Explicit rollout switches, never an exception-driven fallback. */
export function cacheQueryMode(name: 'LEADERBOARD_QUERY_MODE' | 'PLAYER_LOG_QUERY_MODE' | 'MEMBER_LINEUP_QUERY_MODE') {
  const mode = process.env[name] ?? 'legacy';
  if (mode !== 'legacy' && mode !== 'projected') throw new Error(`Invalid ${name}`);
  return mode;
}

function startedGamesExpression() {
  return sql`(
    coalesce(jsonb_array_length(nullif(c.data->'stats', 'null'::jsonb)), 0) > 0
    or exists (
      select 1 from jsonb_array_elements(coalesce(nullif(c.data->'games', 'null'::jsonb), '[]'::jsonb)) game
      where game->>'status' in ('in-progress', 'final')
    )
  )`;
}

export function projectStartedWeeks(year: number, weeks: number[]) {
  return sql`
    select c.data->'week' as week
    from data_cache c
    where c.key like ${`live-stats-${year}-week-%`}
      and ${JSON.stringify(weeks)}::jsonb @> jsonb_build_array(c.data->'week')
      and ${startedGamesExpression()}
    order by c.key`;
}

export function projectWeeklyScores(year: number, requested: Record<number, string[]>) {
  const selections = JSON.stringify(requested);
  return sql`
    select c.key, c.updated_at as "updatedAt",
      jsonb_build_object('week', c.data->'week',
        'statsAvailable', coalesce(jsonb_typeof(c.data->'stats') = 'array', false),
        'hasStartedGames', ${startedGamesExpression()},
        'stats', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'playerId', s.value->'playerId', 'fantasyPoints', s.value->'fantasyPoints'
        ) order by s.ordinality), '[]'::jsonb)
        from jsonb_array_elements(coalesce(nullif(c.data->'stats', 'null'::jsonb), '[]'::jsonb))
          with ordinality as s(value, ordinality)
        where wanted.player_ids ? (s.value->>'playerId')
      )) as data
    from data_cache c
    join jsonb_each(${selections}::jsonb) as wanted(week, player_ids)
      on wanted.week = c.data->>'week'
    where c.key like ${`live-stats-${year}-week-%`}
    order by c.key`;
}

/** Player logs use the FIRST matching stat, unlike scoreboard maps (last wins). */
export function projectPlayerLog(year: number, playerId: string) {
  return sql`
    select c.key, c.updated_at as "updatedAt",
      jsonb_build_object('week', c.data->'week', 'stats', jsonb_build_array(found.value)) as data
    from data_cache c
    cross join lateral (
      select s.value
      from jsonb_array_elements(coalesce(nullif(c.data->'stats', 'null'::jsonb), '[]'::jsonb))
        with ordinality as s(value, ordinality)
      where s.value->'playerId' = to_jsonb(${playerId}::text)
      order by s.ordinality limit 1
    ) found
    where c.key like ${`live-stats-${year}-week-%`}
    order by c.key`;
}

export function projectPlayers(year: number, playerIds: string[]) {
  return sql`
    select c.key, c.updated_at as "updatedAt", (
      select coalesce(jsonb_agg(p.value order by p.ordinality), '[]'::jsonb)
      from jsonb_array_elements(c.data) with ordinality as p(value, ordinality)
      where ${JSON.stringify(playerIds)}::jsonb ? (p.value->>'id')
    ) as data
    from data_cache c where c.key = ${playersCacheKey(year)}`;
}

export function projectTeamSchedule(year: number, team: string) {
  return sql`
    select c.key, c.updated_at as "updatedAt", (
      select coalesce(jsonb_agg(s.value order by s.ordinality), '[]'::jsonb)
      from jsonb_array_elements(c.data) with ordinality as s(value, ordinality)
      where s.value->>'teamName' = ${team}
    ) as data
    from data_cache c where c.key = ${schedulesCacheKey(year)}`;
}
