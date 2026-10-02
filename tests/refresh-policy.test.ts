import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CfbdGame, CfbdGamePlayers } from '../src/server/cfbd';
import { buildLiveStats, buildTeamSchedules } from '../src/server/cfbd-transform';
import { weekBoundary, weekForDate } from '../src/lib/season-config';
import { assessLiveCompleteness, assertScheduleCompleteness, buildAcceptedLiveStats, refreshWeeks, shouldDiscover } from '../scripts/lib/refresh-policy';
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

const alphaQb = { id: 'qb-a', name: 'Alpha', team: 'Alpha', position: 'QB' as const, conference: 'FBS', projectedPoints: 10 };
const ids = new Map([['1', 'qb-a']]);

test('structural ambiguity still retains the whole accepted snapshot', () => {
  const prior = buildLiveStats({ gamePlayers: [box(1, 300)], week: 1, idByAthlete: ids });
  assert.throws(() => assessLiveCompleteness([game(1)], [box(1, 300)], { stats: prior }, []), IncompleteSourceError);
  assert.throws(() => assessLiveCompleteness([], [], { stats: prior }, [alphaQb]), IncompleteSourceError);
});

test('partial completed boxes hold that team at its accepted stats, complete downward corrections are accepted', () => {
  const prior = buildLiveStats({ gamePlayers: [box(1, 300)], week: 1, idByAthlete: ids });
  for (const boxes of [[], [{ ...box(1, 100), teams: box(1, 100).teams.slice(1) }], [{ ...box(1, 100), teams: box(1, 100).teams.map(team => ({ ...team, points: 0 })) }]]) {
    const { stats, holds } = buildAcceptedLiveStats({ games: [game(1)], boxes, previous: { stats: prior }, players: [alphaQb], idByAthlete: ids, week: 1 });
    assert.deepEqual(holds.map(hold => hold.team), ['Alpha']);
    assert.deepEqual(stats, prior, 'A held team keeps its accepted stat lines rather than regressing');
  }
  const { stats: corrected, holds } = buildAcceptedLiveStats({ games: [game(1)], boxes: [box(1, 100)], previous: { stats: prior }, players: [alphaQb], idByAthlete: ids, week: 1 });
  assert.deepEqual(holds, []);
  assert.ok(corrected[0].fantasyPoints < prior[0].fantasyPoints);
});

test('one team missing its box score does not freeze scoring for the rest of the week', () => {
  const betaWr = { id: 'wr-b', name: 'Beta', team: 'Beta', position: 'WR' as const, conference: 'FBS', projectedPoints: 5 };
  const betaGame: CfbdGame = { ...game(2), homeId: 3, homeTeam: 'Beta', homePoints: 14, awayId: 4, awayTeam: 'Gamma', awayPoints: 3 };
  const betaBox: CfbdGamePlayers = { id: 2, teams: [{ team: 'Beta', conference: 'FBS', homeAway: 'home', points: 14, categories: [
    { name: 'passing', types: [] }, { name: 'rushing', types: [] },
    { name: 'receiving', types: [{ name: 'YDS', athletes: [{ id: '2', name: 'Fixture', stat: '90' }] }] },
  ] }] };
  const idsBoth = new Map([['1', 'qb-a'], ['2', 'wr-b']]);
  const { stats, holds } = buildAcceptedLiveStats({
    games: [game(1), betaGame], boxes: [betaBox], previous: null, players: [alphaQb, betaWr], idByAthlete: idsBoth, week: 1,
  });
  assert.deepEqual(holds, [{ gameId: 1, team: 'Alpha', reason: 'A completed or previously scored game has missing team statistics' }]);
  assert.deepEqual(stats.map(stat => [stat.playerId, stat.receivingYards]), [['wr-b', 90]]);
});

test('a non-FBS opponent missing its box score entirely does not block the FBS side', () => {
  // CFBD frequently never publishes box-score stats for an FCS opponent in an
  // FBS-vs-FCS game; only 'Alpha' is in our tracked roster pool.
  assert.deepEqual(assessLiveCompleteness(
    [game(1)], [{ ...box(1, 100), teams: box(1, 100).teams.slice(0, 1) }], null, [alphaQb],
  ), []);
});

test('a final game the source never published a box for is held, not scored as zero', () => {
  // CFBD published game 401856881 as final while omitting it from
  // /games/players entirely, which read as 0.0 for every player in it.
  const { stats, holds } = buildAcceptedLiveStats({
    games: [game(1)], boxes: [], previous: null, players: [alphaQb], idByAthlete: ids, week: 1,
  });
  assert.deepEqual(stats, []);
  assert.deepEqual(holds.map(hold => hold.team), ['Alpha'],
    'The team must be reported as pending so its players are not read as having scored zero');
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

test('a completed game keeps its polling window open while its box score settles', () => {
  const kickoff = new Date('2026-09-19T23:00:00.000Z');
  const played: WeeklyGame = { week: 3, gameId: 'a', gameDate: kickoff, isHomeGame: true, isByeWeek: false, isCompleted: true };
  const settling = new Date('2026-09-20T03:30:00.000Z');
  assert.equal(
    shouldDiscover([schedule([played])], settling.toISOString(), settling, false), true,
    'A scoreboard marked final before its box score lands must not stop the gameday refresh',
  );
  const stale = new Date('2026-09-20T09:00:00.000Z');
  assert.equal(shouldDiscover([schedule([played])], stale.toISOString(), stale, false), false,
    'The window is still bounded, so a settled game falls back to the hourly sweep');
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
