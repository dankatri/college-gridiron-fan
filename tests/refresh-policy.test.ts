import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CfbdGame, CfbdGamePlayers } from '../src/server/cfbd';
import { buildLiveStats, buildTeamSchedules } from '../src/server/cfbd-transform';
import { weekBoundary, weekForDate } from '../src/lib/season-config';
import { assertLiveCompleteness, assertScheduleCompleteness, refreshWeeks, shouldDiscover } from '../scripts/lib/refresh-policy';
import { cacheContentVersion, IncompleteSourceError } from '../scripts/lib/cache';
import type { TeamSchedule, WeeklyGame } from '../src/lib/types';

const game = (id: number, startDate = '2026-09-07T18:00:00.000Z'): CfbdGame => ({
  id, season: 2026, week: 1, seasonType: 'regular', startDate, startTimeTBD: false,
  completed: true, neutralSite: false, homeId: 1, homeTeam: 'Alpha', homeConference: 'FBS',
  homePoints: 21, awayId: 2, awayTeam: 'FCS Opponent', awayConference: 'FCS', awayPoints: 7,
});
const box = (id: number, yards: number): CfbdGamePlayers => ({
  id, teams: ['Alpha', 'FCS Opponent'].map((team, index) => ({
    team, conference: index === 0 ? 'FBS' : 'FCS', homeAway: index === 0 ? 'home' : 'away', points: index === 0 ? 21 : 7,
    categories: ['passing', 'rushing', 'receiving'].map(name => ({
      name, types: [{ name: 'YDS', athletes: name === 'passing' ? [{ id: index === 0 ? '1' : 'fcs-1', name: 'Fixture', stat: String(yards) }] : [] }],
    })),
  })),
});

test('broken schedule health always triggers independent discovery', () => {
  const now = new Date('2026-09-07T12:00:00Z');
  assert.equal(shouldDiscover(null, null, now, false), true);
  assert.equal(shouldDiscover([], now.toISOString(), now, false), true);
  assert.equal(shouldDiscover([{ teamId: 'x', teamName: 'Alpha', conference: 'FBS', byeWeeks: [], weeklyGames: [] }], 'invalid', now, false), true);
  assert.equal(shouldDiscover([{ teamId: 'x', teamName: 'Alpha', conference: 'FBS', byeWeeks: [], weeklyGames: [] }], now.toISOString(), now, true), true);
});

test('Monday games, overdue games and closed-week correction sweeps remain discoverable', () => {
  assert.ok(refreshWeeks([game(1)], new Date('2026-09-07T22:00:00Z'), false).includes(1));
  assert.ok(refreshWeeks([{ ...game(1), completed: false }], new Date('2026-09-20T22:00:00Z'), true).includes(1));
  assert.ok(refreshWeeks([], new Date('2026-09-10T12:00:00Z'), true).includes(1));
  assert.deepEqual(refreshWeeks([], new Date(), true, 0), [0]);
  assert.throws(() => refreshWeeks([], new Date(), true, 19));
});

test('partial completed boxes retain the whole snapshot, complete downward corrections are accepted', () => {
  const player = { id: 'qb-a', name: 'Alpha', team: 'Alpha', position: 'QB' as const, conference: 'FBS', projectedPoints: 10 };
  const prior = buildLiveStats({ gamePlayers: [box(1, 300)], week: 1, idByAthlete: new Map([['1', 'qb-a']]) });
  assert.throws(() => assertLiveCompleteness([game(1)], [], { stats: prior }, [player]), IncompleteSourceError);
  assert.throws(() => assertLiveCompleteness([game(1)], [{ ...box(1, 300), teams: box(1, 300).teams.slice(0, 1) }], { stats: prior }, [player]), IncompleteSourceError);
  assert.doesNotThrow(() => assertLiveCompleteness([game(1)], [box(1, 100)], { stats: prior }, [player]));
  const corrected = buildLiveStats({ gamePlayers: [box(1, 100)], week: 1, idByAthlete: new Map([['1', 'qb-a']]) });
  assert.ok(corrected[0].fantasyPoints < prior[0].fantasyPoints);
});

test('overlapping source chunks are not counted twice, but distinct games for a player are added', () => {
  const stats = buildLiveStats({
    gamePlayers: [box(1, 100), box(1, 100), box(2, 200)], week: 1,
    idByAthlete: new Map([['1', 'qb-a']]), gameIds: new Set(['1', '2']),
  });
  assert.equal(stats.length, 1);
  assert.equal(stats[0].passingYards, 300);
  assert.equal(stats[0].fantasyPoints, 12);
});

test('FCS opponents are retained in FBS schedules without joining the selectable pool', () => {
  const schedules = buildTeamSchedules({
    teams: [{ id: 1, school: 'Alpha', mascot: null, abbreviation: null, conference: 'FBS', classification: 'fbs', color: null, alternateColor: null, logos: [] }],
    games: [game(1)], weekForDate, regularSeasonLastWeek: 14,
  });
  assert.equal(schedules.length, 1);
  assert.equal(schedules[0].weeklyGames[0].opponent, 'FCS Opponent');
});

test('content versions ignore observation clocks but accept reduced and removed stat lines', () => {
  const first = { week: 1, updatedAt: 'old', stats: [{ passingYards: 100, lastUpdated: 'old' }] };
  const observed = { stats: [{ lastUpdated: 'new', passingYards: 100 }], updatedAt: 'new', week: 1 };
  assert.equal(cacheContentVersion(first), cacheContentVersion(observed));
  assert.notEqual(cacheContentVersion(first), cacheContentVersion({ ...first, stats: [] }));
});

const monday = new Date('2026-09-21T08:00:00Z');
const finalGame: WeeklyGame = {
  week: 3, gameId: 'a', isHomeGame: true, isByeWeek: false,
  isCompleted: true, teamPoints: 21, opponentPoints: 0,
};
const schedule = (games: WeeklyGame[], teamId = 'alpha'): TeamSchedule => ({
  teamId, teamName: teamId, conference: 'FBS', byeWeeks: [], weeklyGames: games,
});

test('schedule publication cannot reopen final weeks or erase their terminal evidence', () => {
  const previous = [schedule([finalGame])];
  for (const games of [
    [{ ...finalGame, isCompleted: false }],
    [{ ...finalGame, week: 4 }],
    [{ ...finalGame, teamPoints: undefined }],
    [finalGame, { ...finalGame, gameId: 'new', isCompleted: false }],
    [finalGame, { ...finalGame, gameId: 'new' }],
    [{ ...finalGame, gameId: 'replacement' }],
  ]) {
    assert.throws(() => assertScheduleCompleteness(previous, [schedule(games)], monday), IncompleteSourceError);
  }
  assert.doesNotThrow(() => assertScheduleCompleteness(previous, [schedule([{ ...finalGame, teamPoints: 14 }])], monday),
    'Downward score corrections must remain publishable');
  assert.doesNotThrow(() => assertScheduleCompleteness(previous, [
    schedule([finalGame, { ...finalGame, gameId: 'late-discovered', isCompleted: false }]),
  ], weekBoundary(4)), 'Once the calendar closes editing, a late fixture cannot reopen the week');
});

test('missing unfinished fixtures cannot manufacture a final slate, but explicit reschedules can move them', () => {
  const waiting = { ...finalGame, gameId: 'b', isCompleted: false };
  const previous = [schedule([finalGame, waiting])];
  assert.throws(() => assertScheduleCompleteness(previous, [schedule([finalGame])], monday), IncompleteSourceError);
  assert.doesNotThrow(() => assertScheduleCompleteness(previous, [schedule([finalGame, { ...waiting, week: 4 }])], monday));
  const future = [schedule([{ ...waiting, week: 4 }, { ...waiting, gameId: 'c', week: 5 }])];
  assert.doesNotThrow(() => assertScheduleCompleteness(future, [schedule([{ ...waiting, gameId: 'c', week: 5 }])], monday));
  assert.doesNotThrow(() => assertScheduleCompleteness(
    [schedule([{ ...finalGame, week: 4 }])],
    [schedule([{ ...finalGame, week: 4 }, { ...waiting, week: 4 }])], monday,
  ), 'An unopened week is not frozen by anomalous final flags');
});

test('every duplicate representation is checked, including an unfinished team row disappearing', () => {
  const inconsistent = [schedule([finalGame]), schedule([{ ...finalGame, isCompleted: false }], 'beta')];
  assert.throws(() => assertScheduleCompleteness(null, inconsistent, monday), IncompleteSourceError);
  assert.throws(() => assertScheduleCompleteness(inconsistent, [
    schedule([finalGame]), schedule([{ ...finalGame, gameId: 'future', week: 4, isCompleted: false }], 'beta'),
  ], monday), IncompleteSourceError);
  const consistent = [schedule([finalGame]), schedule([{ ...finalGame, isHomeGame: false, teamPoints: 0, opponentPoints: 21 }], 'beta')];
  assert.doesNotThrow(() => assertScheduleCompleteness(null, consistent, monday));
});
