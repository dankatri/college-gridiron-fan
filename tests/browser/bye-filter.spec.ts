import { expect, test } from '@playwright/test';
import { mockApp } from './fixtures';

const toggle = (page: import('@playwright/test').Page) => page.getByRole('switch', { name: 'Hide byes' });
const qbNames = async (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /(Finished|Quarterback|Walker)/ }).allInnerTexts();

/**
 * Future University sits out Week 1 on a declared bye, Other University simply
 * has no Week 1 fixture, and Completed University plays. Both absences mean a
 * zero, so both are hidden.
 */
async function scheduleWithByes(page: import('@playwright/test').Page) {
  const app = await mockApp(page);
  for (const schedule of app.state.schedules) {
    if (schedule.teamName === 'Future University') {
      schedule.weeklyGames = [{ ...schedule.weeklyGames[0], isByeWeek: true }];
    }
    if (schedule.teamName === 'Other University') {
      schedule.weeklyGames = [{ ...schedule.weeklyGames[0], week: 3, isByeWeek: false }];
    }
  }
  return app;
}

test('hiding byes removes players whose team has no game, and the count says how many', async ({ page }) => {
  const app = await scheduleWithByes(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Jamie Quarterback', exact: true })).toBeVisible();

  await toggle(page).click();

  await expect(page.getByRole('button', { name: 'Jamie Quarterback', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Casey Walker Jr.', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Alex Finished', exact: true })).toBeVisible();
  await expect(page.getByText('2 hidden with no game')).toBeVisible();
  expect(app.errors).toEqual([]);
});

test('the choice is remembered across a reload and applies to every position', async ({ page }) => {
  const app = await scheduleWithByes(page);
  await page.goto('/');
  await toggle(page).click();

  await page.getByRole('tab', { name: 'Running Backs', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Robin Runner', exact: true })).toHaveCount(0);
  await expect(page.getByText('2 hidden with no game')).toBeVisible();

  await page.reload();
  await expect(toggle(page)).toBeChecked();
  await expect(page.getByRole('button', { name: 'Jamie Quarterback', exact: true })).toHaveCount(0);
  expect(app.errors).toEqual([]);
});

test('the mobile picker and the desktop table never disagree about hiding', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const app = await scheduleWithByes(page);
  await page.goto('/');

  // Both tables are mounted at every width, so a change in one has to reach
  // the other without waiting for a reload.
  await page.getByRole('button', { name: 'Browse Available Players', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Available Players', exact: true });
  await picker.getByRole('switch', { name: 'Hide byes' }).click();
  await expect(picker.getByRole('button', { name: 'Jamie Quarterback', exact: true })).toHaveCount(0);

  await page.keyboard.press('Escape');
  // The picker's own switch has to be gone before the desktop one is read,
  // otherwise the assertion can match the closing sheet instead.
  await expect(picker).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });

  await expect(toggle(page)).toBeChecked();
  await expect(page.getByRole('button', { name: 'Jamie Quarterback', exact: true })).toHaveCount(0);
  expect(app.errors).toEqual([]);
});

test('an unavailable schedule disables the toggle rather than emptying the list', async ({ page }) => {
  const app = await mockApp(page);
  app.state.schedulesFail = true;
  await page.goto('/');

  await expect(toggle(page)).toBeDisabled();
  expect(await qbNames(page)).toHaveLength(3);
  expect(app.errors).toEqual([]);
});

test('a stored preference cannot hide anyone while schedules are unavailable', async ({ page }) => {
  const app = await mockApp(page);
  app.state.schedulesFail = true;
  await page.addInitScript(() => window.localStorage.setItem('player-table-hide-byes', 'true'));
  await page.goto('/');

  await expect(toggle(page)).toBeDisabled();
  await expect(toggle(page)).not.toBeChecked();
  expect(await qbNames(page)).toHaveLength(3);
  expect(app.errors).toEqual([]);
});
