import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../src/server/db';
import { leagueMembers, leagues, lineupAuditLog, lineups, users } from '../../../src/server/schema';
import { requireUser } from '../../../src/server/auth-utils';
import { FIRST_WEEK, LAST_WEEK } from '../../../src/lib/types';
import { SEASON_YEAR } from '../../../src/lib/season-config';
import { isWeekComplete } from '../../../src/lib/week-lock';
import {
  toUsageMap,
  type LineupSlotInput,
} from '../../../src/server/lineup-utils';
import { adminSaveLineupSchema } from '../../../src/server/lineup-input';
import { saveLineup } from '../../../src/server/save-lineup';
import { jsonResponse, errorResponse } from '../../../src/server/http';

export const config = {
  runtime: 'edge',
};

const AUDIT_PAGE_SIZE = 50;

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

      const week = /^\d+$/.test(weekParam) ? Number(weekParam) : NaN;
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
        isWeekLocked: isWeekComplete(week),
        members: memberPayload,
        auditLog: await loadAuditLog(leagueId),
      });
    }

    if (request.method === 'PUT') {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      }

      const parsed = adminSaveLineupSchema.safeParse(body);
      if (!parsed.success) return jsonResponse({ error: parsed.error.issues[0].message }, 400);
      return jsonResponse(await saveLineup({
        ...parsed.data, leagueId, actorId: user.id, targetUserId: parsed.data.userId, admin: true,
      }));
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error) {
    return errorResponse(error);
  }
}
