import { expect, test } from '@playwright/test';
import { mockApp, lineup, players, slots, actualStats } from './fixtures';

const save = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /Save Week 1 Lineup/ }).filter({ visible: true });
const row = (page: import('@playwright/test').Page, name: string) => page.getByRole('row').filter({ has: page.getByRole('button', { name, exact: true }) });

test('local filters preserve the draft and do not download players again', async ({ page }) => {
  const app = await mockApp(page);
  await page.goto('/');
  await expect(save(page)).toBeEnabled();
  await row(page, 'Jamie Quarterback').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(save(page)).toHaveText('Save Week 1 Lineup (2/6)');
  await page.getByRole('combobox').filter({ hasText: 'All Teams' }).click();
  await page.getByRole('option', { name: 'Other University', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search Quarterbacks by name' }).fill('Walker');
  await expect(row(page, 'Casey Walker Jr.')).toBeVisible();
  await expect(save(page)).toHaveText('Save Week 1 Lineup (2/6)');
  await save(page).click();
  await expect.poll(() => app.state.lineups[0].slots[1].playerId).toBe('qb-future');
  expect(app.requests.filter(request => request === 'GET /api/players')).toHaveLength(1);
  expect(app.requests.filter(request => request === 'GET /api/me')).toHaveLength(1);
  expect(app.requests.filter(request => request.startsWith('GET /api/leagues/league-a/lineups'))).toEqual(['GET /api/leagues/league-a/lineups']);
  await page.reload();
  await expect(save(page)).toHaveText('Save Week 1 Lineup (2/6)');
  expect(app.errors).toEqual([]);
});

for (const width of [1280, 390]) {
  test(`conference details are hidden only while filtered at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    await page.goto('/');
    if (width < 768) {
      await page.getByRole('button', { name: 'Browse Available Players', exact: true }).click();
    }
    const card = page.locator('[data-slot="card"]').filter({
      has: page.getByText(/^Quarterbacks \(/),
    }).filter({ visible: true });
    const visibleWest = card.getByText('West', { exact: true }).filter({ visible: true });
    const conferenceHeading = card.getByRole('columnheader', { name: 'Conf', exact: true });
    await expect(visibleWest).toHaveCount(2);
    if (width >= 768) await expect(conferenceHeading).toBeVisible();

    await card.getByRole('combobox').filter({ hasText: 'All Conferences' }).click();
    await page.getByRole('option', { name: 'West', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Alex Finished', exact: true })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Jamie Quarterback', exact: true })).toBeVisible();
    await expect(visibleWest).toHaveCount(1);
    await expect(conferenceHeading).toHaveCount(0);
    if (width >= 768) {
      const headings = await card.getByRole('columnheader').allTextContents();
      expect(headings.slice(0, 4)).toEqual(['Player', 'Team', 'Schedule', 'Season pts']);
      await expect(row(page, 'Jamie Quarterback').getByRole('cell')).toHaveCount(headings.length);
    }

    await card.getByRole('textbox', { name: 'Search Quarterbacks by name' }).fill('Nobody');
    await expect(card.getByText('No quarterbacks matching "Nobody".', { exact: true })).toBeVisible();
    await expect(conferenceHeading).toHaveCount(0);
    await card.getByRole('button', { name: 'Clear search', exact: true }).click();
    await card.getByRole('combobox').filter({ hasText: 'West' }).click();
    await page.getByRole('option', { name: 'East', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Alex Finished', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Jamie Quarterback', exact: true })).toHaveCount(0);
    await expect(card.getByText('East', { exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(conferenceHeading).toHaveCount(0);

    await card.getByRole('combobox').filter({ hasText: 'East' }).click();
    await page.getByRole('option', { name: 'All Conferences', exact: true }).click();
    await expect(visibleWest).toHaveCount(2);
    if (width >= 768) {
      await expect(conferenceHeading).toBeVisible();
      const headings = await card.getByRole('columnheader').allTextContents();
      expect(headings.slice(0, 4)).toEqual(['Player', 'Team', 'Conf', 'Schedule']);
      await expect(row(page, 'Jamie Quarterback').getByRole('cell')).toHaveCount(headings.length);
    }
    expect(app.requests.filter(request => request === 'GET /api/players')).toHaveLength(1);
    expect(app.errors).toEqual([]);
  });
}

test('known locks survive a failed schedule refresh and a cold failure disables saves', async ({ page }) => {
  const app = await mockApp(page);
  await page.goto('/');
  await expect(save(page)).toBeEnabled();
  app.state.schedulesFail = true;
  await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Known kickoff locks' })).toBeVisible();
  await page.getByRole('tab', { name: 'Set Lineup' }).click();
  await expect(page.getByRole('button', { name: 'Remove Alex Finished' })).toHaveCount(0);
  await expect(save(page)).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Editing is unavailable' })).toBeVisible();
  await expect(save(page)).toBeDisabled();
  expect(app.errors).toEqual([]);
});

test('live tab shares its weekly source, does not loop or persist box scores', async ({ page }) => {
  const app = await mockApp(page);
  const writes: string[] = [];
  await page.exposeFunction('recordStorageWrite', (key: string) => writes.push(key));
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      void (window as unknown as { recordStorageWrite: (key: string) => Promise<void> }).recordStorageWrite(key);
      original.call(this, key, value);
    };
  });
  await page.goto('/');
  await expect(save(page)).toBeEnabled();
  await page.getByRole('tab', { name: 'Live Scoring' }).click();
  await expect(page.getByText('Alex Finished', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Set Lineup' }).click();
  await expect(save(page)).toHaveText('Save Week 1 Lineup (1/6)');
  expect(app.requests.filter(request => request === 'GET /api/live?week=1')).toHaveLength(1);
  expect(app.requests.filter(request => request === 'GET /api/leagues')).toHaveLength(1);
  expect(writes.filter(key => /live-stats|live-games|live-updates|player-stats|game-status/i.test(key))).toEqual([]);
  expect(app.errors).toEqual([]);
});

test('unavailable actuals are not shown as a completed-player zero', async ({ page }) => {
  const app = await mockApp(page);
  app.state.liveFail = true;
  app.state.seasonFail = true;
  await page.goto('/');
  await expect(save(page)).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: 'Missing scores are not counted as zero' })).toBeVisible();
  await expect(row(page, 'Alex Finished').getByTitle(/this is not a zero score/)).toHaveText('?');
  await page.getByRole('tab', { name: 'Live Scoring' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'No actual total can be shown' })).toBeVisible();
  await expect(page.getByText('Actual Points', { exact: true })).toHaveCount(0);
  expect(app.errors).toEqual([]);
});

test('a source refresh in flight does not relabel a finished game score as unavailable', async ({ page }) => {
  const app = await mockApp(page);
  app.state.liveRefreshing = true;
  app.state.playerPool = [
    ...players,
    { id: 'qb-blank', name: 'Pat Blank', position: 'QB', team: 'Completed University', conference: 'East', projectedPoints: 18 },
  ];
  app.state.lineups = [{
    ...lineup,
    slots: slots().map((slot, index) => (index === 1 ? { ...slot, playerId: 'qb-blank' } : slot)),
  }];
  await page.goto('/');
  const card = page.locator('[data-slot="card"]').filter({ hasText: 'Your Lineup' }).filter({ visible: true }).first();
  await expect(card.getByText('Pat Blank', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'The source is updating' })).toBeVisible();
  // Alex Finished has a line; Pat Blank's game is over with none, which is a
  // real zero. Re-observing the source must not turn either into a blank.
  await expect(card).toContainText('19.0 pts');
  await expect(card).toContainText('0.0 pts');
  await expect(card).not.toContainText('Unavailable');
  expect(app.errors).toEqual([]);
});

test('a failed session check offers retry rather than pretending the user signed out', async ({ page }) => {  await mockApp(page);
  await page.route('**/api/me', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText('Unable to check your session. Please retry.');
  await expect(page.getByRole('button', { name: 'Retry session' })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test('a failed optional chunk leaves an unsaved lineup usable', async ({ page }) => {
  const app = await mockApp(page);
  await page.route('**/assets/ScheduleOverview-*.js', route => route.abort());
  await page.goto('/');
  await expect(save(page)).toBeEnabled();
  await row(page, 'Jamie Quarterback').getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Your unsaved lineup has not been cleared' })).toBeVisible();
  await page.getByRole('tab', { name: 'Set Lineup' }).click();
  await expect(save(page)).toHaveText('Save Week 1 Lineup (2/6)');
  await save(page).click();
  await expect.poll(() => app.state.lineups[0].slots[1].playerId).toBe('qb-future');
});

test('a doubled catalogue keeps numeric sorting and name search local', async ({ page }) => {
  const app = await mockApp(page);
  app.state.playerPool = [
    ...players,
    ...Array.from({ length: 7648 - players.length }, (_, index) => ({
      ...players[1], id: `load-${index}`, name: `Load Player ${index}`, passingYards: index,
    })),
  ];
  app.state.seasonStats.stats = app.state.playerPool.map(player =>
    actualStats(player.id, { passingYards: player.passingYards ?? 0 }),
  );
  await page.goto('/');
  await expect(save(page)).toBeEnabled();
  await page.getByRole('tab', { name: 'W2', exact: true }).click();
  await page.getByRole('button', { name: 'Pass Yds', exact: true }).click();
  await expect(page.getByRole('row').nth(1)).toContainText('Load Player 7640');
  await page.getByRole('button', { name: 'Pass Yds', exact: true }).click();
  await expect(page.getByRole('row').nth(1)).toContainText('Load Player 0');
  await page.getByRole('textbox', { name: 'Search Quarterbacks by name' }).fill('Load Player 7640');
  await expect(page.getByRole('row')).toHaveCount(2);
  expect(app.requests.filter(request => request === 'GET /api/players')).toHaveLength(1);
  expect(app.errors).toEqual([]);
});

test('late private data cannot cross logout and password sign-in', async ({ page }) => {
  const app = await mockApp(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let signal!: () => void;
  const intercepted = new Promise<void>(resolve => { signal = resolve; });
  let first = true;
  await page.route('**/api/leagues/league-a/lineups', async route => {
    if (!first) return route.fallback();
    first = false;
    signal();
    await gate;
    await route.fulfill({ json: { lineups: [lineup], playerUsage: [{ playerId: 'qb-finished', timesUsed: 1 }] } });
  });
  await page.goto('/');
  await intercepted;
  await page.getByRole('button', { name: 'Logout', exact: true }).filter({ visible: true }).click();
  app.state.lineups = [];
  app.state.usage = [];
  await page.locator('input[type="email"]').fill('other@example.test');
  await page.locator('input[type="password"]').fill('fixture-password-only');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(save(page)).toHaveText('Save Week 1 Lineup (0/6)');
  const lateResponse = page.waitForResponse(response => response.url().endsWith('/lineups'));
  release();
  await (await lateResponse).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(save(page)).toHaveText('Save Week 1 Lineup (0/6)');
  expect(app.errors).toEqual([]);
});
