import { expect, test } from '@playwright/test';
import { lineup, live, mockApp, schedules } from './fixtures';

const monday = '2026-09-21T08:00:00.000Z';

for (const width of [1280, 390]) {
  test(`Week 3 automatically finishes and reveals peers before Wednesday at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    await page.clock.setFixedTime(new Date(monday));
    app.state.lineups = [{ ...structuredClone(lineup), week: 3 }];
    let allFinal = false;
    let refreshFailed = false;
    let fantasyPoints = 19;
    await page.route('**/api/live?**', route => route.fulfill({ json: {
      ...live, week: 3, stats: live.stats.map(stat => ({ ...stat, week: 3, fantasyPoints })),
    } }));
    await page.route('**/api/schedules', route => route.fulfill({
      status: refreshFailed ? 503 : 200,
      json: refreshFailed ? { error: 'Temporary source failure' } : {
        updatedAt: monday,
        schedules: schedules.map((team, index) => ({
          ...team, weeklyGames: [{
            ...team.weeklyGames[0], week: 3, gameDate: '2026-09-19T18:00:00.000Z',
            isCompleted: allFinal || index === 0, teamPoints: 21, opponentPoints: 7,
          }],
        })),
      },
    }));
    let revealed = 0;
    await page.route('**/api/leagues/league-a/member-lineup?**', route => {
      expect(allFinal).toBe(true);
      expect(new URL(route.request().url()).searchParams.get('week')).toBe('3');
      revealed += 1;
      return route.fulfill({ json: {
        userId: 'other-user', username: 'Other Member', week: 3, totalPoints: 19, availableWeeks: [3],
        slots: lineup.slots.map(slot => ({
          ...slot, name: slot.playerId ? 'Alex Finished' : null, team: slot.playerId ? 'Completed University' : null,
          actualPoints: slot.playerId ? 19 : null,
        })),
      } });
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Save Week 3 Lineup/ }).filter({ visible: true })).toBeEnabled();
    await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
    await page.getByRole('button', { name: 'Other Member', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Other Member', exact: true });
    await expect(dialog.getByText('Week 3 is not finished yet', { exact: true })).toBeVisible();
    expect(revealed).toBe(0);

    allFinal = true;
    await page.clock.setFixedTime(new Date('2026-09-21T08:01:01Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(dialog.getByText('Points scored', { exact: true })).toBeVisible();
    expect(revealed).toBe(1);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('tab', { name: 'Set Lineup', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Week 3 Closed', exact: true }).filter({ visible: true })).toBeDisabled();
    await expect(page.getByText('Week 3 is over - no changes allowed', { exact: true })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Game weeks' });
    if (width >= 768) {
      await expect(nav.getByRole('tab', { name: 'W3', exact: true })).toHaveCount(0);
      const completed = nav.getByRole('button', { name: /^Completed weeks/ });
      await expect(completed).toContainText('W3');
      await completed.click();
      await expect(page.getByRole('menuitemradio', { name: 'Week 3', exact: true })).toHaveAttribute('aria-checked', 'true');
      await page.keyboard.press('Escape');
    } else {
      const select = nav.getByRole('combobox', { name: 'Select game week' });
      await expect(select).toContainText('Week 3');
      await select.click();
      const group = page.getByRole('group', { name: 'Completed weeks', exact: true });
      await expect(group.getByRole('option', { name: /^Week 3:/ })).toBeVisible();
      await page.keyboard.press('Escape');
    }

    refreshFailed = true;
    fantasyPoints = 23;
    await page.clock.setFixedTime(new Date('2026-09-21T08:02:02Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('alert').filter({ hasText: 'Schedule refresh failed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Week 3 Closed', exact: true }).filter({ visible: true })).toBeDisabled();
    const summary = page.locator('[data-slot="card"]')
      .filter({ has: page.getByText('Lineup Summary', { exact: true }) }).filter({ visible: true });
    await expect(summary.getByText('23.0', { exact: true })).toBeVisible();
    expect(app.requests.filter(request => request.startsWith('PUT'))).toEqual([]);
    expect(app.errors).toEqual([]);
  });
}
