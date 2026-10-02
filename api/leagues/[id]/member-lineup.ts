import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../../src/server/db';
import { dataCache, leagueMembers, lineups, users } from '../../../src/server/schema';
import { requireUser } from '../../../src/server/auth-utils';
import { liveStatsCacheKey, playersCacheKey } from '../../../src/server/cache-keys';
import { SEASON_YEAR } from '../../../src/lib/season-config';
import { isWeekComplete } from '../../../src/lib/week-lock';
import type { LineupSlotInput } from '../../../src/server/lineup-utils';
import { FIRST_WEEK, LAST_WEEK } from '../../../src/lib/types';
import type { PlayerStats } from '../../../src/lib/types';
import { cacheQueryMode, projectPlayers } from '../../../src/server/cache-projections';
import { jsonResponse } from '../../../src/server/http';
import { loadCompletedGameWeeks } from '../../../src/server/week-completion';

export const config = {
  runtime: 'edge',
};

type CachedPlayer = {
  id: string;
  name?: string;
  team?: string;
  position?: string;
  projectedPoints?: number;
};

type LiveCachePayload = { week?: number; stats?: PlayerStats[] };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getLeagueId(request: Request): string | null {
  const leagueId = new URL(request.url).pathname.split('/')[3];
  return leagueId || null;
}

/**
 * Another league member's lineup for a week that is over.
 *
 * Lineups are private while they still matter competitively, so this refuses
 * any week that has not finished. That check is the whole point of the
 * endpoint and is deliberately made before the lineup is ever read.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const leagueId = getLeagueId(request);
  if (!leagueId || !UUID_PATTERN.test(leagueId)) {
    return jsonResponse({ error: 'League ID is required' }, 400);
  }

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get('userId');
  const weekParam = url.searchParams.get('week');

  if (!targetUserId) {
    return jsonResponse({ error: 'userId is required' }, 400);
  }

  // Postgres rejects a malformed uuid at parse time, which would surface as a
  // 500 for what is really a bad request.
  if (!UUID_PATTERN.test(targetUserId)) {
    return jsonResponse({ error: 'userId is not valid' }, 400);
  }
  // Week 0 is a real week, so check for a missing param rather than falsiness.
  if (weekParam === null || weekParam === '') {
    return jsonResponse({ error: 'week is required' }, 400);
  }

  const week = Number(weekParam);
  if (!Number.isInteger(week) || week < FIRST_WEEK || week > LAST_WEEK) {
    return jsonResponse({ error: 'week is not part of this season' }, 400);
  }

  try {
    const user = await requireUser(request);

    // Both people must be in this league: one to ask, one to be looked at.
    const membership = await db
      .select({ userId: leagueMembers.userId })
      .from(leagueMembers)
      .where(and(eq(leagueMembers.leagueId, leagueId), inArray(leagueMembers.userId, [user.id, targetUserId])));

    if (!membership.some((row) => row.userId === user.id)) {
      return jsonResponse({ error: 'You are not a member of this league' }, 403);
    }
    if (!membership.some((row) => row.userId === targetUserId)) {
      return jsonResponse({ error: 'That player is not in this league' }, 404);
    }

    // Your own lineup is always yours to see; everyone else's stays sealed
    // until the week has been played out.
    const gameFinals = targetUserId !== user.id ? await loadCompletedGameWeeks() : undefined;
    const now = new Date();
    if (targetUserId !== user.id && !isWeekComplete(week, now, gameFinals)) {
      return jsonResponse(
        { error: `Week ${week} is not finished yet — lineups are revealed once the week ends` },
        403,
      );
    }

    const [target] = await db
      .select({ id: users.id, username: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!target) {
      return jsonResponse({ error: 'Player not found' }, 404);
    }

    const [lineupRow] = await db
      .select({ slots: lineups.slots, projectedPoints: lineups.projectedPoints })
      .from(lineups)
      .where(
        and(
          eq(lineups.leagueId, leagueId),
          eq(lineups.userId, targetUserId),
          eq(lineups.season, SEASON_YEAR),
          eq(lineups.week, week),
        ),
      )
      .limit(1);

    // Which other weeks are worth offering, so the dialog can page between
    // them without asking for weeks it will only be refused.
    const otherWeeks = await db
      .select({ week: lineups.week })
      .from(lineups)
      .where(
        and(eq(lineups.leagueId, leagueId), eq(lineups.userId, targetUserId), eq(lineups.season, SEASON_YEAR)),
      );

    const availableWeeks = otherWeeks
      .map((row) => row.week)
      .filter((candidate) => targetUserId === user.id || isWeekComplete(candidate, now, gameFinals))
      .sort((a, b) => a - b);

    if (!lineupRow) {
      return jsonResponse({
        userId: target.id,
        username: target.username,
        avatarUrl: target.avatarUrl,
        week,
        slots: [],
        totalPoints: 0,
        projectedPoints: 0,
        availableWeeks,
      });
    }

    const [playerRow, liveRow] = await Promise.all([
      cacheQueryMode('MEMBER_LINEUP_QUERY_MODE') === 'projected'
        ? db.execute<{ data: CachedPlayer[] }>(projectPlayers(SEASON_YEAR, lineupRow.slots.flatMap(slot => slot.playerId ? [slot.playerId] : []))).then(result => result.rows)
        : db
        .select({ data: dataCache.data })
        .from(dataCache)
        .where(eq(dataCache.key, playersCacheKey(SEASON_YEAR)))
        .limit(1),
      db
        .select({ data: dataCache.data })
        .from(dataCache)
        .where(eq(dataCache.key, liveStatsCacheKey(SEASON_YEAR, week)))
        .limit(1),
    ]);

    const pool = (playerRow[0]?.data as CachedPlayer[] | undefined) ?? [];
    const byId = new Map(pool.map((player) => [player.id, player]));

    const livePayload = liveRow[0]?.data as LiveCachePayload | undefined;
    const statsById = new Map((livePayload?.stats ?? []).map((stat) => [stat.playerId, stat]));

    const slots = ((lineupRow.slots ?? []) as LineupSlotInput[])
      .slice()
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((slot) => {
        const player = slot.playerId ? byId.get(slot.playerId) : undefined;
        const stats = slot.playerId ? statsById.get(slot.playerId) : undefined;
        return {
          slotIndex: slot.slotIndex,
          position: slot.position,
          playerId: slot.playerId,
          name: player?.name ?? null,
          team: player?.team ?? null,
          projectedPoints: player?.projectedPoints ?? null,
          actualPoints: stats?.fantasyPoints ?? (slot.playerId ? 0 : null),
          stats: stats ?? null,
        };
      });

    const totalPoints = slots.reduce((sum, slot) => sum + (slot.actualPoints ?? 0), 0);

    return jsonResponse({
      userId: target.id,
      username: target.username,
      avatarUrl: target.avatarUrl,
      week,
      slots,
      totalPoints: Number(totalPoints.toFixed(2)),
      projectedPoints: Number.parseFloat(lineupRow.projectedPoints ?? '0') || 0,
      availableWeeks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch lineup';
    const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
}
