/**
 * Server-side enforcement of per-player lineup locks.
 *
 * The client hides locked players, but the API is what actually has to hold
 * the line: once a player's game has kicked off, that slot is settled and no
 * request can move them in or out of it.
 */

import { eq } from 'drizzle-orm';
import { db } from './db';
import { dataCache } from './schema';
import { playersCacheKey, schedulesCacheKey } from './cache-keys';
import { SEASON_YEAR } from '../lib/season-config';
import { lockedTeamsForWeek } from '../lib/week-lock';
import type { TeamSchedule } from '../lib/types';
import type { LineupSlotInput } from './lineup-utils';

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

  const schedules = (scheduleRows[0]?.data as TeamSchedule[] | undefined) ?? [];
  const players = (playerRows[0]?.data as CachedPlayer[] | undefined) ?? [];

  const lockedTeams = lockedTeamsForWeek(schedules, week, now);
  const ids = new Set<string>();
  const nameById = new Map<string, string>();

  for (const player of players) {
    if (player.team && lockedTeams.has(player.team.toLowerCase())) {
      ids.add(player.id);
      nameById.set(player.id, player.name ?? player.id);
    }
  }

  return { ids, nameById };
}

function filledIds(slots: LineupSlotInput[]): Set<string> {
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
  previousSlots: LineupSlotInput[],
  nextSlots: LineupSlotInput[],
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
