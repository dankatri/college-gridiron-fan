import { expect, test } from '@playwright/test';
import { mockApp, teamLogo } from './fixtures';

for (const width of [1280, 390]) {
  test(`player lists use team logos and retain school names in details at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    app.state.playerPool = app.state.playerPool.map((player, index) => ({
      ...player, teamLogoUrl: index === 0 ? teamLogo : index === 1 ? undefined : '/missing-team-logo.svg',
    }));
    await page.route('**/missing-team-logo.svg', route => route.fulfill({ status: 404, body: '' }));
    await page.goto('/');
    if (width < 768) {
      await page.getByRole('button', { name: 'Browse Available Players', exact: true }).click();
    }
    const card = page.locator('[data-slot="card"]').filter({
      has: page.getByText(/^Quarterbacks \(/),
    }).filter({ visible: true });
    await expect(card.getByRole('img', { name: 'Completed University logo', exact: true })).toBeVisible();
    await expect(card.getByRole('img', { name: 'Future University logo unavailable', exact: true })).toBeVisible();
    await expect(card.getByRole('img', { name: 'Other University logo unavailable', exact: true })).toBeVisible();
    for (const school of ['Completed University', 'Future University', 'Other University']) {
      await expect(card.getByText(school, { exact: true }).filter({ visible: true })).toHaveCount(0);
    }
    if (width >= 768) {
      const playerRow = card.getByRole('row').filter({
        has: page.getByRole('button', { name: 'Alex Finished', exact: true }),
      });
      await expect(playerRow.getByRole('cell').nth(1)).toHaveText('');
      await expect(playerRow.getByRole('cell').nth(1).getByRole('img')).toHaveAttribute('title', 'Completed University');
    }

    await card.getByRole('button', { name: 'Alex Finished', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Alex Finished', exact: true });
    await expect(details.getByText('Completed University', { exact: true })).toBeVisible();
    await expect(details.getByText('No games with recorded stats yet this season.', { exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(details).toHaveCount(0);
    expect(app.errors).toEqual([]);
  });
}
