import { expect, test } from '@playwright/test';
import { lineup, mockApp, slots, user } from './fixtures';
import { scoreLineups } from '../../src/server/leaderboard-scoring';

for (const width of [1280, 390]) {
  test(`a pending current-week lineup does not inflate weeks played or reduce the average at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    const now = new Date('2026-09-09T07:30:00Z');
    await page.clock.setFixedTime(now);
    app.state.lineups = [lineup, { ...lineup, id: 'pending-lineup', week: 2, slots: slots('qb-future') }];
    const result = scoreLineups(app.state.lineups.map(row => ({ ...row, userId: user.id })),
      new Map([[1, new Map([['qb-finished', 19]])], [2, new Map<string, number>()]]), new Set([1]), now);
    await page.route('**/api/leagues/league-a/leaderboard', route => route.fulfill({
      json: { leaderboard: [{ ...result.totals.get(user.id), userId: user.id, username: user.displayName, rank: 1, winningWeeks: 1 }] },
    }));
    await page.goto('/');
    await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
    const member = page.getByRole('table', { name: 'League standings' }).getByRole('row').filter({
      has: page.getByRole('button', { name: user.displayName, exact: true }),
    });
    await expect(member).toContainText('1 week played');
    await expect(member).toContainText('19.0 avg');
    await expect(member).toContainText('19.0 pts');
    expect(app.errors).toEqual([]);
  });

  test(`leaderboard distinguishes a zero-point lineup from no lineup at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    await page.route('**/api/leagues/league-a/leaderboard', route => route.fulfill({
      json: { leaderboard: [
        { userId: user.id, username: user.displayName, rank: 1, totalPoints: 0,
          weeklyPoints: { 1: 0 }, weeksScored: 1, winningWeeks: 0 },
        { userId: 'other-user', username: 'Other Member', rank: 2, totalPoints: 0,
          weeklyPoints: {}, weeksScored: 0, winningWeeks: 0 },
      ] },
    }));
    await page.goto('/');
    await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
    const standings = page.getByRole('table', { name: 'League standings' });
    const played = standings.getByRole('row').filter({
      has: page.getByRole('button', { name: user.displayName, exact: true }),
    });
    const unplayed = standings.getByRole('row').filter({
      has: page.getByRole('button', { name: 'Other Member', exact: true }),
    });
    await expect(played).toContainText('1 week played');
    await expect(unplayed).toContainText('0 weeks played');
    await expect(played).toContainText('0.0 pts');
    await expect(unplayed).toContainText('0.0 pts');
    await expect(unplayed).toContainText('0.0 avg');
    expect(app.errors).toEqual([]);
  });

  test(`leaderboard values use shared column headings at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    let leaderboardRequests = 0;
    await page.route('**/api/leagues/league-a/leaderboard', route => {
      leaderboardRequests++;
      return route.fulfill({ json: { leaderboard: [
        { userId: 'other-user', username: 'Other Member', rank: 1, totalPoints: 130,
          weeklyPoints: { 0: 50, 1: 80 }, weeksScored: 2, winningWeeks: 0 },
        { userId: user.id, username: user.displayName, rank: 2, totalPoints: 119,
          weeklyPoints: { 0: 100, 1: 19 }, weeksScored: 2, winningWeeks: 1 },
      ] } });
    });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
    const standings = page.getByRole('table', { name: 'League standings' });
    const member = standings.getByRole('row').filter({
      has: page.getByRole('button', { name: user.displayName, exact: true }),
    });
    const other = standings.getByRole('row').filter({
      has: page.getByRole('button', { name: 'Other Member', exact: true }),
    });
    await expect(standings.getByRole('columnheader', { name: 'Total points', exact: true })).toBeVisible();
    await expect(standings.getByRole('columnheader', { name: 'Winning weeks', exact: true })).toHaveCount(1);
    await expect(standings.getByRole('columnheader', { name: 'This week', exact: true })).toHaveCount(1);
    await expect(standings.getByText('Winning weeks', { exact: true })).toHaveCount(1);
    await expect(standings.getByText('This week', { exact: true })).toHaveCount(1);
    await expect(member).toContainText('119.0 pts');
    await expect(member.getByTestId('winning-weeks')).toHaveText('1');
    await expect(member.getByRole('cell', { name: '19.0', exact: true })).toBeVisible();
    await expect(member).not.toContainText('Winning weeks');
    await expect(member).not.toContainText(/this week/i);
    await expect(other).toContainText('130.0 pts');
    await expect(other.getByTestId('winning-weeks')).toHaveText('0');
    if (width < 640) {
      await page.getByRole('combobox').click();
      await page.getByRole('option', { name: /^Week 0:/ }).click();
    } else {
      await page.getByRole('button', { name: /^Completed weeks/ }).click();
      await page.getByRole('menuitemradio', { name: 'Week 0', exact: true }).click();
    }
    await expect(member).toContainText('119.0 pts');
    await expect(member.getByTestId('winning-weeks')).toHaveText('1');
    await expect(member.getByRole('cell', { name: '100.0', exact: true })).toBeVisible();
    expect(leaderboardRequests).toBe(1);
    const alignment = await member.getByTestId('winning-weeks').evaluate(cell => {
      const table = cell.closest('table')!;
      const heading = table.querySelectorAll('th')[3];
      return Math.abs(cell.getBoundingClientRect().right - heading.getBoundingClientRect().right);
    });
    expect(alignment).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(app.errors).toEqual([]);
  });
}
