import { expect, test } from '@playwright/test';
import { actualStats, live, mockApp, now, players } from './fixtures';

for (const width of [1280, 390]) {
  test(`live position filters run before the card limit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    const extras = Array.from({ length: 100 }, (_, index) => ({
      ...players[1], id: `extra-qb-${index}`, name: `Extra Quarterback ${index}`,
    }));
    app.state.playerPool = [...players, ...extras];
    let liveRequests = 0;
    await page.route('**/api/live?**', route => {
      liveRequests++;
      return route.fulfill({ json: {
      ...live, stats: [
        ...extras.map(player => ({ ...live.stats[0], playerId: player.id })),
        ...live.stats,
        ...['rb-future', 'wr-future'].map(playerId => ({
          ...actualStats(playerId, { fantasyPoints: 6, rushingYards: 60 }), week: 1, lastUpdated: now,
        })),
      ],
      } });
    });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Live Scoring', exact: true }).click();
    await page.getByRole('tab', { name: 'All Players', exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: 'All Players', exact: true });
    const filter = panel.getByRole('group', { name: 'Filter live players by position' });
    await expect(filter.getByRole('button')).toHaveText(['All', 'QB', 'RB', 'WR']);
    await expect(filter.getByRole('button', { pressed: true })).toHaveText('All');
    await expect(panel.getByRole('combobox')).toHaveCount(0);
    await expect(panel.locator('[data-slot="card"]')).toHaveCount(100);
    for (const [position, name, count] of [
      ['RB', 'Robin Runner', 1], ['WR', 'Sam Receiver', 1], ['QB', 'Extra Quarterback 0', 100],
    ] as const) {
      const button = filter.getByRole('button', { name: position, exact: true });
      await button.click();
      await expect(filter.getByRole('button', { pressed: true })).toHaveText(position);
      await expect(panel.locator('[data-slot="card"]')).toHaveCount(count);
      await expect(panel.getByText(name, { exact: true })).toBeVisible();
      await button.click();
      await expect(filter.getByRole('button', { pressed: true })).toHaveCount(1);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    await filter.getByRole('button', { name: 'All', exact: true }).click();
    await expect(filter.getByRole('button', { pressed: true })).toHaveText('All');
    await expect(panel.locator('[data-slot="card"]')).toHaveCount(100);
    await page.getByRole('tab', { name: 'Your Lineup', exact: true }).click();
    await expect(page.getByRole('tabpanel', { name: 'Your Lineup' }).getByText('Alex Finished', { exact: true })).toBeVisible();
    expect(liveRequests).toBe(1);
    expect(app.errors).toEqual([]);
  });
}

test('live position filter explains when a position has no recorded stats', async ({ page }) => {
  const app = await mockApp(page);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Live Scoring', exact: true }).click();
  await page.getByRole('tab', { name: 'All Players', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'All Players', exact: true });
  const filter = panel.getByRole('group', { name: 'Filter live players by position' });
  await filter.getByRole('button', { name: 'WR', exact: true }).press('Space');
  await expect(filter.getByRole('button', { pressed: true })).toHaveText('WR');
  await expect(panel.getByRole('status')).toHaveText('No WR players with recorded stats for Week 1.');
  await expect(panel.locator('[data-slot="card"]')).toHaveCount(0);
  expect(app.errors).toEqual([]);
});
