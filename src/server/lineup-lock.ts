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
import type { TeamSchedule } from '../lib/types';
import type { LineupSlotInput } from './lineup-utils';
import { HttpError } from './http';

type CachedPlayer = { id: string; name?: string; team?: string };

export type LockedPlayers = {
  /** Player ids whose game in this week has already started. */
  ids: Set<string>;
  /** Display names for those ids, so errors can name the player. */
  nameById: Map<string, string>;
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
})).nonempty();
const cachedPlayers = z.array(z.object({
  id: z.string().min(1), team: z.string().min(1), name: z.string().optional(),
})).nonempty();

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
  const nameById = new Map<string, string>();

  for (const player of players) {
    nameById.set(player.id, player.name ?? player.id);
    // An absent team schedule is unknown, not evidence that it is unlocked.
    if (!knownTeams.has(player.team.toLowerCase())) ids.add(player.id);
    if (player.team && lockedTeams.has(player.team.toLowerCase())) {
      ids.add(player.id);
    }
  }

  return { ids, nameById };
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
