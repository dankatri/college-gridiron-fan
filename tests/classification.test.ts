import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CLASSIFICATIONS, parseClassifications } from '../src/lib/classification';
import { includedClassifications } from '../src/server/classifications';
import { buildPlayers, buildTeamSchedules, teamClassification } from '../src/server/cfbd-transform';
import type { CfbdGame, CfbdRosterPlayer, CfbdTeam } from '../src/server/cfbd';

const team = (overrides: Partial<CfbdTeam> & Pick<CfbdTeam, 'id' | 'school'>): CfbdTeam => ({
  mascot: null, abbreviation: null, conference: 'Big Sky', classification: 'fcs',
  color: null, alternateColor: null, logos: null, ...overrides,
});

const TEAMS: CfbdTeam[] = [
  team({ id: 1, school: 'Montana', conference: 'Big Sky', classification: 'fcs' }),
  team({ id: 2, school: 'Alabama', conference: 'SEC', classification: 'fbs' }),
  team({ id: 3, school: 'Unlabelled State', conference: 'MVFC', classification: null }),
];

const ROSTER: CfbdRosterPlayer[] = [
  { id: '10', firstName: 'Fcs', lastName: 'Passer', team: 'Montana', position: 'QB', jersey: 1, year: 3 },
  { id: '20', firstName: 'Fbs', lastName: 'Passer', team: 'Alabama', position: 'QB', jersey: 2, year: 4 },
  { id: '30', firstName: 'Unknown', lastName: 'Passer', team: 'Unlabelled State', position: 'QB', jersey: 3, year: 2 },
  { id: '40', firstName: 'Division', lastName: 'Two', team: 'Not Invited', position: 'QB', jersey: 4, year: 1 },
];

test('a division list is parsed, deduplicated and ordered, and an unknown division is rejected', () => {
  assert.deepEqual(parseClassifications('fbs,fcs'), ['fbs', 'fcs']);
  assert.deepEqual(parseClassifications(' FCS , fbs , fcs '), ['fbs', 'fcs']);
  // A missing or blank value must not produce an empty pool.
  assert.deepEqual(parseClassifications(undefined), [...DEFAULT_CLASSIFICATIONS]);
  assert.deepEqual(parseClassifications('   '), [...DEFAULT_CLASSIFICATIONS]);
  assert.throws(() => parseClassifications('fbs,d2'), /Unknown division\(s\): d2/);
});

test('FCS is opt-in: an unset environment still publishes the FBS-only pool', () => {
  assert.deepEqual(includedClassifications({}), ['fbs']);
  assert.deepEqual(includedClassifications({ INCLUDED_DIVISIONS: 'fbs,fcs' }), ['fbs', 'fcs']);
});

test('players and schedules carry their division, and an unlabelled team is not guessed as FBS', () => {
  const players = buildPlayers({
    teams: TEAMS, roster: ROSTER, statsByPlayer: new Map(), gamesPlayed: new Map(),
  });

  const byName = new Map(players.map(player => [player.name, player]));
  assert.equal(byName.get('Fcs Passer')?.classification, 'fcs');
  assert.equal(byName.get('Fbs Passer')?.classification, 'fbs');
  assert.equal(byName.get('Unknown Passer')?.classification, undefined);
  // A roster entry whose team is outside the requested divisions is dropped.
  assert.equal(byName.has('Division Two'), false);

  assert.equal(teamClassification(TEAMS[2]), undefined);

  const schedules = buildTeamSchedules({
    teams: TEAMS, games: [], weekForDate: () => 1, regularSeasonLastWeek: 14,
  });
  assert.equal(schedules.find(entry => entry.teamName === 'Montana')?.classification, 'fcs');
  assert.equal(schedules.find(entry => entry.teamName === 'Unlabelled State')?.classification, undefined);
});

test('a cross-division game is counted once per team rather than twice', () => {
  // The same fixture is what CFBD returns from both the fbs and fcs queries;
  // getGames de-duplicates by id before the schedule is built.
  const game: CfbdGame = {
    id: 99, season: 2026, week: 1, seasonType: 'regular', startDate: '2026-09-05T18:00:00.000Z',
    startTimeTBD: false, completed: false, neutralSite: false,
    homeId: 2, homeTeam: 'Alabama', homeConference: 'SEC', homePoints: null,
    awayId: 1, awayTeam: 'Montana', awayConference: 'Big Sky', awayPoints: null,
  };

  const schedules = buildTeamSchedules({
    teams: TEAMS, games: [game], weekForDate: () => 1, regularSeasonLastWeek: 14,
  });

  for (const name of ['Alabama', 'Montana']) {
    const entry = schedules.find(schedule => schedule.teamName === name)!;
    assert.equal(entry.weeklyGames.filter(weekly => weekly.gameId === '99').length, 1);
  }
});
