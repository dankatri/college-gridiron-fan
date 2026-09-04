import { and, eq } from 'drizzle-orm';
import { db } from '../../../src/server/db';
import { leagueMembers, lineups, playerUsage } from '../../../src/server/schema';
import { requireUser } from '../../../src/server/auth-utils';
import { FIRST_WEEK, LAST_WEEK, MAX_PLAYER_USES } from '../../../src/lib/types';
import { SEASON_YEAR } from '../../../src/lib/season-config';
import { isWeekComplete } from '../../../src/lib/week-lock';
import { findLockedSlotChange, loadLockedPlayers } from '../../../src/server/lineup-lock';
import {
  normalizeSlots,
  toUsageMap,
  validateLineupSlots,
  type LineupSlotInput,
} from '../../../src/server/lineup-utils';

export const config = {
  runtime: 'edge',
};

type SaveLineupBody = {
  week?: number;
  slots?: LineupSlotInput[];
  projectedPoints?: number;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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
    const isMember = await assertLeagueMembership(leagueId, user.id);
    if (!isMember) {
      return jsonResponse({ error: 'You are not a member of this league' }, 403);
    }

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const weekParam = url.searchParams.get('week');

      if (weekParam) {
        const week = Number.parseInt(weekParam, 10);
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
      let body: SaveLineupBody;
      try {
        body = (await request.json()) as SaveLineupBody;
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      }

      const week = body.week;
      if (week === undefined || week === null || !Number.isInteger(week) || week < FIRST_WEEK || week > LAST_WEEK) {
        return jsonResponse({ error: `Week must be between ${FIRST_WEEK} and ${LAST_WEEK}` }, 400);
      }
      if (isWeekComplete(week)) {
        return jsonResponse({ error: `Week ${week} is over and can no longer be changed` }, 409);
      }
      if (!Array.isArray(body.slots)) {
        return jsonResponse({ error: 'Slots are required' }, 400);
      }

      const slots = normalizeSlots(body.slots);
      const validation = validateLineupSlots(slots);
      if (!validation.ok) {
        return jsonResponse({ error: validation.error }, 400);
      }

      const seasonLineups = await db
        .select({
          week: lineups.week,
          slots: lineups.slots,
        })
        .from(lineups)
        .where(and(eq(lineups.leagueId, leagueId), eq(lineups.userId, user.id), eq(lineups.season, SEASON_YEAR)));

      // Players lock one at a time, as their own game kicks off, so the rest
      // of the week's slots stay editable around them.
      const previousSlots = (seasonLineups.find((row) => row.week === week)?.slots as LineupSlotInput[]) ?? [];
      const lockedPlayers = await loadLockedPlayers(week);
      const lockConflict = findLockedSlotChange(previousSlots, slots, lockedPlayers);
      if (lockConflict) {
        return jsonResponse({ error: lockConflict }, 409);
      }

      const usageCandidates = seasonLineups
        .filter((row) => row.week !== week)
        .map((row) => ({ slots: row.slots as LineupSlotInput[] }));
      usageCandidates.push({ slots });

      const usageMap = toUsageMap(usageCandidates);
      const exceededUsage = Array.from(usageMap.entries()).find(([, timesUsed]) => timesUsed > MAX_PLAYER_USES);
      if (exceededUsage) {
        return jsonResponse(
          { error: `Player ${exceededUsage[0]} exceeds max usage limit of ${MAX_PLAYER_USES}` },
          409,
        );
      }

      const projectedPoints = Number.isFinite(body.projectedPoints) ? Number(body.projectedPoints).toFixed(2) : '0';

      const upserted = await db
        .insert(lineups)
        .values({
          leagueId,
          userId: user.id,
          season: SEASON_YEAR,
          week,
          slots,
          projectedPoints,
          lockedAt: isWeekComplete(week) ? new Date() : null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [lineups.leagueId, lineups.userId, lineups.season, lineups.week],
          set: {
            slots,
            projectedPoints,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: lineups.id,
          week: lineups.week,
          season: lineups.season,
          slots: lineups.slots,
          projectedPoints: lineups.projectedPoints,
          actualPoints: lineups.actualPoints,
          lockedAt: lineups.lockedAt,
          createdAt: lineups.createdAt,
          updatedAt: lineups.updatedAt,
        });

      await db
        .delete(playerUsage)
        .where(and(eq(playerUsage.leagueId, leagueId), eq(playerUsage.userId, user.id), eq(playerUsage.season, SEASON_YEAR)));

      const usageRows = Array.from(usageMap.entries()).map(([playerId, timesUsed]) => ({
        leagueId,
        userId: user.id,
        season: SEASON_YEAR,
        playerId,
        timesUsed,
      }));

      if (usageRows.length > 0) {
        await db.insert(playerUsage).values(usageRows);
      }

      return jsonResponse({
        lineup: upserted[0] ?? null,
        playerUsage: usageRows.map((row) => ({ playerId: row.playerId, timesUsed: row.timesUsed })),
      });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process lineup request';
    const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
}
