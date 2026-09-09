import { expect, test } from '@playwright/test';
import { league, lineup, mockApp, now, user } from './fixtures';

const standings = (points = 19) => ({ leaderboard: [{
  userId: user.id, username: user.displayName, rank: 1, totalPoints: points,
  weeklyPoints: { 1: points }, weeksScored: 1, winningWeeks: 0,
}] });
const table = (page: import('@playwright/test').Page) => page.getByRole('table', { name: 'League standings' });

for (const width of [1280, 390]) {
  test(`Leagues opens the first membership and Back preserves switching and creation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    const first = { ...league, name: 'First Joined League', createdAt: '2026-08-31T00:00:00Z', joinedAt: '2026-09-01T00:00:00Z' };
    const second = { ...league, id: 'league-b', name: 'Older League Joined Later', createdAt: '2026-01-01T00:00:00Z', joinedAt: '2026-09-02T00:00:00Z' };
    app.state.leagues = [first, second];
    let firstRequests = 0;
    await page.route('**/api/leagues/league-a', route => {
      firstRequests++;
      return route.fulfill({ json: { league: first } });
    });
    await page.route('**/api/leagues/league-b', route => route.fulfill({ json: { league: second } }));
    await page.route('**/api/leagues/league-b/leaderboard', route => route.fulfill({ json: { leaderboard: [] } }));
    await page.goto('/');
    await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
    await expect(page.getByRole('heading', { name: first.name, exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: 'League standings' })).toBeVisible();
    expect(firstRequests).toBe(0);
    await page.getByRole('button', { name: 'Back to Leagues', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'League Competition' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View League', exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'View League', exact: true }).nth(1).click();
    await expect(page.getByRole('heading', { name: second.name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Leagues', exact: true }).click();
    await page.getByRole('tab', { name: 'Create league', exact: true }).click();
    await expect(page.getByLabel('League Name *', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Set Lineup', exact: true }).click();
    await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
    await expect(page.getByRole('heading', { name: first.name, exact: true })).toBeVisible();
    await expect(table(page)).toBeVisible();
    expect(firstRequests).toBe(0);
    expect(app.requests.filter(request => request === 'GET /api/leagues/league-a/leaderboard')).toHaveLength(1);
    await page.getByRole('tab', { name: 'Manage league', exact: true }).click();
    await expect(page.getByText('League Join Code', { exact: true })).toBeVisible();
    expect(firstRequests).toBe(1);
    await page.getByRole('tab', { name: 'Set Lineup', exact: true }).click();
    await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
    await page.getByRole('tab', { name: 'Manage league', exact: true }).click();
    await expect(page.getByText('League Join Code', { exact: true })).toBeVisible();
    expect(firstRequests).toBe(1);
    expect(app.errors).toEqual([]);
  });
}

test('users without memberships stay on the join/create screen', async ({ page }) => {
  const app = await mockApp(page);
  app.state.leagues = [];
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No leagues yet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create League', exact: true })).toBeVisible();
  expect(app.requests.filter(request => request === 'GET /api/leagues/league-a')).toHaveLength(0);
  expect(app.errors).toEqual([]);
});

test('Back during automatic loading cannot be undone by late responses', async ({ page }) => {
  const app = await mockApp(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/leagues/league-a/leaderboard', async route => {
    await pending;
    await route.fulfill({ json: standings() });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(page.getByRole('heading', { name: league.name, exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Loading standings...' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Manage league', exact: true })).toBeVisible();
  expect(app.requests.filter(request => request === 'GET /api/leagues/league-a')).toHaveLength(0);
  await page.getByRole('button', { name: 'Back to Leagues', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'League Competition' })).toBeVisible();
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/leagues/league-a/leaderboard');
  release();
  await response;
  await expect(page.getByRole('heading', { name: 'League Competition' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View League', exact: true })).toHaveCount(1);
  expect(app.errors).toEqual([]);
});

test('a cold standings failure keeps the league open with an explicit retry rather than empty results', async ({ page }) => {
  const app = await mockApp(page);
  let requests = 0;
  await page.route('**/api/leagues/league-a/leaderboard', route => {
    requests++;
    return route.fulfill(requests === 1
      ? { status: 503, json: { error: 'League temporarily unavailable' } }
      : { json: standings() });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(page.getByText('League temporarily unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: league.name, exact: true })).toBeVisible();
  await expect(table(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back to Leagues', exact: true })).toBeVisible();
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Retry standings', exact: true }).click();
  await expect(table(page)).toBeVisible();
  expect(requests).toBe(2);
  expect(app.errors).toEqual([]);
});

test('expired standings stay visible during background refresh and transient failures, with retry', async ({ page }) => {
  const app = await mockApp(page);
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/leagues/league-a/leaderboard', async route => {
    requests++;
    if (requests === 2) {
      await pending;
      return route.fulfill({ status: 503, json: { error: 'Standings temporarily unavailable' } });
    }
    return route.fulfill({ json: standings(requests === 1 ? 19 : 44) });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(table(page).getByText('19.0 pts', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Set Lineup', exact: true }).click();
  await page.clock.setFixedTime(new Date(Date.parse(now) + 31_000));
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(table(page).getByText('19.0 pts', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Updating standings...' })).toBeVisible();
  release();
  await expect(page.getByRole('alert').filter({ hasText: 'Showing the last loaded standings.' })).toBeVisible();
  await expect(table(page).getByText('19.0 pts', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry standings', exact: true }).click();
  await expect(table(page).getByText('44.0 pts', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry standings', exact: true })).toHaveCount(0);
  expect(requests).toBe(3);
  expect(app.requests.filter(request => request === 'GET /api/leagues/league-a')).toHaveLength(0);
  expect(app.errors).toEqual([]);
});

test('a denied refresh hides protected standings instead of retaining a stale league table', async ({ page }) => {
  const app = await mockApp(page);
  let denied = false;
  await page.route('**/api/leagues/league-a/leaderboard', route => route.fulfill(denied
    ? { status: 403, body: 'Membership removed' }
    : { json: standings() }));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(table(page)).toBeVisible();
  await page.getByRole('tab', { name: 'Set Lineup', exact: true }).click();
  denied = true;
  await page.clock.setFixedTime(new Date(Date.parse(now) + 31_000));
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This league is no longer available to you.' })).toBeVisible();
  await expect(table(page)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Manage league', exact: true })).toHaveCount(0);
  denied = false;
  await page.getByRole('button', { name: 'Retry league access', exact: true }).click();
  await expect(table(page)).toBeVisible();
  expect(app.errors).toEqual([]);
});

test('a late access denial from Manage hides cached standings after switching tabs', async ({ page }) => {
  const app = await mockApp(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/leagues/league-a', async route => {
    await pending;
    return route.fulfill({ status: 403, body: 'Membership removed' });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(table(page)).toBeVisible();
  await page.getByRole('tab', { name: 'Manage league', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Loading league details...' })).toBeVisible();
  await page.getByRole('tab', { name: 'Leaderboard', exact: true }).click();
  await expect(table(page)).toBeVisible();
  release();
  await expect(page.getByRole('alert').filter({ hasText: 'This league is no longer available to you.' })).toBeVisible();
  await expect(table(page)).toHaveCount(0);
  expect(app.errors).toEqual([]);
});

test('saving a member lineup invalidates otherwise fresh league standings', async ({ page }) => {
  const app = await mockApp(page);
  let requests = 0;
  await page.route('**/api/leagues/league-a/leaderboard', route =>
    route.fulfill({ json: standings(++requests === 1 ? 19 : 44) }));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(table(page)).toBeVisible();
  await page.getByRole('tab', { name: 'Set Lineup', exact: true }).click();
  await page.getByRole('button', { name: /Save Week 1 Lineup/ }).filter({ visible: true }).click();
  await expect(page.getByText('Week 1 lineup saved with 1 of 6 slots filled', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(table(page).getByText('44.0 pts', { exact: true })).toBeVisible();
  expect(requests).toBe(2);
  expect(app.errors).toEqual([]);
});

test('cached standings cannot cross logout and another account signing in to the same league', async ({ page }) => {
  const app = await mockApp(page);
  let requests = 0;
  await page.route('**/api/leagues/league-a/leaderboard', route =>
    route.fulfill({ json: standings(++requests === 1 ? 19 : 44) }));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(table(page).getByText('19.0 pts', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Logout', exact: true }).filter({ visible: true }).click();
  await page.locator('input[type="email"]').fill('other@example.test');
  await page.locator('input[type="password"]').fill('fixture-password-only');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(table(page).getByText('44.0 pts', { exact: true })).toBeVisible();
  await expect(table(page).getByText('19.0 pts', { exact: true })).toHaveCount(0);
  expect(requests).toBe(2);
  expect(app.errors).toEqual([]);
});

test('admin saves refresh the shared standings without fetching management details', async ({ page }) => {
  const app = await mockApp(page);
  let requests = 0;
  let saves = 0;
  await page.route('**/api/leagues/league-a/leaderboard', route =>
    route.fulfill({ json: standings(++requests === 1 ? 19 : 44) }));
  await page.route('**/api/leagues/league-a/admin*', route => {
    if (route.request().method() === 'PUT') {
      saves++;
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: {
      members: [{ userId: user.id, displayName: user.displayName, role: 'owner', weeksSet: 1, lineup, playerUsage: app.state.usage }],
      auditLog: [],
    } });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(table(page)).toBeVisible();
  await page.getByRole('tab', { name: 'League admin', exact: true }).click();
  await page.getByRole('button', { name: /Test Member Owner Week 1 set/ }).click();
  await page.getByRole('button', { name: /Save.*lineup/i }).click();
  await expect(page.getByText("Saved Test Member's Week 1 lineup", { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Leaderboard', exact: true }).click();
  await expect(table(page).getByText('44.0 pts', { exact: true })).toBeVisible();
  expect(saves).toBe(1);
  expect(requests).toBe(2);
  expect(app.requests.filter(request => request === 'GET /api/leagues/league-a')).toHaveLength(0);
  expect(app.errors).toEqual([]);
});

test('removing a member refreshes management, the membership summary and standings', async ({ page }) => {
  const app = await mockApp(page);
  let detailsRequests = 0;
  let standingsRequests = 0;
  let removed = false;
  await page.route('**/api/leagues/league-a', route => {
    detailsRequests++;
    return route.fulfill({ json: { league: app.state.leagues[0] } });
  });
  await page.route('**/api/leagues/league-a/leaderboard', route => {
    standingsRequests++;
    return route.fulfill({ json: standings(removed ? 44 : 19) });
  });
  await page.route('**/api/leagues/league-a/members?userId=other-user', route => {
    expect(route.request().method()).toBe('DELETE');
    removed = true;
    app.state.leagues = [{ ...league, memberCount: 1, members: [league.members[0]] }];
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Leagues', exact: true }).click();
  await expect(table(page)).toBeVisible();
  await page.getByRole('tab', { name: 'Manage league', exact: true }).click();
  await page.getByText('Other Member', { exact: true }).locator('xpath=../..').locator('..').getByRole('button').click();
  await expect(page.getByText('Members (1)', { exact: true })).toBeVisible();
  await expect(page.getByText('Other Member', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Leaderboard', exact: true }).click();
  await expect(table(page).getByText('44.0 pts', { exact: true })).toBeVisible();
  expect(detailsRequests).toBe(2);
  expect(standingsRequests).toBe(2);
  expect(app.requests.filter(request => request === 'GET /api/leagues')).toHaveLength(2);
  expect(app.errors).toEqual([]);
});
