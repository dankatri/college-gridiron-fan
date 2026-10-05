import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { TestContext } from 'node:test';
import { withLineupTransaction, type LineupTransaction } from '../../src/server/lineup-transaction';
import { dataCache, leagueMembers, leagues, users } from '../../src/server/schema';
import { playersCacheKey, schedulesCacheKey } from '../../src/server/cache-keys';
import { SEASON_YEAR } from '../../src/lib/season-config';
import { saveLineupSchema } from '../../src/server/lineup-input';

export function isolatedDatabaseURL(): string {
  const value = process.env.DATABASE_URL_TEST;
  if (!value) throw new Error('DATABASE_URL_TEST is required. Use an isolated Neon test database; production is never a fallback.');
  const identity = (connection: string) => {
    const url = new URL(connection);
    return `${url.hostname.replace('-pooler.', '.')}${url.pathname}`;
  };
  if (process.env.DATABASE_URL && identity(value) === identity(process.env.DATABASE_URL)) {
    throw new Error('DATABASE_URL_TEST must not identify the production database.');
  }
  return value;
}

export const partial = (id: string | null = 'qb-a') => saveLineupSchema.parse({
  week: 0,
  slots: ['QB', 'QB', 'RB', 'RB', 'WR', 'WR'].map((position, slotIndex) => ({
    position, slotIndex, playerId: slotIndex === 0 ? id : null,
  })),
}).slots;

export async function fixture(context: TestContext, url: string) {
  const schema = `opt_test_${randomUUID().replace(/-/g, '')}`;
  const ownerId = randomUUID();
  const userId = randomUUID();
  const leagueId = randomUUID();
  const run = <T>(action: (tx: LineupTransaction) => Promise<T>) => withLineupTransaction(async tx => {
    await tx.execute(sql`set local search_path to ${sql.identifier(schema)}`);
    return action(tx);
  }, url);
  await withLineupTransaction(tx => tx.execute(sql`create schema ${sql.identifier(schema)}`), url);
  context.after(async () => {
    await withLineupTransaction(tx => tx.execute(sql`drop schema ${sql.identifier(schema)} cascade`), url);
  });
  await run(async tx => {
    await tx.execute(sql`
      create table users (id uuid primary key default gen_random_uuid(), email text unique not null,
        display_name text not null, password_hash text not null, avatar_url text,
        lineup_reminders_enabled integer not null default 1,
        notify_token uuid not null unique default gen_random_uuid(),
        created_at timestamptz not null default now());
      create table leagues (id uuid primary key default gen_random_uuid(), name text not null, description text,
        owner_id uuid not null references users(id), season integer not null, join_code text unique not null,
        max_members integer not null default 8, is_public integer not null default 0,
        allow_late_joins integer not null default 1, created_at timestamptz not null default now());
      create table league_members (league_id uuid not null references leagues(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade, role text not null default 'member',
        joined_at timestamptz not null default now(), primary key(league_id,user_id));
      create table lineups (id uuid primary key default gen_random_uuid(),
        league_id uuid not null references leagues(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade, season integer not null,
        week integer not null, slots jsonb not null, projected_points text default '0', actual_points text,
        locked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        unique(league_id,user_id,season,week));
      create table player_usage (league_id uuid not null references leagues(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade, season integer not null,
        player_id text not null, times_used integer not null default 0, primary key(league_id,user_id,season,player_id));
      create table lineup_audit_log (id uuid primary key default gen_random_uuid(),
        league_id uuid not null references leagues(id) on delete cascade,
        subject_user_id uuid not null references users(id), actor_user_id uuid not null references users(id),
        season integer not null, week integer not null, previous_slots jsonb, new_slots jsonb not null,
        reason text, was_locked integer not null default 0, created_at timestamptz not null default now());
      create table lineup_reminders (user_id uuid not null references users(id) on delete cascade,
        season integer not null, week integer not null, stage text not null,
        league_count integer not null, sent_at timestamptz not null default now(),
        primary key(user_id,season,week,stage));
      create table data_cache (key text primary key, data jsonb not null, updated_at timestamptz not null default now());
    `);
    await tx.insert(users).values([
      { id: ownerId, email: 'owner@example.test', displayName: 'Owner', passwordHash: 'fixture-not-a-password' },
      { id: userId, email: 'member@example.test', displayName: 'Member', passwordHash: 'fixture-not-a-password' },
    ]);
    await tx.insert(leagues).values({ id: leagueId, ownerId, name: 'Isolated fixture', season: SEASON_YEAR, joinCode: 'TESTONLY' });
    await tx.insert(leagueMembers).values([{ leagueId, userId }, { leagueId, userId: ownerId, role: 'owner' }]);
    await tx.insert(dataCache).values([
      { key: playersCacheKey(SEASON_YEAR), data: [{ id: 'qb-a', name: 'Alpha QB', team: 'Alpha' }, { id: 'qb-b', name: 'Beta QB', team: 'Alpha' }] },
      { key: schedulesCacheKey(SEASON_YEAR), data: [{
        teamId: 'alpha', teamName: 'Alpha', conference: 'Test', byeWeeks: [],
        weeklyGames: [{ week: 1, isHomeGame: true, isByeWeek: false, gameDate: '2026-09-05T18:00:00.000Z' }],
      }] },
    ]);
  });
  return { run, ownerId, userId, leagueId, schema };
}
