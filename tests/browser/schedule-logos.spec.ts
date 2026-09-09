import { expect, test } from '@playwright/test';
import { mockApp, now, schedules, teamLogo } from './fixtures';

for (const width of [1280, 390]) {
  test(`weekly schedules show logos beside both school names at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    let teamRequests = 0;
    await page.route('**/api/teams', route => {
      teamRequests++;
      return route.fulfill({ json: { updatedAt: now, teams: [
        { school: 'Completed University', logo: teamLogo },
        { school: 'Opponent 0', logo: teamLogo },
      ] } });
    });
    await page.route('**/api/schedules', route => route.fulfill({ json: {
      updatedAt: now,
      schedules: schedules.map((schedule, index) => index ? schedule : {
        ...schedule, weeklyGames: [...schedule.weeklyGames, {
          week: 2, gameId: 'next-week', isHomeGame: false, isByeWeek: false,
          opponent: 'Opponent 0', gameDate: '2026-09-12T18:00:00.000Z',
        }],
      }),
    } }));
    await page.goto('/');
    await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
    const games = page.getByRole('region', { name: 'Games for Week 1', exact: true });
    for (const school of ['Completed University', 'Opponent 0']) {
      await expect(games.getByText(school, { exact: true })).toBeVisible();
      await expect(games.getByRole('img', { name: `${school} logo`, exact: true })).toBeVisible();
    }
    await expect(games.getByRole('img', { name: 'Other University logo unavailable', exact: true })).toBeVisible();
    await expect(games.getByText('Other University', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next Week', exact: true }).click();
    const next = page.getByRole('region', { name: 'Games for Week 2', exact: true });
    const teamImages = next.getByRole('img', { name: /logo$/ });
    await expect(teamImages).toHaveCount(2);
    await expect(teamImages.first()).toHaveAttribute('alt', 'Completed University logo');
    await expect(teamImages.last()).toHaveAttribute('alt', 'Opponent 0 logo');
    await page.getByRole('button', { name: 'Previous Week', exact: true }).click();
    await expect(games.getByRole('img', { name: 'Completed University logo', exact: true })).toBeVisible();
    expect(teamRequests).toBe(1);
    expect(app.errors).toEqual([]);
  });
}
