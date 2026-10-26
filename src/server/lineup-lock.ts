/**
 * Server-side enforcement of per-player lineup locks.
 *
 * The client hides locked players, but the API is what actually has to hold
 * the line: once a player's game has kicked off, that slot is settled and no
 * request can move them in or out of it.
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { dataCache } from './schema';
import { playersCacheKey, schedulesCacheKey } from './cache-keys';
import { SEASON_YEAR } from '../lib/season-config';
import { lockedTeamsForWeek } from '../lib/week-lock';
import { CLASSIFICATIONS, CLASSIFICATION_LABELS, type Classification } from '../lib/classification';
import { FCS_WEEK, isFcsWeek, isPlayerEligibleForWeek } from '../lib/week-divisions';
import type { TeamSchedule } from '../lib/types';
import type { LineupSlotInput } from './lineup-utils';
import { HttpError } from './http';
import { scheduleCompletionSchema } from './week-completion';

type CachedPlayer = { id: string; name?: string; team?: string; classification?: Classification };

/** What the cache knows about a player, independent of whether their game has kicked off. */
export type PlayerIdentities = {
  /** Display names for cached ids, so errors can name the player. */
  nameById: Map<string, string>;
  /** Division per cached id. Undefined means the snapshot predates the field (treated as FBS). */
  classificationById: Map<string, Classification | undefined>;
};

export type LockedPlayers = PlayerIdentities & {
  /** Player ids whose game in this week has already started. */
  ids: Set<string>;
};

/**
 * Every player whose game in `week` has already kicked off.
 *
 * Both lookups come from the same cache the rest of the app reads, so a lock
 * decision here always matches what the browser was shown.
 */
export async function loadLockedPlayers(week: number, now: Date = new Date()): Promise<LockedPlayers> {
  const { db } = await import('./db');
  const [scheduleRows, playerRows] = await Promise.all([
    db
      .select({ data: dataCache.data })
      .from(dataCache)
      .where(eq(dataCache.key, schedulesCacheKey(SEASON_YEAR)))
      .limit(1),
    db
      .select({ data: dataCache.data })
      .from(dataCache)
      .where(eq(dataCache.key, playersCacheKey(SEASON_YEAR)))
      .limit(1),
  ]);

  return lockedPlayersFromData(scheduleRows[0]?.data, playerRows[0]?.data, week, now);
}

const cachedSchedules = z.array(z.object({
  teamId: z.string(), teamName: z.string().min(1), conference: z.string(),
  byeWeeks: z.array(z.number().int()),
  weeklyGames: z.array(z.object({
    week: z.number().int(), isByeWeek: z.boolean(), isHomeGame: z.boolean(),
    gameDate: z.string().datetime({ offset: true }).optional(),
    isCompleted: z.boolean().optional(),
  }).passthrough()),
})).nonempty().and(scheduleCompletionSchema);
const cachedPlayers = z.array(z.object({
  id: z.string().min(1), team: z.string().min(1), name: z.string().optional(),
  classification: z.enum(CLASSIFICATIONS).optional(),
})).nonempty();

function identitiesFromPlayers(players: CachedPlayer[]): PlayerIdentities {
  const nameById = new Map<string, string>();
  const classificationById = new Map<string, Classification | undefined>();
  for (const player of players) {
    nameById.set(player.id, player.name ?? player.id);
    classificationById.set(player.id, player.classification);
  }
  return { nameById, classificationById };
}

/**
 * What the cache knows about each player id, read without requiring (or
 * trusting) the schedule data `lockedPlayersFromData` needs.
 *
 * Used for the division-eligibility gate on the admin save path, which does
 * not go through the kickoff-lock machinery at all — see save-lineup.ts.
 * A cache that fails to parse yields no known players rather than throwing,
 * so a stale or missing snapshot does not block saves that eligibility
 * checking does not actually need to reject.
 */
export function playerIdentitiesFromData(playerData: unknown): PlayerIdentities {
  const result = cachedPlayers.safeParse(playerData);
  return result.success ? identitiesFromPlayers(result.data) : { nameById: new Map(), classificationById: new Map() };
}

export function lockedPlayersFromData(
  scheduleData: unknown, playerData: unknown, week: number, now: Date,
): LockedPlayers {
  const scheduleResult = cachedSchedules.safeParse(scheduleData);
  const playerResult = cachedPlayers.safeParse(playerData);
  if (!scheduleResult.success || !playerResult.success) {
    throw new HttpError(503, 'Schedules or player data are unavailable. Your lineup has not been changed.');
  }
  const schedules: TeamSchedule[] = scheduleResult.data.map(schedule => ({
    ...schedule,
    weeklyGames: schedule.weeklyGames.map(game => ({
      ...game, gameDate: game.gameDate ? new Date(game.gameDate) : undefined,
    })),
  }));
  const players = playerResult.data;
  const lockedTeams = lockedTeamsForWeek(schedules, week, now);
  const knownTeams = new Set(schedules.map(schedule => schedule.teamName.toLowerCase()));
  const ids = new Set<string>();

  for (const player of players) {
    // An absent team schedule is unknown, not evidence that it is unlocked.
    if (!knownTeams.has(player.team.toLowerCase())) ids.add(player.id);
    if (player.team && lockedTeams.has(player.team.toLowerCase())) {
      ids.add(player.id);
    }
  }

  return { ids, ...identitiesFromPlayers(players) };
}

function filledIds(slots: Array<Pick<LineupSlotInput, 'playerId'>>): Set<string> {
  const ids = new Set<string>();
  for (const slot of slots) {
    if (slot.playerId) ids.add(slot.playerId);
  }
  return ids;
}

/**
 * Rejects a save that would add or drop a player whose game has begun.
 *
 * Comparing sets rather than slot positions means shuffling a locked player
 * between two slots of the same position is still allowed — they are in the
 * lineup either way, so the score is unaffected.
 *
 * Returns an error message, or null when the change is allowed.
 */
export function findLockedSlotChange(
  previousSlots: Array<Pick<LineupSlotInput, 'playerId'>>,
  nextSlots: Array<Pick<LineupSlotInput, 'playerId'>>,
  locked: LockedPlayers,
): string | null {
  if (locked.ids.size === 0) return null;

  const before = filledIds(previousSlots);
  const after = filledIds(nextSlots);
  const nameOf = (id: string) => locked.nameById.get(id) ?? id;

  for (const id of before) {
    if (!after.has(id) && locked.ids.has(id)) {
      return `${nameOf(id)} cannot be removed — their game has already started`;
    }
  }

  for (const id of after) {
    if (!before.has(id) && locked.ids.has(id)) {
      return `${nameOf(id)} cannot be added — their game has already started`;
    }
  }

  return null;
}

/**
 * Rejects a slot fielding a player from the wrong division for `week`.
 *
 * An id absent from `classificationById` entirely is not judged here — that
 * is a different failure (the player is not in the current pool at all),
 * already surfaced elsewhere as a 503. Only ids the cache actually knows
 * about can be ruled in or out of a division.
 */
export function findIneligibleSlot(
  slots: Array<Pick<LineupSlotInput, 'playerId'>>,
  identities: PlayerIdentities,
  week: number,
): string | null {
  for (const slot of slots) {
    const id = slot.playerId;
    if (!id || !identities.classificationById.has(id)) continue;
    const classification = identities.classificationById.get(id);
    if (isPlayerEligibleForWeek({ classification }, week)) continue;
    const name = identities.nameById.get(id) ?? id;
    const label = CLASSIFICATION_LABELS[classification ?? 'fbs'];
    return isFcsWeek(week)
      ? `${name} is ${label}, but week ${FCS_WEEK} is Halloween's FCS-only week — only FCS players are eligible`
      : `${name} is ${label}, and only week ${FCS_WEEK} (Halloween) allows FCS players — week ${week} is FBS-only`;
  }
  return null;
}
