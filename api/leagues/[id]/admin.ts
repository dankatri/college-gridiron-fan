import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../src/server/db';
import { leagueMembers, leagues, lineupAuditLog, lineups, playerUsage, users } from '../../../src/server/schema';
import { requireUser } from '../../../src/server/auth-utils';
import { FIRST_WEEK, LAST_WEEK, MAX_PLAYER_USES } from '../../../src/lib/types';
import { SEASON_YEAR } from '../../../src/lib/season-config';
import { isWeekLocked } from '../../../src/lib/utils-fantasy';
import {
  normalizeSlots,
  toUsageMap,
  validateLineupSlots,
  type LineupSlotInput,
} from '../../../src/server/lineup-utils';

export const config = {
  runtime: 'edge',
};

const AUDIT_PAGE_SIZE = 50;

type AdminSaveBody = {
  userId?: string;
  week?: number;
  slots?: LineupSlotInput[];
  projectedPoints?: number;
  reason?: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getLeagueId(request: Request): string | null {
  return new URL(request.url).pathname.split('/')[3] || null;
}

/**
 * Only the league owner may act on another member's behalf. Returns the league
 * row so callers can reuse it without a second query.
 */
async function requireLeagueOwner(leagueId: string, userId: string) {
  const rows = await db
    .select({ id: leagues.id, ownerId: leagues.ownerId, season: leagues.season })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1);

  const league = rows[0];
  if (!league) return { ok: false as const, status: 404, error: 'League not found' };
  if (league.ownerId !== userId) {
    return { ok: false as const, status: 403, error: 'Only the league owner can manage member lineups' };
  }
  return { ok: true as const, league };
}

async function loadAuditLog(leagueId: string) {
  const entries = await db
    .select({
      id: lineupAuditLog.id,
      week: lineupAuditLog.week,
      season: lineupAuditLog.season,
      subjectUserId: lineupAuditLog.subjectUserId,
      actorUserId: lineupAuditLog.actorUserId,
      previousSlots: lineupAuditLog.previousSlots,
      newSlots: lineupAuditLog.newSlots,
      reason: lineupAuditLog.reason,
      wasLocked: lineupAuditLog.wasLocked,
      createdAt: lineupAuditLog.createdAt,
    })
    .from(lineupAuditLog)
    .where(and(eq(lineupAuditLog.leagueId, leagueId), eq(lineupAuditLog.season, SEASON_YEAR)))
    .orderBy(desc(lineupAuditLog.createdAt))
    .limit(AUDIT_PAGE_SIZE);

  // Actor and subject both point at users; resolve both in one lookup rather
  // than joining the same table twice.
  const userIds = Array.from(new Set(entries.flatMap((entry) => [entry.actorUserId, entry.subjectUserId])));
  const names = userIds.length
    ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, userIds))
    : [];
  const nameById = new Map(names.map((row) => [row.id, row.displayName]));

  return entries.map((entry) => ({
    ...entry,
    actorName: nameById.get(entry.actorUserId) ?? 'Unknown user',
    subjectName: nameById.get(entry.subjectUserId) ?? 'Unknown member',
  }));
}

export default async function handler(request: Request): Promise<Response> {
  const leagueId = getLeagueId(request);
  if (!leagueId) {
    return jsonResponse({ error: 'League ID is required' }, 400);
  }

  try {
    const user = await requireUser(request);
    const ownership = await requireLeagueOwner(leagueId, user.id);
    if (!ownership.ok) {
      return jsonResponse({ error: ownership.error }, ownership.status);
    }

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const weekParam = url.searchParams.get('week');

      if (weekParam === null) {
        return jsonResponse({ error: 'A week is required' }, 400);
      }

      const week = Number.parseInt(weekParam, 10);
      if (!Number.isInteger(week) || week < FIRST_WEEK || week > LAST_WEEK) {
        return jsonResponse({ error: `Week must be between ${FIRST_WEEK} and ${LAST_WEEK}` }, 400);
      }

      const members = await db
        .select({
          userId: leagueMembers.userId,
          role: leagueMembers.role,
          joinedAt: leagueMembers.joinedAt,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(leagueMembers)
        .innerJoin(users, eq(users.id, leagueMembers.userId))
        .where(eq(leagueMembers.leagueId, leagueId));

      const seasonLineups = await db
        .select({
          userId: lineups.userId,
          week: lineups.week,
          slots: lineups.slots,
          projectedPoints: lineups.projectedPoints,
          actualPoints: lineups.actualPoints,
          updatedAt: lineups.updatedAt,
        })
        .from(lineups)
        .where(and(eq(lineups.leagueId, leagueId), eq(lineups.season, SEASON_YEAR)));

      const memberPayload = members.map((member) => {
        const forMember = seasonLineups.filter((row) => row.userId === member.userId);
        const weekLineup = forMember.find((row) => row.week === week) ?? null;
        const usage = toUsageMap(forMember.map((row) => ({ slots: row.slots as LineupSlotInput[] })));

        return {
          userId: member.userId,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          role: member.userId === ownership.league.ownerId ? 'owner' : member.role,
          joinedAt: member.joinedAt,
          weeksSet: forMember.length,
          lineup: weekLineup,
          playerUsage: Array.from(usage.entries()).map(([playerId, timesUsed]) => ({ playerId, timesUsed })),
        };
      });

      return jsonResponse({
        week,
        season: SEASON_YEAR,
        isWeekLocked: isWeekLocked(week),
        members: memberPayload,
        auditLog: await loadAuditLog(leagueId),
      });
    }

    if (request.method === 'PUT') {
      let body: AdminSaveBody;
      try {
        body = (await request.json()) as AdminSaveBody;
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      }

      const targetUserId = body.userId;
      if (!targetUserId) {
        return jsonResponse({ error: 'A member is required' }, 400);
      }

      const week = body.week;
      if (week === undefined || week === null || !Number.isInteger(week) || week < FIRST_WEEK || week > LAST_WEEK) {
        return jsonResponse({ error: `Week must be between ${FIRST_WEEK} and ${LAST_WEEK}` }, 400);
      }

      if (!Array.isArray(body.slots)) {
        return jsonResponse({ error: 'Slots are required' }, 400);
      }

      const targetMembership = await db
        .select({ userId: leagueMembers.userId })
        .from(leagueMembers)
        .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, targetUserId)))
        .limit(1);
      if (!targetMembership[0]) {
        return jsonResponse({ error: 'That member is not in this league' }, 404);
      }

      const slots = normalizeSlots(body.slots);
      const validation = validateLineupSlots(slots);
      if (!validation.ok) {
        return jsonResponse({ error: validation.error }, 400);
      }

      const seasonLineups = await db
        .select({ week: lineups.week, slots: lineups.slots })
        .from(lineups)
        .where(
          and(
            eq(lineups.leagueId, leagueId),
            eq(lineups.userId, targetUserId),
            eq(lineups.season, SEASON_YEAR),
          ),
        );

      const previousSlots = (seasonLineups.find((row) => row.week === week)?.slots as LineupSlotInput[]) ?? null;

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
      // Owners are explicitly allowed past the lock - fixing a locked week is
      // the main reason this page exists - but the override is always logged.
      const locked = isWeekLocked(week);

      const upserted = await db
        .insert(lineups)
        .values({
          leagueId,
          userId: targetUserId,
          season: SEASON_YEAR,
          week,
          slots,
          projectedPoints,
          lockedAt: locked ? new Date() : null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [lineups.leagueId, lineups.userId, lineups.season, lineups.week],
          set: { slots, projectedPoints, updatedAt: new Date() },
        })
        .returning({
          id: lineups.id,
          week: lineups.week,
          season: lineups.season,
          slots: lineups.slots,
          projectedPoints: lineups.projectedPoints,
          actualPoints: lineups.actualPoints,
          lockedAt: lineups.lockedAt,
          updatedAt: lineups.updatedAt,
        });

      await db
        .delete(playerUsage)
        .where(
          and(
            eq(playerUsage.leagueId, leagueId),
            eq(playerUsage.userId, targetUserId),
            eq(playerUsage.season, SEASON_YEAR),
          ),
        );

      const usageRows = Array.from(usageMap.entries()).map(([playerId, timesUsed]) => ({
        leagueId,
        userId: targetUserId,
        season: SEASON_YEAR,
        playerId,
        timesUsed,
      }));
      if (usageRows.length > 0) {
        await db.insert(playerUsage).values(usageRows);
      }

      const reason = body.reason?.trim() ? body.reason.trim().slice(0, 500) : null;
      await db.insert(lineupAuditLog).values({
        leagueId,
        subjectUserId: targetUserId,
        actorUserId: user.id,
        season: SEASON_YEAR,
        week,
        previousSlots,
        newSlots: slots,
        reason,
        wasLocked: locked ? 1 : 0,
      });

      return jsonResponse({
        lineup: upserted[0] ?? null,
        playerUsage: usageRows.map((row) => ({ playerId: row.playerId, timesUsed: row.timesUsed })),
        auditLog: await loadAuditLog(leagueId),
      });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process admin request';
    const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
}
