import { expect, test, type Page } from '@playwright/test';
import { lineup, live, mockApp, user } from './fixtures';

const noPredictions = async (page: Page) => {
  await expect(page.locator('body')).not.toContainText(/\bproj(?:ected|ections?)?\b/i);
  await expect(page.locator('body')).not.toContainText('9876.5');
};
const summary = (page: Page) => page.locator('[data-slot="card"]')
  .filter({ has: page.getByText('Lineup Summary', { exact: true }) }).filter({ visible: true });

for (const width of [1280, 390]) {
  test(`lineup, player details and live scoring show only actual points at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    app.state.playerPool = app.state.playerPool.map(player => ({ ...player, projectedPoints: 9876.5 }));
    app.state.lineups[0].slots[1].playerId = 'qb-future';
    app.state.lineups.push({ ...structuredClone(lineup), week: 2 });
    await page.route('**/api/player-log?**', route => route.fulfill({ json: {
      games: [{ ...live.stats[0], opponent: 'Other Team', isHomeGame: true, teamPoints: 31, opponentPoints: 14 }],
      totals: { games: 1, fantasyPoints: 19 },
    } }));
    await page.goto('/');
    await expect(summary(page).getByText('Actual Points', { exact: true })).toBeVisible();
    await expect(summary(page).getByText('19.0', { exact: true })).toBeVisible();
    await expect(page.getByText('Awaiting stats', { exact: true }).filter({ visible: true })).toHaveCount(1);
    await noPredictions(page);

    if (width < 768) await page.getByRole('button', { name: 'Browse Available Players', exact: true }).click();
    await page.getByRole('button', { name: 'Alex Finished', exact: true }).filter({ visible: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Alex Finished', exact: true });
    await expect(dialog.getByRole('table', { name: 'Game log' }).getByRole('row').nth(1).getByRole('cell').nth(3)).toHaveText('19.0');
    await expect(dialog.getByText('Season points', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: '2025 season totals' })).toBeVisible();
    await noPredictions(page);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    if (width < 768) await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('tab', { name: 'Live Scoring', exact: true }).click();
    await expect(page.getByText('Actual Points', { exact: true })).toBeVisible();
    await expect(page.getByText('Fantasy Points', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await noPredictions(page);
    await page.getByRole('tab', { name: 'All Players', exact: true }).click();
    await expect(page.getByText('Fantasy Points', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await noPredictions(page);

    await page.getByRole('tab', { name: 'Set Lineup', exact: true }).click();
    if (width < 768) {
      await page.getByRole('combobox', { name: 'Select game week' }).click();
      await page.getByRole('option', { name: /^Week 2:/ }).click();
    } else {
      await page.getByRole('tab', { name: 'W2', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: /Save Week 2 Lineup/ }).filter({ visible: true })).toBeEnabled();
    await expect(summary(page).getByText('Actual Points', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Awaiting stats', { exact: true }).filter({ visible: true })).toHaveCount(1);
    await noPredictions(page);
    expect(app.errors).toEqual([]);
  });
}

test('admin controls and member lineup dialogs omit projections while preserving edits and actual totals', async ({ page }) => {
  const app = await mockApp(page);
  app.state.playerPool = app.state.playerPool.map(player => ({ ...player, projectedPoints: 9876.5 }));
  let saved = false;
  await page.route('**/api/leagues/league-a/admin*', route => {
    if (route.request().method() === 'PUT') {
      expect(route.request().postDataJSON().slots[1].playerId).toBe('qb-future');
      saved = true;
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: {
      members: [{ userId: user.id, displayName: user.displayName, role: 'owner', weeksSet: 1, lineup, playerUsage: app.state.usage }],
      auditLog: [],
    } });
  });
  await page.route('**/api/leagues/league-a/member-lineup?**', route => route.fulfill({ json: {
    userId: user.id, username: user.displayName, week: 1, totalPoints: 19, projectedPoints: 9876.5, availableWeeks: [1],
    slots: lineup.slots.map(slot => ({
      ...slot, name: slot.playerId ? 'Alex Finished' : null, team: slot.playerId ? 'Completed University' : null,
      projectedPoints: 9876.5, actualPoints: slot.playerId ? 19 : null,
    })),
  } }));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await page.getByRole('tab', { name: 'League admin', exact: true }).click();
  await page.getByRole('button', { name: /Test Member Owner Week 1 set/ }).click();
  await noPredictions(page);
  await page.getByRole('button', { name: /Select a QB/ }).click();
  await expect(page.getByRole('option', { name: /Jamie Quarterback/ })).toBeVisible();
  await noPredictions(page);
  await page.getByRole('option', { name: /Jamie Quarterback/ }).click();
  await page.getByRole('button', { name: /Save.*lineup/i }).click();
  await expect(page.getByText("Saved Test Member's Week 1 lineup", { exact: true })).toBeVisible();
  expect(saved).toBe(true);
  await page.getByRole('tab', { name: 'Leaderboard', exact: true }).click();
  await page.getByRole('button', { name: 'Test Member', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Test Member', exact: true });
  await expect(dialog.getByText('Points scored', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('table').getByRole('row').nth(1).getByRole('cell').last()).toHaveText('19.0');
  await noPredictions(page);
  expect(app.errors).toEqual([]);
});
