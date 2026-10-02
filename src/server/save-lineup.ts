import { and, eq, inArray } from 'drizzle-orm';
import { dataCache, leagues, lineupAuditLog, lineups } from './schema';
import { playersCacheKey, schedulesCacheKey } from './cache-keys';
import { SEASON_YEAR } from '../lib/season-config';
import { MAX_PLAYER_USES } from '../lib/types';
import { isWeekComplete } from '../lib/week-lock';
import { findLockedSlotChange, lockedPlayersFromData } from './lineup-lock';
import { toUsageMap, type LineupSlotInput } from './lineup-utils';
import { saveLineupSchema } from './lineup-input';
import { HttpError } from './http';
import { withLineupTransaction, type LineupTransaction } from './lineup-transaction';
import { lockLineupMember, replaceUsage } from './lineup-storage';
import { completedGameWeeksFromCache } from './week-completion';

export interface SaveLineupInput {
  leagueId: string;
  actorId: string;
  targetUserId: string;
  week: number;
  slots: LineupSlotInput[];
  projectedPoints?: number;
  admin?: boolean;
  reason?: string;
}

export async function saveLineup(input: SaveLineupInput) {
  return withLineupTransaction(transaction => saveLineupInTransaction(transaction, input));
}

/** All mutable validation follows the member lock, including different-week saves. */
export async function saveLineupInTransaction(
  transaction: LineupTransaction,
  input: SaveLineupInput,
  clock: () => Date = () => new Date(),
) {
  const parsed = saveLineupSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
  const { week, slots } = parsed.data;
  const { leagueId, actorId, targetUserId, admin = false } = input;
  if (!admin && actorId !== targetUserId) throw new HttpError(403, 'You can only change your own lineup');

  await lockLineupMember(transaction, leagueId, targetUserId, admin ? 404 : 403);

  if (admin) {
    const [league] = await transaction.select({ ownerId: leagues.ownerId }).from(leagues).where(eq(leagues.id, leagueId));
    if (!league || league.ownerId !== actorId) throw new HttpError(403, 'Only the league owner can manage member lineups');
  }

  const memberSeason = and(eq(lineups.leagueId, leagueId), eq(lineups.userId, targetUserId), eq(lineups.season, SEASON_YEAR));
  const existing = await transaction.select({ week: lineups.week, slots: lineups.slots }).from(lineups).where(memberSeason);
  const previousSlots = existing.find(row => row.week === week)?.slots ?? null;
  const schedulesKey = schedulesCacheKey(SEASON_YEAR);
  const playersKey = playersCacheKey(SEASON_YEAR);
  const sourceRows = await transaction.select({ key: dataCache.key, data: dataCache.data })
    .from(dataCache).where(inArray(dataCache.key, admin ? [schedulesKey] : [schedulesKey, playersKey]));
  const scheduleData = sourceRows.find(row => row.key === schedulesKey)?.data;

  // Sampling before SELECT FOR UPDATE would allow a waiting request past kickoff.
  const now = clock();
  const closed = isWeekComplete(week, now, completedGameWeeksFromCache(scheduleData));
  if (!admin) {
    if (closed) throw new HttpError(409, `Week ${week} is over and can no longer be changed`);
    const locked = lockedPlayersFromData(
      scheduleData,
      sourceRows.find(row => row.key === playersKey)?.data,
      week, now,
    );
    const before = new Set((previousSlots ?? []).map(slot => slot.playerId).filter(Boolean));
    for (const id of before) {
      if (id && !locked.nameById.has(id)) locked.ids.add(id);
    }
    for (const slot of slots) {
      if (slot.playerId && !before.has(slot.playerId) && !locked.nameById.has(slot.playerId)) {
        throw new HttpError(503, 'A selected player is not in the current player data. Refresh and try again.');
      }
    }
    const conflict = findLockedSlotChange(previousSlots ?? [], slots, locked);
    if (conflict) throw new HttpError(409, conflict);
  }

  // Historic slot layouts are not rewritten or revalidated as new input; every
  // saved player reference still contributes to the authoritative usage count.
  const candidates = existing.filter(row => row.week !== week).map(row => ({ slots: row.slots }));
  candidates.push({ slots });
  const usage = toUsageMap(candidates);
  const exceeded = [...usage].find(([, count]) => count > MAX_PLAYER_USES);
  if (exceeded) throw new HttpError(409, `Player ${exceeded[0]} exceeds max usage limit of ${MAX_PLAYER_USES}`);

  const projectedPoints = (parsed.data.projectedPoints ?? 0).toFixed(2);
  const [lineup] = await transaction.insert(lineups).values({
    leagueId, userId: targetUserId, season: SEASON_YEAR, week, slots, projectedPoints,
    lockedAt: closed ? now : null, updatedAt: now,
  }).onConflictDoUpdate({
    target: [lineups.leagueId, lineups.userId, lineups.season, lineups.week],
    set: { slots, projectedPoints, updatedAt: now },
  }).returning();
  if (!lineup) throw new Error('Lineup write returned no row');

  const usageRows = await replaceUsage(transaction, leagueId, targetUserId, usage);

  const [auditEntry] = admin ? await transaction.insert(lineupAuditLog).values({
    leagueId, subjectUserId: targetUserId, actorUserId: actorId, season: SEASON_YEAR, week,
    previousSlots, newSlots: slots, reason: input.reason?.trim().slice(0, 500) || null,
    wasLocked: closed ? 1 : 0, createdAt: now,
  }).returning() : [];

  // Keep the existing member response shape; internal identifiers stay internal.
  const { id, season, actualPoints, lockedAt, createdAt, updatedAt } = lineup;
  return {
    lineup: { id, season, week, slots, projectedPoints, actualPoints, lockedAt, createdAt, updatedAt },
    playerUsage: usageRows,
    ...(auditEntry ? { auditEntry } : {}),
  };
}
