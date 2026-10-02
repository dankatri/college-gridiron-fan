import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import { fixture, isolatedDatabaseURL } from './fixture';
import { dataCache } from '../../src/server/schema';
import { schedulesCacheKey } from '../../src/server/cache-keys';
import { sourceMetadataKey } from '../../src/server/cache-publication';
import { projectScheduleGate } from '../../src/server/cache-projections';
import { scheduleGate, shouldDiscover, shouldDiscoverGate } from '../../scripts/lib/refresh-policy';
import { SEASON_YEAR } from '../../src/lib/season-config';
import type { TeamSchedule } from '../../src/lib/types';

type GateRow = {
  key: string; data: unknown; revision: string;
  present: boolean | null; malformed: boolean | null; kickoffs: string[] | null;
};

const KEY = schedulesCacheKey(SEASON_YEAR);
const NOW = new Date('2026-09-26T23:30:00.000Z');
const IN_WINDOW = '2026-09-26T23:00:00.000Z';
const LONG_PAST = '2026-09-01T00:00:00.000Z';

const team = (name: string, games: unknown[]) => ({
  teamId: name, teamName: name, conference: 'Test', byeWeeks: [], weeklyGames: games,
});
const game = (extra: Record<string, unknown>) => ({
  week: 4, opponent: 'Foe', isHomeGame: true, isByeWeek: false, ...extra,
});

const cases: Array<{ name: string; data: unknown }> = [
  { name: 'a kickoff inside the window', data: [team('A', [game({ gameDate: IN_WINDOW })])] },
  { name: 'only long-finished games', data: [team('A', [game({ gameDate: LONG_PAST })])] },
  { name: 'a bye week', data: [team('A', [game({ gameDate: IN_WINDOW, isByeWeek: true })])] },
  { name: 'a game with no date', data: [team('A', [game({})])] },
  { name: 'a game with an empty date', data: [team('A', [game({ gameDate: '' })])] },
  { name: 'a game with an unparseable date', data: [team('A', [game({ gameDate: 'not-a-date' })])] },
  { name: 'a null team', data: [null] },
  { name: 'a team with no weeklyGames', data: [{ teamId: 'A', teamName: 'A', conference: 'x', byeWeeks: [] }] },
  { name: 'weeklyGames that is not an array', data: [{ teamId: 'A', teamName: 'A', conference: 'x', byeWeeks: [], weeklyGames: {} }] },
  { name: 'a null game entry', data: [team('A', [null])] },
  { name: 'the same kickoff on both teams', data: [team('A', [game({ gameDate: IN_WINDOW })]), team('B', [game({ gameDate: IN_WINDOW })])] },
  { name: 'an empty season', data: [] },
  { name: 'a payload that is not an array', data: { teams: [] } },
];

test('the SQL discovery gate decides exactly as the schedule in memory would', async t => {
  const f = await fixture(t, isolatedDatabaseURL());
  await f.run(tx => tx.insert(dataCache).values({
    key: sourceMetadataKey(KEY),
    data: { sourceStatus: 'ready', sourceCheckedAt: NOW.toISOString(), generation: 1 },
  }));

  for (const scenario of cases) {
    await f.run(tx => tx.update(dataCache).set({ data: scenario.data as object }).where(eq(dataCache.key, KEY)));
    const projected = await f.run(tx => tx.execute<GateRow>(projectScheduleGate(SEASON_YEAR)));
    const facts = projected.rows[0];
    const fromSql = {
      present: facts?.present ?? false,
      malformed: facts?.malformed ?? false,
      kickoffs: facts?.kickoffs ?? [],
    };
    const schedules = (Array.isArray(scenario.data) ? scenario.data : null) as TeamSchedule[] | null;
    const fromMemory = scheduleGate(schedules);

    assert.equal(fromSql.present, fromMemory.present, `present for ${scenario.name}`);
    assert.equal(fromSql.malformed, fromMemory.malformed, `malformed for ${scenario.name}`);
    assert.deepEqual(
      [...new Set(fromSql.kickoffs.map(String))].sort(),
      [...new Set(fromMemory.kickoffs.map(String))].sort(),
      `kickoffs for ${scenario.name}`,
    );
    // The decision is the contract; ordering and duplicate kickoffs are not.
    assert.equal(
      shouldDiscoverGate(fromSql, NOW.toISOString(), NOW, false),
      shouldDiscover(schedules, NOW.toISOString(), NOW, false),
      `discovery decision for ${scenario.name}`,
    );
  }

  // A stale or swept observation still forces discovery whatever the schedule says.
  const quiet = [team('A', [game({ gameDate: LONG_PAST })])];
  await f.run(tx => tx.update(dataCache).set({ data: quiet }).where(eq(dataCache.key, KEY)));
  const settled = await f.run(tx => tx.execute<GateRow>(projectScheduleGate(SEASON_YEAR)));
  const gate = {
    present: settled.rows[0].present!, malformed: settled.rows[0].malformed!, kickoffs: settled.rows[0].kickoffs!,
  };
  assert.equal(shouldDiscoverGate(gate, NOW.toISOString(), NOW, false), false);
  assert.equal(shouldDiscoverGate(gate, '2026-09-20T00:00:00.000Z', NOW, false), true, 'a stale observation re-discovers');
  assert.equal(shouldDiscoverGate(gate, NOW.toISOString(), NOW, true), true, 'a sweep always discovers');
  assert.equal(shouldDiscoverGate(gate, null, NOW, false), true, 'an unobserved schedule re-discovers');

  // The gate exists to keep the schedule inside the database.
  const season = Array.from({ length: 136 }, (_, index) => team(`Team ${index}`, Array.from({ length: 13 }, (_, week) => game({
    week,
    gameId: `${401850000 + index * 13 + week}`,
    gameDate: new Date(Date.UTC(2026, 7, 29 + week * 7 - ((index + week) % 5), 16 + ((index * 3 + week) % 8), 0, 0)).toISOString(),
  }))));
  await f.run(tx => tx.update(dataCache).set({ data: season }).where(eq(dataCache.key, KEY)));
  const full = await f.run(tx => tx.select().from(dataCache).where(eq(dataCache.key, KEY)));
  const gated = await f.run(tx => tx.execute<GateRow>(projectScheduleGate(SEASON_YEAR)));
  const fullBytes = Buffer.byteLength(JSON.stringify(full));
  const gatedBytes = Buffer.byteLength(JSON.stringify(gated.rows));
  assert.ok(gatedBytes * 4 < fullBytes, 'the gate must not transfer the schedule');
  t.diagnostic(JSON.stringify({ fullBytes, gatedBytes }));
});
