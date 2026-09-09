import { and, eq } from 'drizzle-orm';
import { db } from '../../../src/server/db';
import { leagueMembers, lineups, playerUsage } from '../../../src/server/schema';
import { requireUser } from '../../../src/server/auth-utils';
import { FIRST_WEEK, LAST_WEEK } from '../../../src/lib/types';
import { SEASON_YEAR } from '../../../src/lib/season-config';
import { saveLineup } from '../../../src/server/save-lineup';
import { saveLineupSchema } from '../../../src/server/lineup-input';
import { jsonResponse, errorResponse } from '../../../src/server/http';

export const config = {
  runtime: 'edge',
};

function getLeagueId(request: Request): string | null {
  const leagueId = new URL(request.url).pathname.split('/')[3];
  return leagueId || null;
}

async function assertLeagueMembership(leagueId: string, userId: string): Promise<boolean> {
  const membership = await db
    .select({ userId: leagueMembers.userId })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
    .limit(1);
  return !!membership[0];
}

export default async function handler(request: Request): Promise<Response> {
  const leagueId = getLeagueId(request);
  if (!leagueId) {
    return jsonResponse({ error: 'League ID is required' }, 400);
  }

  try {
    const user = await requireUser(request);
    if (request.method !== 'PUT' && !await assertLeagueMembership(leagueId, user.id)) {
      return jsonResponse({ error: 'You are not a member of this league' }, 403);
    }

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const weekParam = url.searchParams.get('week');

      if (weekParam !== null) {
        const week = /^\d+$/.test(weekParam) ? Number(weekParam) : NaN;
        if (!Number.isInteger(week) || week < FIRST_WEEK || week > LAST_WEEK) {
          return jsonResponse({ error: `Week must be between ${FIRST_WEEK} and ${LAST_WEEK}` }, 400);
        }

        const lineupRows = await db
          .select({
            id: lineups.id,
            week: lineups.week,
            season: lineups.season,
            slots: lineups.slots,
            projectedPoints: lineups.projectedPoints,
            actualPoints: lineups.actualPoints,
            lockedAt: lineups.lockedAt,
            createdAt: lineups.createdAt,
            updatedAt: lineups.updatedAt,
          })
          .from(lineups)
          .where(
            and(
              eq(lineups.leagueId, leagueId),
              eq(lineups.userId, user.id),
              eq(lineups.season, SEASON_YEAR),
              eq(lineups.week, week),
            ),
          )
          .limit(1);

        const usageRows = await db
          .select({
            playerId: playerUsage.playerId,
            timesUsed: playerUsage.timesUsed,
          })
          .from(playerUsage)
          .where(
            and(
              eq(playerUsage.leagueId, leagueId),
              eq(playerUsage.userId, user.id),
              eq(playerUsage.season, SEASON_YEAR),
            ),
          );

        return jsonResponse({
          lineup: lineupRows[0] ?? null,
          playerUsage: usageRows,
        });
      }

      const lineupRows = await db
        .select({
          id: lineups.id,
          week: lineups.week,
          season: lineups.season,
          slots: lineups.slots,
          projectedPoints: lineups.projectedPoints,
          actualPoints: lineups.actualPoints,
          lockedAt: lineups.lockedAt,
          createdAt: lineups.createdAt,
          updatedAt: lineups.updatedAt,
        })
        .from(lineups)
        .where(and(eq(lineups.leagueId, leagueId), eq(lineups.userId, user.id), eq(lineups.season, SEASON_YEAR)));

      const usageRows = await db
        .select({
          playerId: playerUsage.playerId,
          timesUsed: playerUsage.timesUsed,
        })
        .from(playerUsage)
        .where(
          and(
            eq(playerUsage.leagueId, leagueId),
            eq(playerUsage.userId, user.id),
            eq(playerUsage.season, SEASON_YEAR),
          ),
        );

      return jsonResponse({
        lineups: lineupRows.sort((a, b) => a.week - b.week),
        playerUsage: usageRows,
      });
    }

    if (request.method === 'PUT') {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      }

      const parsed = saveLineupSchema.safeParse(body);
      if (!parsed.success) return jsonResponse({ error: parsed.error.issues[0].message }, 400);
      return jsonResponse(await saveLineup({
        ...parsed.data, leagueId, actorId: user.id, targetUserId: user.id,
      }));
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error) {
    return errorResponse(error);
  }
}
