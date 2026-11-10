import { expect, test } from '@playwright/test';
import { actualStats, mockApp } from './fixtures';

const playerRow = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByRole('button', { name, exact: true }) });

/**
 * Week 1 is the default, and nothing can be "missed" before the first
 * completed week. Selecting week 2 makes week 1 a finished week, which is the
 * earliest point a gap can exist at all.
 */
async function goToWeekTwo(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'W2', exact: true }).click();
}

test('a player who stopped recording stats is flagged in the selection table', async ({ page }) => {
  const app = await mockApp(page);
  app.state.seasonStats.stats = [
    actualStats('qb-finished', { fantasyPoints: 44.2, lastPlayedWeek: 0 }),
    actualStats('qb-future', { fantasyPoints: 60, lastPlayedWeek: 1 }),
  ];
  await goToWeekTwo(page);

  const flagged = playerRow(page, 'Alex Finished').getByText('DNP W1', { exact: true });
  await expect(flagged).toBeVisible();

  // Still playing, and never played at all, are both left unmarked: a badge on
  // every backup would bury the players who actually disappeared.
  await expect(playerRow(page, 'Jamie Quarterback').getByText(/^DNP/)).toHaveCount(0);
  await expect(playerRow(page, 'Casey Walker Jr.').getByText(/^DNP/)).toHaveCount(0);
  expect(app.errors).toEqual([]);
});

test('the flag reports an observation rather than diagnosing an injury', async ({ page }) => {
  const app = await mockApp(page);
  app.state.seasonStats.stats = [actualStats('qb-finished', { lastPlayedWeek: 0 })];
  await goToWeekTwo(page);

  await playerRow(page, 'Alex Finished').getByText('DNP W1', { exact: true }).hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('recorded no stats in Week 1');
  await expect(tooltip).toContainText('injuries are not reported');
  expect(app.errors).toEqual([]);
});

test('the flag carries into the player detail dialog', async ({ page }) => {
  const app = await mockApp(page);
  app.state.seasonStats.stats = [actualStats('qb-finished', { lastPlayedWeek: 0 })];
  await goToWeekTwo(page);

  await playerRow(page, 'Alex Finished')
    .getByRole('button', { name: 'Alex Finished', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('DNP W1', { exact: true })).toBeVisible();
  expect(app.errors).toEqual([]);
});

test('season stats without the field leave every player unflagged', async ({ page }) => {
  // Payloads cached before this feature shipped carry no lastPlayedWeek, and
  // must not read as "everyone is missing".
  const app = await mockApp(page);
  app.state.seasonStats.stats = [actualStats('qb-finished', { fantasyPoints: 44.2 })];
  await goToWeekTwo(page);

  await expect(page.getByText(/^DNP/)).toHaveCount(0);
  await expect(playerRow(page, 'Alex Finished')).toBeVisible();
  expect(app.errors).toEqual([]);
});

test('a week the team sat out is not counted against the player', async ({ page }) => {
  // Real teams take more than one bye and the player payload carries none, so
  // byes have to come from the schedule. Flagging one would mark a healthy
  // starter as missing.
  const app = await mockApp(page);
  const team = app.state.schedules.find(entry => entry.teamName === 'Completed University')!;
  team.weeklyGames = [
    { week: 0, gameId: 'game-w0', isHomeGame: true, isByeWeek: false, opponent: 'Someone', gameDate: '2026-08-29T18:00:00.000Z', isCompleted: true, teamPoints: 21, opponentPoints: 10 },
    { week: 1, gameId: 'game-bye', isHomeGame: false, isByeWeek: true, opponent: '', gameDate: '2026-09-05T18:00:00.000Z', isCompleted: true },
  ];
  app.state.seasonStats.stats = [actualStats('qb-finished', { fantasyPoints: 44.2, lastPlayedWeek: 0 })];
  await goToWeekTwo(page);

  await expect(playerRow(page, 'Alex Finished')).toBeVisible();
  await expect(page.getByText(/^DNP/)).toHaveCount(0);
  expect(app.errors).toEqual([]);
});
