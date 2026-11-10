import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  availabilityLabel,
  availabilityTooltip,
  playerAvailability,
  teamPlayedWeeks,
} from '../src/lib/player-availability';

const published = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const played = [0, 1, 2, 3, 4, 5, 6, 7, 8];

test('a player with no stat line all season is unknown rather than missing', () => {
  for (const lastPlayedWeek of [null, undefined]) {
    const result = playerAvailability({
      lastPlayedWeek, teamPlayedWeeks: played, availableWeeks: published, currentWeek: 9,
    });
    assert.equal(result.status, 'unknown');
    assert.deepEqual(result.missedWeeks, []);
    assert.equal(availabilityLabel(result), null);
  }
});

test('a player who recorded stats in the most recent week is active', () => {
  const result = playerAvailability({
    lastPlayedWeek: 8, teamPlayedWeeks: played, availableWeeks: published, currentWeek: 9,
  });
  assert.equal(result.status, 'active');
  assert.deepEqual(result.missedWeeks, []);
  assert.equal(availabilityLabel(result), null);
  assert.equal(availabilityTooltip(result), null);
});

test('weeks the team played without the player are reported as missed', () => {
  const result = playerAvailability({
    lastPlayedWeek: 6, teamPlayedWeeks: played, availableWeeks: published, currentWeek: 9,
  });
  assert.equal(result.status, 'missed');
  assert.deepEqual(result.missedWeeks, [7, 8]);
  assert.equal(result.lastPlayedWeek, 6);
  assert.equal(availabilityLabel(result), 'DNP 2WK');
});

test('a week the team did not play is never a missed game', () => {
  // Memphis took byes in weeks 4 and 10, so a quarterback who played every
  // other week must not be flagged for either.
  const result = playerAvailability({
    lastPlayedWeek: 9,
    teamPlayedWeeks: [0, 1, 2, 3, 5, 6, 7, 8, 9],
    availableWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    currentWeek: 11,
  });
  assert.equal(result.status, 'active');
  assert.deepEqual(result.missedWeeks, []);
});

test('a real gap is still caught when the team keeps playing', () => {
  const result = playerAvailability({
    lastPlayedWeek: 9,
    teamPlayedWeeks: [1, 2, 3, 4, 5, 6, 7, 9, 10],
    availableWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    currentWeek: 11,
  });
  assert.equal(result.status, 'missed');
  assert.deepEqual(result.missedWeeks, [10]);
  assert.equal(availabilityLabel(result), 'DNP W10');
});

test('the in-progress week is not counted against a player', () => {
  const result = playerAvailability({
    lastPlayedWeek: 7, teamPlayedWeeks: played, availableWeeks: published, currentWeek: 8,
  });
  assert.equal(result.status, 'active');
  assert.deepEqual(result.missedWeeks, []);
});

test('a week with no published stats cannot show anyone as absent', () => {
  const result = playerAvailability({
    lastPlayedWeek: 5, teamPlayedWeeks: played, availableWeeks: [0, 1, 2, 3, 4, 5, 8], currentWeek: 9,
  });
  assert.deepEqual(result.missedWeeks, [8]);
});

test('an unknown team schedule is missing data, not an absence', () => {
  const result = playerAvailability({
    lastPlayedWeek: 3, teamPlayedWeeks: [], availableWeeks: published, currentWeek: 9,
  });
  assert.equal(result.status, 'unknown');
  assert.equal(result.lastPlayedWeek, 3);
  assert.equal(availabilityLabel(result), null);
});

test('the tooltip reports an observation and disclaims a diagnosis', () => {
  const one = availabilityTooltip(
    playerAvailability({
      lastPlayedWeek: 7, teamPlayedWeeks: played, availableWeeks: published, currentWeek: 9,
    }),
    'Youngstown State',
  )!;
  assert.match(one, /Youngstown State/);
  assert.match(one, /no stats in Week 8/);
  assert.match(one, /last playing in Week 7/);
  assert.match(one, /injuries are not reported/);

  const many = availabilityTooltip(playerAvailability({
    lastPlayedWeek: 5, teamPlayedWeeks: played, availableWeeks: published, currentWeek: 9,
  }))!;
  assert.match(many, /Weeks 6, 7 and 8/);
});

test('played weeks come from completed non-bye games only', () => {
  const map = teamPlayedWeeks([
    {
      teamName: 'Memphis',
      weeklyGames: [
        { week: 3, isByeWeek: false, isCompleted: true },
        { week: 4, isByeWeek: true, isCompleted: true },
        { week: 5, isByeWeek: false, isCompleted: true },
        { week: 6, isByeWeek: false, isCompleted: false },
        { week: 7, isByeWeek: false },
      ],
    },
  ]);
  // Keyed by lower-cased name, because that is what players carry.
  assert.deepEqual(map.get('memphis'), [3, 5]);
  assert.equal(map.get('Memphis'), undefined);
});
