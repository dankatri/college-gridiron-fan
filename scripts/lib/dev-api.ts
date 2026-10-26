/**
 * In-memory API for the local FCS preview.
 *
 * Mounted by vite.config.ts only when `DEV_PREVIEW=1`, so an ordinary
 * `npm run dev` is unaffected and nothing here can reach production. Football
 * data is real — it comes from the CFBD snapshot built by
 * `npm run dev:snapshot` — while accounts, leagues and lineups are synthetic
 * and live only for the lifetime of the dev server. No database is involved,
 * so a preview can never write to the application's data.
 *
 * Lineup saves reuse the real validation and usage rules from `src/server` so
 * the limits behave as they do in production.
 */

import { readFile } from 'node:fs/promises';
import type { Connect } from 'vite';

import { SEASON_YEAR } from '../../src/lib/season-config';
import { FIRST_WEEK, LAST_WEEK, MAX_PLAYER_USES } from '../../src/lib/types';
import type { GameStatus } from '../../src/lib/types';
import { saveLineupSchema } from '../../src/server/lineup-input';
import { findIneligibleSlot, playerIdentitiesFromData } from '../../src/server/lineup-lock';
import { toUsageMap, type LineupSlotInput } from '../../src/server/lineup-utils';
import { SNAPSHOT_PATH, type DevSnapshot } from './dev-snapshot';

const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Preview Fan',
  email: 'preview@localhost',
  hasPasskey: false,
};

const DEMO_RIVAL = {
  id: '00000000-0000-4000-8000-000000000002',
  displayName: 'Rival Fan',
};

const LEAGUE_ID = '00000000-0000-4000-8000-0000000000aa';

type StoredLineup = {
  id: string;
  week: number;
  season: number;
  slots: LineupSlotInput[];
  projectedPoints: string | null;
  actualPoints: string | null;
  lockedAt: string | null;
};

type PreviewState = {
  user: typeof DEMO_USER | null;
  lineups: StoredLineup[];
};

function league(createdAt: string) {
  return {
    id: LEAGUE_ID,
    name: 'FCS Preview League',
    description: 'Local preview league. Data is not saved anywhere.',
    ownerId: DEMO_USER.id,
    ownerName: DEMO_USER.displayName,
    season: SEASON_YEAR,
    joinCode: 'PREVIEW',
    maxMembers: 20,
    isPublic: false,
    allowLateJoins: true,
    createdAt,
    joinedAt: createdAt,
    memberCount: 2,
    members: [
      { userId: DEMO_USER.id, displayName: DEMO_USER.displayName, role: 'owner' as const, joinedAt: createdAt },
      { userId: DEMO_RIVAL.id, displayName: DEMO_RIVAL.displayName, role: 'member' as const, joinedAt: createdAt },
    ],
  };
}

/** Scoreboard for one week, derived from the snapshot's real schedules. */
function weekGames(snapshot: DevSnapshot, week: number): GameStatus[] {
  const seen = new Set<string>();
  const games: GameStatus[] = [];
  for (const team of snapshot.schedules) {
    for (const game of team.weeklyGames) {
      if (game.week !== week || game.isByeWeek || !game.gameId || seen.has(game.gameId)) continue;
      seen.add(game.gameId);
      games.push({
        week,
        team1: game.isHomeGame ? team.teamName : game.opponent ?? 'TBD',
        team2: game.isHomeGame ? game.opponent ?? 'TBD' : team.teamName,
        status: game.isCompleted ? 'final' : 'scheduled',
        team1Score: (game.isHomeGame ? game.teamPoints : game.opponentPoints) ?? 0,
        team2Score: (game.isHomeGame ? game.opponentPoints : game.teamPoints) ?? 0,
        lastUpdated: new Date(),
      });
    }
  }
  return games;
}

async function readBody(request: Connect.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

export async function loadSnapshot(): Promise<DevSnapshot> {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8')) as DevSnapshot;
  } catch (error) {
    throw new Error(
      `No preview snapshot at ${SNAPSHOT_PATH}. Run \`npm run dev:snapshot\` first. (${String(error)})`,
    );
  }
}

export function createDevApi(snapshot: DevSnapshot): Connect.NextHandleFunction {
  const createdAt = snapshot.generatedAt;
  const state: PreviewState = { user: DEMO_USER, lineups: [] };
  const playerIds = new Set(snapshot.players.map((player) => player.id));

  const usage = () =>
    [...toUsageMap(state.lineups)].map(([playerId, timesUsed]) => ({ playerId, timesUsed }));

  return async (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next();

    const send = (body: unknown, status = 200) => {
      response.statusCode = status;
      response.setHeader('Content-Type', 'application/json');
      // The preview is always authoritative for the current process; caching it
      // would hide a freshly rebuilt snapshot behind a stale response.
      response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify(body));
    };

    const path = url.pathname;
    const method = request.method ?? 'GET';

    try {
      if (path === '/api/me') return send({ user: state.user });
      if (path === '/api/auth/logout') {
        state.user = null;
        return send({ ok: true });
      }
      if (path === '/api/auth/login' || path === '/api/auth/register') {
        const body = (await readBody(request)) as { email?: string; displayName?: string };
        state.user = {
          ...DEMO_USER,
          email: body.email ?? DEMO_USER.email,
          displayName: body.displayName ?? DEMO_USER.displayName,
        };
        return send({ user: state.user });
      }

      if (path === '/api/players') {
        return send({ players: snapshot.players, updatedAt: createdAt, sourceCheckedAt: createdAt });
      }
      if (path === '/api/teams') {
        return send({ teams: snapshot.teams, updatedAt: createdAt, sourceCheckedAt: createdAt });
      }
      if (path === '/api/schedules') {
        return send({ schedules: snapshot.schedules, updatedAt: createdAt, sourceCheckedAt: createdAt });
      }
      if (path === '/api/season-stats') return send(snapshot.seasonStats);

      if (path === '/api/live') {
        const week = Number(url.searchParams.get('week'));
        if (!Number.isInteger(week) || week < FIRST_WEEK || week > LAST_WEEK) {
          return send({ error: 'Invalid week' }, 400);
        }
        // The previewed season has not been played, so there are no box scores.
        // Reporting none is honest; inventing them would misrepresent scoring.
        return send({
          week,
          updatedAt: createdAt,
          stats: [],
          games: weekGames(snapshot, week),
          sourceCheckedAt: createdAt,
        });
      }

      if (path === '/api/player-log') {
        const player = snapshot.players.find((entry) => entry.id === url.searchParams.get('playerId'));
        if (!player) return send({ error: 'Unknown player' }, 404);
        return send({ player, season: SEASON_YEAR, weeks: [], totals: null, updatedAt: createdAt });
      }

      if (!state.user) return send({ error: 'Not signed in' }, 401);

      if (path === '/api/leagues') return send({ leagues: [league(createdAt)] });
      if (path === `/api/leagues/${LEAGUE_ID}`) return send({ league: league(createdAt) });

      if (path === `/api/leagues/${LEAGUE_ID}/lineups`) {
        if (method === 'PUT') {
          const parsed = saveLineupSchema.safeParse(await readBody(request));
          if (!parsed.success) {
            return send({ error: parsed.error.issues[0]?.message ?? 'Invalid lineup' }, 400);
          }
          const { week, slots, projectedPoints } = parsed.data;

          const unknown = slots.filter((slot) => slot.playerId && !playerIds.has(slot.playerId));
          if (unknown.length) return send({ error: 'Lineup references an unknown player' }, 400);

          // The preview has its own save path, so the division rule has to be
          // called explicitly here. Reusing the production check is the whole
          // point: a preview that accepted picks the real API rejects would
          // make local testing of Halloween week actively misleading.
          const ineligible = findIneligibleSlot(slots, playerIdentitiesFromData(snapshot.players), week);
          if (ineligible) return send({ error: ineligible }, 409);

          const otherWeeks = state.lineups.filter((row) => row.week !== week);
          const priorUsage = toUsageMap(otherWeeks);
          const overused = slots.find(
            (slot) => slot.playerId && (priorUsage.get(slot.playerId) ?? 0) >= MAX_PLAYER_USES,
          );
          if (overused) {
            return send({ error: `A player can only be used ${MAX_PLAYER_USES} times per season` }, 409);
          }

          const saved: StoredLineup = {
            id: `preview-lineup-${week}`,
            week,
            season: SEASON_YEAR,
            slots,
            projectedPoints: projectedPoints === undefined ? null : String(projectedPoints),
            actualPoints: null,
            lockedAt: null,
          };
          state.lineups = [...otherWeeks, saved].sort((a, b) => a.week - b.week);
          return send({ lineup: saved, playerUsage: usage() });
        }

        const week = Number(url.searchParams.get('week'));
        return send({
          lineups: state.lineups,
          lineup: state.lineups.find((row) => row.week === week) ?? null,
          playerUsage: usage(),
        });
      }

      if (path === `/api/leagues/${LEAGUE_ID}/leaderboard`) {
        return send({
          leaderboard: [
            {
              rank: 1, userId: DEMO_USER.id, username: DEMO_USER.displayName,
              totalPoints: 0, weeklyPoints: {}, weeksScored: 0, winningWeeks: 0,
            },
            {
              rank: 2, userId: DEMO_RIVAL.id, username: DEMO_RIVAL.displayName,
              totalPoints: 0, weeklyPoints: {}, weeksScored: 0, winningWeeks: 0,
            },
          ],
        });
      }

      if (path === `/api/leagues/${LEAGUE_ID}/member-lineup`) {
        const week = Number(url.searchParams.get('week'));
        return send({
          lineup: url.searchParams.get('userId') === DEMO_USER.id
            ? state.lineups.find((row) => row.week === week) ?? null
            : null,
          slots: [],
        });
      }

      // Anything else is a league-management or account feature the preview
      // deliberately does not simulate. A clear error beats a fake success that
      // would look like a working feature.
      return send({ error: `The local preview does not implement ${method} ${path}` }, 501);
    } catch (error) {
      console.error('[dev-preview]', method, path, error);
      return send({ error: 'Preview request failed' }, 500);
    }
  };
}
