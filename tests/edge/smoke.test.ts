import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, sql } from 'drizzle-orm';
import { chromium } from '@playwright/test';
import { z } from 'zod';
import { ALL_WEEKS } from '../../src/lib/types';
import { SEASON_YEAR, weekBoundary } from '../../src/lib/season-config';
import { hasWeekStarted } from '../../src/lib/week-lock';
import { dataCache, leagueMembers, lineups, passwordResetTokens, playerUsage } from '../../src/server/schema';
import { playersCacheKey, schedulesCacheKey } from '../../src/server/cache-keys';
import { generateResetToken, hashResetToken, resetTokenExpiry } from '../../src/server/password-reset';
import { partial } from '../integration/fixture';
import { disposableDatabaseSchema, verifyDisposableDatabase } from '../../scripts/lib/test-database';

const execute = promisify(execFile);
const object = z.record(z.unknown());
const user = z.object({ id: z.string().uuid(), email: z.string() });

class PreviewClient {
  private cookies = new Map<string, string>();
  constructor(private readonly base: string) {}

  async request(path: string, method = 'GET', body?: unknown) {
    const args = ['curl', path, '--deployment', this.base, '--', '--include', '--silent', '--show-error',
      '--max-time', '60', '--request', method, '--header', 'Content-Type: application/json'];
    if (this.cookies.size) args.push('--header', `Cookie: ${[...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ')}`);
    if (body !== undefined) args.push('--data-binary', JSON.stringify(body));
    const { stdout } = await execute('vercel', args, { maxBuffer: 4 * 1024 * 1024 });
    const blocks = [...stdout.matchAll(/HTTP\/[\d.]+\s+(\d+)[^\r\n]*\r?\n([\s\S]*?)\r?\n\r?\n/g)];
    const last = blocks[blocks.length - 1];
    assert.ok(last, 'The preview must return an HTTP response, not a CLI login prompt');
    const headers = new Headers();
    for (const line of last[2].split(/\r?\n/)) {
      const separator = line.indexOf(':');
      if (separator > 0) headers.append(line.slice(0, separator), line.slice(separator + 1).trim());
    }
    for (const cookie of headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      if (!name.startsWith('cgf-')) continue;
      if (/Max-Age=0(?:;|$)/i.test(cookie)) this.cookies.delete(name);
      else this.cookies.set(name, pair.slice(separator + 1));
    }
    return {
      status: Number(last[1]),
      headers,
      body: object.parse(JSON.parse(stdout.slice(last.index! + last[0].length))),
    };
  }
}

function ok(response: Awaited<ReturnType<PreviewClient['request']>>) {
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  return response.body;
}

test('actual Edge preview: auth, concurrent saves, rollback, privacy and passkeys', { timeout: 360_000 }, async t => {
  const configPath = process.env.EDGE_PREVIEW_FIXTURE_CONFIG;
  const base = process.env.EDGE_PREVIEW_URL;
  assert.ok(configPath && base, 'EDGE_PREVIEW_FIXTURE_CONFIG and EDGE_PREVIEW_URL are required; there is no production fallback');
  const origin = new URL(base);
  assert.equal(origin.protocol, 'https:');
  assert.ok(origin.hostname.endsWith('.vercel.app') && origin.hostname !== 'college-gridiron-fan.vercel.app',
    'Only an explicit disposable preview is allowed');
  const fixture = disposableDatabaseSchema.parse(JSON.parse(await readFile(configPath, 'utf8')));
  await verifyDisposableDatabase(fixture);
  const db = drizzle(neon(fixture.databaseUrl));
  const id = randomUUID();
  const playerA = `preview-${id}-a`;
  const playerB = `preview-${id}-b`;
  const future = ALL_WEEKS.filter(week => !hasWeekStarted(week)).slice(0, 5);
  assert.equal(future.length, 5, 'This scenario needs five future configured weeks');
  const pool = [playerA, playerB].map(playerId => ({
    id: playerId, name: `Preview ${playerId}`, team: 'Preview University',
    conference: 'Fixture', position: 'QB', projectedPoints: 99,
  }));
  await db.insert(dataCache).values([
    { key: playersCacheKey(SEASON_YEAR), data: pool },
    { key: schedulesCacheKey(SEASON_YEAR), data: [{
      teamId: 'preview', teamName: 'Preview University', conference: 'Fixture', byeWeeks: [],
      weeklyGames: future.map(week => ({
        week, isHomeGame: true, isByeWeek: false,
        gameDate: new Date(weekBoundary(week)!.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })),
    }] },
  ]).onConflictDoUpdate({ target: dataCache.key, set: { data: sql`excluded.data`, updatedAt: new Date() } });
  const ownerClient = new PreviewClient(base);
  const anonymous = new PreviewClient(base);
  const catalogue = await anonymous.request(`/api/players?previewFixture=${id}`);
  assert.equal(catalogue.status, 200);
  assert.equal(z.object({ players: z.array(z.object({ id: z.string() })) }).parse(catalogue.body).players[0].id, playerA,
    'Remote API must use the disposable database before any account mutation');
  const email = `preview-${id}@example.test`;
  const password = `Fixture-${randomUUID()}`;
  const owner = user.parse(ok(await ownerClient.request('/api/auth/register', 'POST', {
    email, password, displayName: 'Preview Owner',
  })).user);
  assert.equal((await anonymous.request('/api/auth/register', 'POST', { email, password, displayName: 'Duplicate' })).status, 409);
  assert.equal(user.parse(ok(await ownerClient.request('/api/me')).user).id, owner.id);
  const league = z.object({ id: z.string().uuid() }).parse(ok(await ownerClient.request('/api/leagues', 'POST', {
    name: `Disposable ${id}`, season: SEASON_YEAR,
  })).league);
  const endpoint = `/api/leagues/${league.id}`;
  for (const week of future.slice(0, 2)) ok(await ownerClient.request(`${endpoint}/lineups`, 'PUT', {
    week, slots: partial(playerA), projectedPoints: 99,
  }));
  const race = await Promise.all([
    ownerClient.request(`${endpoint}/lineups`, 'PUT', { week: future[2], slots: partial(playerA) }),
    ownerClient.request(`${endpoint}/admin`, 'PUT', { userId: owner.id, week: future[3], slots: partial(playerA), reason: 'Preview race' }),
  ]);
  assert.deepEqual(race.map(response => response.status).sort(), [200, 409]);
  const usage = await db.select().from(playerUsage).where(eq(playerUsage.userId, owner.id));
  assert.equal(usage.find(row => row.playerId === playerA)?.timesUsed, 3);
  const saved = ok(await ownerClient.request(`${endpoint}/lineups`));
  assert.equal(z.array(z.unknown()).parse(saved.lineups).length, 3);
  const board = ok(await ownerClient.request(`${endpoint}/leaderboard`));
  assert.equal(z.array(z.object({ totalPoints: z.number() })).parse(board.leaderboard)[0].totalPoints, 0);
  assert.equal((await anonymous.request(`${endpoint}/lineups`)).status, 401);

  const before = await db.select().from(lineups).where(eq(lineups.userId, owner.id));
  await db.execute(sql`create function preview_fail_usage() returns trigger language plpgsql as
    $$ begin raise exception 'injected preview failure'; end $$`);
  await db.execute(sql`create trigger preview_fail_usage before delete on player_usage
    for each row execute function preview_fail_usage()`);
  try {
    assert.equal((await ownerClient.request(`${endpoint}/lineups`, 'PUT', { week: future[4], slots: partial(playerB) })).status, 500);
    assert.deepEqual(await db.select().from(lineups).where(eq(lineups.userId, owner.id)), before);
  } finally {
    await db.execute(sql`drop trigger preview_fail_usage on player_usage`);
    await db.execute(sql`drop function preview_fail_usage()`);
  }
  ok(await ownerClient.request(`${endpoint}/lineups`, 'PUT', { week: future[4], slots: partial(playerB) }));

  const memberClient = new PreviewClient(base);
  const member = user.parse(ok(await memberClient.request('/api/auth/register', 'POST', {
    email: `member-${id}@example.test`, password, displayName: 'Preview Member',
  })).user);
  await db.insert(leagueMembers).values({ leagueId: league.id, userId: member.id });
  assert.equal((await memberClient.request(`${endpoint}/member-lineup?userId=${owner.id}&week=${future[0]}`)).status, 403);
  if (hasWeekStarted(1)) {
    ok(await ownerClient.request(`${endpoint}/admin`, 'PUT', { userId: owner.id, week: 0, slots: partial(playerB) }));
    const revealed = ok(await memberClient.request(`${endpoint}/member-lineup?userId=${owner.id}&week=0`));
    assert.equal(z.array(z.object({ playerId: z.string().nullable() })).parse(revealed.slots)[0].playerId, playerB);
  }

  const token = generateResetToken();
  await db.insert(passwordResetTokens).values({ tokenHash: await hashResetToken(token), userId: owner.id, expiresAt: resetTokenExpiry() });
  const newPassword = `Changed-${randomUUID()}`;
  ok(await anonymous.request('/api/auth/reset-password', 'POST', { token, password: newPassword }));
  assert.equal((await anonymous.request('/api/auth/reset-password', 'POST', { token, password: newPassword })).status, 400);
  ok(await ownerClient.request('/api/auth/logout', 'POST'));
  assert.equal(ok(await ownerClient.request('/api/me')).user, null);
  ok(await ownerClient.request('/api/auth/login', 'POST', { email, password: newPassword }));
  ok(await anonymous.request('/api/auth/forgot-password', 'POST', { email: `missing-${id}@example.test` }));

  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const session = await page.context().newCDPSession(page);
  await session.send('WebAuthn.enable');
  await session.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
    hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
  } });
  // Only the document is a fixture. All API calls above and below reach Edge.
  await page.route(`${origin.origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<html><body>Passkey fixture</body></html>' }));
  await page.goto(origin.origin);
  await page.addScriptTag({ path: 'node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js' });
  const register = ok(await ownerClient.request('/api/auth/passkey/register-options'));
  const registration = await page.evaluate(async serialized => {
    return window.SimpleWebAuthnBrowser.startRegistration({ optionsJSON: JSON.parse(serialized) });
  }, JSON.stringify(register.options));
  ok(await ownerClient.request('/api/auth/passkey/register-verify', 'POST', { response: registration }));
  assert.equal(z.object({ hasPasskey: z.boolean() }).parse(ok(await ownerClient.request('/api/me')).user).hasPasskey, true);
  ok(await ownerClient.request('/api/auth/logout', 'POST'));
  const login = ok(await ownerClient.request('/api/auth/passkey/login-options', 'POST', { email }));
  const authentication = await page.evaluate(async serialized => {
    return window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: JSON.parse(serialized) });
  }, JSON.stringify(login.options));
  ok(await ownerClient.request('/api/auth/passkey/login-verify', 'POST', { response: authentication }));
  assert.equal(user.parse(ok(await ownerClient.request('/api/me')).user).id, owner.id);
  t.diagnostic('Actual Edge auth, transaction rollback/contention, private reads and virtual passkey flows completed on disposable data.');
});

declare global {
  interface Window {
    SimpleWebAuthnBrowser: typeof import('@simplewebauthn/browser');
  }
}
