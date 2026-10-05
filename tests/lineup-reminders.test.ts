import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REQUIRED_SLOTS,
  buildReminderDigests,
  describeKickoff,
  isReminderStage,
  isRemindableWeek,
  type ReminderRow,
} from '../src/server/lineup-reminders';
import { lineupReminderEmail } from '../src/server/mailer';

const row = (overrides: Partial<ReminderRow> = {}): ReminderRow => ({
  userId: 'user-1', email: 'member@example.com', displayName: 'Member',
  notifyToken: '11111111-1111-4111-8111-111111111111',
  leagueId: 'league-1', leagueName: 'Beta League', filledSlots: 0, ...overrides,
});

test('a member in several leagues gets one digest listing each of them once', () => {
  const digests = buildReminderDigests([
    row({ leagueId: 'league-2', leagueName: 'Zeta League', filledSlots: 4 }),
    row(),
    row(),
    row({ userId: 'user-2', email: 'other@example.com', displayName: 'Other' }),
  ]);

  assert.equal(digests.length, 2);
  const [first] = digests;
  assert.equal(first.userId, 'user-1');
  assert.deepEqual(first.leagues.map(league => league.leagueName), ['Beta League', 'Zeta League']);
  assert.deepEqual(first.leagues.map(league => league.filledSlots), [0, 4]);
});

test('a member without a deliverable address is never a recipient', () => {
  assert.deepEqual(buildReminderDigests([row({ email: '' })]), []);
});

test('reminders only go out while the open week can still be changed', () => {
  const thursday = new Date('2026-10-01T13:00:00Z');
  assert.equal(isRemindableWeek(5, thursday, new Set()), true);
  // Out of season, or a week whose games are all final, has nothing to ask for.
  assert.equal(isRemindableWeek(null, thursday, new Set()), false);
  assert.equal(isRemindableWeek(5, thursday, new Set([5])), false);
  // Week 6 has not opened yet on that date.
  assert.equal(isRemindableWeek(6, thursday, new Set()), false);
});

test('only the two defined stages are accepted, so a typo cannot bypass dedup', () => {
  assert.equal(isReminderStage('thursday'), true);
  assert.equal(isReminderStage('saturday'), true);
  assert.equal(isReminderStage('Thursday'), false);
  assert.equal(isReminderStage(''), false);
});

test('a half-filled lineup is described by its progress, not as untouched', () => {
  const message = lineupReminderEmail({
    displayName: 'Member', weekLabel: 'Week 5', requiredSlots: REQUIRED_SLOTS,
    leagues: [{ leagueName: 'Beta League', filledSlots: 4 }, { leagueName: 'Zeta League', filledSlots: 0 }],
    lineupUrl: 'https://example.test/', unsubscribeUrl: 'https://example.test/api/notifications/unsubscribe?token=abc',
    kickoff: 'Saturday, Oct 3, 12:00 PM ET', urgent: false,
  });

  assert.match(message.text, /Beta League — 4 of 6 slots filled/);
  assert.match(message.text, /Zeta League — no players picked/);
  assert.match(message.text, /Saturday, Oct 3, 12:00 PM ET/);
  assert.match(message.subject, /Week 5 is open/);
  // One-click unsubscribe must be honoured by mail clients, not just by humans.
  assert.equal(message.headers?.['List-Unsubscribe'], '<https://example.test/api/notifications/unsubscribe?token=abc>');
  assert.equal(message.headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

test('league names are escaped so a league cannot inject markup into the email', () => {
  const message = lineupReminderEmail({
    displayName: 'Member', weekLabel: 'Week 5', requiredSlots: REQUIRED_SLOTS,
    leagues: [{ leagueName: '<img src=x onerror=alert(1)>', filledSlots: 0 }],
    lineupUrl: 'https://example.test/', unsubscribeUrl: 'https://example.test/u',
    kickoff: null, urgent: true,
  });

  assert.ok(!message.html.includes('<img'));
  assert.match(message.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(message.subject, /Last call/);
});

test('an unknown kickoff leaves the email without a fabricated deadline', () => {
  assert.equal(describeKickoff(null), null);
  assert.equal(describeKickoff(new Date('nonsense')), null);
  assert.match(describeKickoff(new Date('2026-10-03T16:00:00Z'))!, /Saturday, Oct 3, 12:00 PM ET/);
});
