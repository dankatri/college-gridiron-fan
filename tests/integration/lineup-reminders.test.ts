import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { fixture, isolatedDatabaseURL, partial } from './fixture';
import { SEASON_YEAR } from '../../src/lib/season-config';
import { dataCache, lineupReminders, lineups, users } from '../../src/server/schema';
import { schedulesCacheKey } from '../../src/server/cache-keys';
import { projectNextKickoff } from '../../src/server/cache-projections';
import {
  REQUIRED_SLOTS,
  buildReminderDigests,
  projectPendingLineups,
  type ReminderRow,
} from '../../src/server/lineup-reminders';

const full = () => ['QB', 'QB', 'RB', 'RB', 'WR', 'WR'].map((position, slotIndex) => ({
  position, slotIndex, playerId: `player-${slotIndex}`,
}));

test('only members who can still act on an unfinished lineup are selected', async t => {
  const f = await fixture(t, isolatedDatabaseURL());
  const week = 5;
  const pending = () => f.run(tx => tx.execute<ReminderRow>(projectPendingLineups(SEASON_YEAR, week, 'thursday')));
  const names = (rows: readonly ReminderRow[]) => rows.map(row => `${row.displayName}:${row.filledSlots}`).sort();

  // Nobody has saved anything, so both members of the fixture league qualify.
  assert.deepEqual(names((await pending()).rows), ['Member:0', 'Owner:0']);

  // A half-filled lineup still counts, and reports its real progress.
  await f.run(tx => tx.insert(lineups).values({
    leagueId: f.leagueId, userId: f.userId, season: SEASON_YEAR, week, slots: partial(),
  }));
  assert.deepEqual(names((await pending()).rows), ['Member:1', 'Owner:0']);

  // A complete lineup drops out entirely.
  await f.run(tx => tx.update(lineups).set({ slots: full() }).where(eq(lineups.userId, f.userId)));
  assert.deepEqual(names((await pending()).rows), ['Owner:0']);

  // A lineup saved for a different week must not count as this week's.
  await f.run(tx => tx.update(lineups).set({ week: week + 1 }).where(eq(lineups.userId, f.userId)));
  assert.deepEqual(names((await pending()).rows), ['Member:0', 'Owner:0']);
});

test('opting out and an already-sent stage both remove a member from the next run', async t => {
  const f = await fixture(t, isolatedDatabaseURL());
  const week = 5;
  const pending = (stage: 'thursday' | 'saturday') =>
    f.run(tx => tx.execute<ReminderRow>(projectPendingLineups(SEASON_YEAR, week, stage)));

  await f.run(tx => tx.update(users).set({ lineupRemindersEnabled: 0 }).where(eq(users.id, f.ownerId)));
  assert.deepEqual((await pending('thursday')).rows.map(row => row.userId), [f.userId]);

  await f.run(tx => tx.insert(lineupReminders).values({
    userId: f.userId, season: SEASON_YEAR, week, stage: 'thursday', leagueCount: 1,
  }));
  assert.deepEqual((await pending('thursday')).rows, []);
  // The Saturday nudge is a separate stage, so it is still owed.
  assert.deepEqual((await pending('saturday')).rows.map(row => row.userId), [f.userId]);

  // The primary key, not the caller, is what stops a second send.
  await assert.rejects(f.run(tx => tx.insert(lineupReminders).values({
    userId: f.userId, season: SEASON_YEAR, week, stage: 'thursday', leagueCount: 1,
  })));
});

test('a reminder read carries one short row per membership and names every league', async t => {
  const f = await fixture(t, isolatedDatabaseURL());
  const week = 5;
  const secondLeague = randomUUID();
  await f.run(async tx => {
    await tx.execute(sql`insert into leagues (id, name, owner_id, season, join_code)
      values (${secondLeague}, ${'Zeta League'}, ${f.ownerId}, ${SEASON_YEAR}, ${'SECOND'})`);
    await tx.execute(sql`insert into league_members (league_id, user_id) values (${secondLeague}, ${f.userId})`);
    // A league from another season must never be reminded about.
    const stale = randomUUID();
    await tx.execute(sql`insert into leagues (id, name, owner_id, season, join_code)
      values (${stale}, ${'Last Year'}, ${f.ownerId}, ${SEASON_YEAR - 1}, ${'OLDONE'})`);
    await tx.execute(sql`insert into league_members (league_id, user_id) values (${stale}, ${f.userId})`);
  });

  const result = await f.run(tx => tx.execute<ReminderRow>(projectPendingLineups(SEASON_YEAR, week, 'thursday')));
  const member = buildReminderDigests(result.rows).find(digest => digest.userId === f.userId)!;
  assert.deepEqual(member.leagues.map(league => league.leagueName), ['Isolated fixture', 'Zeta League']);
  assert.equal(member.notifyToken.length, 36);
  assert.ok(REQUIRED_SLOTS === 6);
  // The read must stay a projection: no lineup slots are transferred.
  assert.ok(!JSON.stringify(result.rows).includes('slotIndex'));
});

test('the next kickoff is taken in SQL and ignores past, bye and other weeks', async t => {
  const f = await fixture(t, isolatedDatabaseURL());
  await f.run(tx => tx.update(dataCache).set({
    data: [{
      teamId: 'alpha', teamName: 'Alpha', conference: 'Test', byeWeeks: [],
      weeklyGames: [
        { week: 5, isHomeGame: true, isByeWeek: false, gameDate: '2000-01-01T00:00:00.000Z' },
        { week: 5, isHomeGame: true, isByeWeek: true, gameDate: '2090-10-01T00:00:00.000Z' },
        { week: 6, isHomeGame: true, isByeWeek: false, gameDate: '2090-10-02T00:00:00.000Z' },
        { week: 5, isHomeGame: false, isByeWeek: false, gameDate: '2090-10-03T23:30:00.000Z' },
        { week: 5, isHomeGame: false, isByeWeek: false, gameDate: '2090-10-04T18:00:00.000Z' },
      ],
    }],
  }).where(eq(dataCache.key, schedulesCacheKey(SEASON_YEAR))));

  const result = await f.run(tx => tx.execute<{ kickoff: string | null }>(projectNextKickoff(SEASON_YEAR, 5)));
  assert.equal(new Date(result.rows[0].kickoff!).toISOString(), '2090-10-03T23:30:00.000Z');
});
