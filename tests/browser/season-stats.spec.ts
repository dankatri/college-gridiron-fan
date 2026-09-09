import { expect, test } from '@playwright/test';
import { actualStats, mockApp } from './fixtures';

const playerRow = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByRole('button', { name, exact: true }) });

test('selection columns and sorting use season totals even for a future selected week', async ({ page }) => {
  const app = await mockApp(page);
  app.state.seasonStats.stats = [
    actualStats('qb-finished', { fantasyPoints: 44.2, passingYards: 900 }),
    actualStats('qb-future', { fantasyPoints: 60, passingYards: 700 }),
  ];
  await page.goto('/');
  const points = (name: string) => playerRow(page, name).getByTitle('Actual points scored so far in 2026');
  await expect(points('Jamie Quarterback')).toHaveText('60.0');
  await expect(points('Alex Finished')).toHaveText('44.2');
  await expect(points('Casey Walker Jr.')).toHaveText('0.0');
  await expect(page.getByRole('row').nth(1)).toContainText('Jamie Quarterback');
  await expect(page.getByTitle('Actual points scored in Week 1').filter({ visible: true })).toContainText('19.0');
  await page.getByRole('button', { name: 'Pass Yds', exact: true }).click();
  await expect(page.getByRole('row').nth(1)).toContainText('Alex Finished');
  await expect(playerRow(page, 'Alex Finished').getByRole('cell').nth(5)).toHaveText('900');
  for (const week of ['W0', 'W2']) {
    await page.getByRole('tab', { name: week, exact: true }).click();
    await expect(points('Alex Finished')).toHaveText('44.2');
    await expect(page.getByRole('columnheader', { name: 'Season pts', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Pass Yds', exact: true }).click();
  await expect(page.getByRole('row').nth(1)).toContainText('Casey Walker Jr.');
  expect(app.requests.filter(request => request === 'GET /api/season-stats')).toHaveLength(1);
  expect(app.errors).toEqual([]);
});

test('mobile selection cards use season totals rather than player projections', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const app = await mockApp(page);
  app.state.seasonStats.stats = [actualStats('qb-future', { fantasyPoints: 60 })];
  await page.goto('/');
  await page.getByRole('button', { name: 'Browse Available Players', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Available Players', exact: true });
  await expect(picker.getByText('Season: 60.0 pts', { exact: true })).toBeVisible();
  await expect(picker.getByText('Season: 0.0 pts', { exact: true })).toHaveCount(2);
  await page.getByRole('tab', { name: 'Running Backs', exact: true }).click();
  await expect(picker.getByText('Season: 0.0 pts', { exact: true })).toHaveCount(2);
  expect(app.requests.filter(request => request === 'GET /api/season-stats')).toHaveLength(1);
  expect(app.errors).toEqual([]);
});

test('unavailable season stats never become projections or zero and can be retried', async ({ page }) => {
  const app = await mockApp(page);
  app.state.seasonFail = true;
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: 'Season stats are unavailable' })).toBeVisible();
  await expect(playerRow(page, 'Alex Finished').getByTitle(/this is not a zero score/)).toHaveText('?');
  app.state.seasonFail = false;
  await page.getByRole('button', { name: 'Retry season stats', exact: true }).click();
  await expect(playerRow(page, 'Alex Finished').getByTitle('Actual points scored so far in 2026')).toHaveText('19.0');
  app.state.seasonFail = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Showing last available season stats' })).toBeVisible();
  await expect(playerRow(page, 'Alex Finished').getByTitle('Actual points scored so far in 2026')).toHaveText('19.0');
  expect(app.errors).toEqual([]);
});
