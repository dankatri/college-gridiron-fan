import { LineupSlot, LINEUP_REQUIREMENTS, Player, PlayerUsage } from './types';

export function createEmptyLineup(): LineupSlot[] {
  const lineup: LineupSlot[] = [];
  let slotIndex = 0;
  
  Object.entries(LINEUP_REQUIREMENTS).forEach(([position, count]) => {
    for (let i = 0; i < count; i++) {
      lineup.push({
        position: position as 'QB' | 'RB' | 'WR',
        slotIndex: slotIndex++,
      });
    }
  });
  
  return lineup;
}

export function calculateProjectedPoints(lineup: LineupSlot[]): number {
  return lineup.reduce((total, slot) => {
    return total + (slot.player?.projectedPoints || 0);
  }, 0);
}

export function getPlayerUsage(playerId: string, playerUsage: PlayerUsage[]): number {
  const usage = playerUsage.find(u => u.playerId === playerId);
  return usage ? usage.timesUsed : 0;
}

export function isPlayerAvailable(playerId: string, playerUsage: PlayerUsage[], maxUses: number = 3): boolean {
  return getPlayerUsage(playerId, playerUsage) < maxUses;
}

export function updatePlayerUsage(
  playerId: string, 
  playerUsage: PlayerUsage[], 
  increment: number = 1
): PlayerUsage[] {
  const existingUsage = playerUsage.find(u => u.playerId === playerId);
  
  if (existingUsage) {
    return playerUsage.map(u =>
      u.playerId === playerId
        ? { ...u, timesUsed: Math.max(0, u.timesUsed + increment) }
        : u
    );
  } else if (increment > 0) {
    return [...playerUsage, { playerId, timesUsed: increment }];
  }
  
  return playerUsage;
}

export function isLineupComplete(lineup: LineupSlot[]): boolean {
  return lineup.every(slot => slot.player !== undefined);
}

export function getAvailableSlots(lineup: LineupSlot[], position: 'QB' | 'RB' | 'WR'): LineupSlot[] {
  return lineup.filter(slot => slot.position === position && !slot.player);
}

export function isPlayerInLineup(playerId: string, lineup: LineupSlot[]): boolean {
  return lineup.some(slot => slotPlayerId(slot) === playerId);
}

/** The player in a slot, whether or not the full player record has loaded. */
export function slotPlayerId(slot: LineupSlot): string | undefined {
  return slot.player?.id ?? slot.playerId;
}

export function removePlayerFromLineup(playerId: string, lineup: LineupSlot[]): LineupSlot[] {
  return lineup.map(slot =>
    slotPlayerId(slot) === playerId
      ? { ...slot, player: undefined, playerId: undefined }
      : slot
  );
}

export function addPlayerToLineup(player: Player, slotIndex: number, lineup: LineupSlot[]): LineupSlot[] {
  return lineup.map(slot =>
    slot.slotIndex === slotIndex
      ? { ...slot, player, playerId: player.id }
      : slot
  );
}

/**
 * Fill in slots whose player record was not available when the lineup loaded.
 * Only untouched slots are filled, so this never resurrects a player the user
 * has since removed. Returns the original lineup when nothing changed.
 */
export function resolvePendingSlots(lineup: LineupSlot[], playersById: Map<string, Player>): LineupSlot[] {
  let changed = false;

  const resolved = lineup.map(slot => {
    if (slot.player || !slot.playerId) return slot;

    const player = playersById.get(slot.playerId);
    if (!player) return slot;

    changed = true;
    return { ...slot, player };
  });

  return changed ? resolved : lineup;
}

// Week locking functionality — reads from season-config.ts
import { weekBoundary, SEASON_YEAR } from './season-config';
import { hasWeekStarted, isWeekComplete } from './week-lock';
import { FIRST_WEEK, LAST_WEEK } from './types';

export function getCurrentWeek(): number {
  const now = new Date();
  const firstWeekStart = weekBoundary(FIRST_WEEK)!;

  // Before the season starts, return the opening week
  if (now < firstWeekStart) {
    return FIRST_WEEK;
  }

  // Find the latest week whose start date has passed
  for (let w = LAST_WEEK; w >= FIRST_WEEK; w--) {
    const start = weekBoundary(w);
    if (start && now >= start) {
      return w;
    }
  }

  return FIRST_WEEK;
}

export function getWeekStatus(week: number, now: Date = new Date(), gameFinals?: ReadonlySet<number>): 'upcoming' | 'current' | 'locked' | 'preseason' {
  const firstWeekStart = weekBoundary(FIRST_WEEK)!;

  // Before season starts, everything is preseason / upcoming
  if (now < firstWeekStart) {
    return 'preseason';
  }

  // 'locked' means the week is finished; a week that is merely under way is
  // still 'current', because its unplayed slots can still be changed.
  if (isWeekComplete(week, now, gameFinals)) {
    return 'locked';
  } else if (hasWeekStarted(week, now)) {
    return 'current';
  } else {
    return 'upcoming';
  }
}
export interface LineupPositionGroup {
  position: 'QB' | 'RB' | 'WR';
  slots: LineupSlot[];
}

/**
 * The lineup split into one group per position.
 *
 * Group order follows LINEUP_REQUIREMENTS rather than the slot order, so
 * changing the roster shape in one place reshapes the lineup UI with it.
 * Slots keep their original slotIndex, which is what edits are keyed on.
 */
export function groupLineupByPosition(lineup: LineupSlot[]): LineupPositionGroup[] {
  return Object.keys(LINEUP_REQUIREMENTS).map((position) => ({
    position: position as 'QB' | 'RB' | 'WR',
    slots: lineup.filter((slot) => slot.position === position),
  }));
}
