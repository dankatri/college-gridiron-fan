import type { LineupSlot, Player } from './types';
import { slotPlayerId } from './utils-fantasy';

export type ApiLineupSlot = {
  slotIndex: number;
  position: 'QB' | 'RB' | 'WR';
  playerId: string | null;
};

/**
 * Turn a stored lineup into editable slots. The player id is kept even when the
 * matching player record has not loaded, so a slot is never quietly emptied.
 */
export function hydrateSlots(slots: ApiLineupSlot[], playersById: Map<string, Player>): LineupSlot[] {
  return [...slots]
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((slot) => ({
      slotIndex: slot.slotIndex,
      position: slot.position,
      playerId: slot.playerId ?? undefined,
      player: slot.playerId ? playersById.get(slot.playerId) : undefined,
    }));
}

export function toSlotPayload(lineup: LineupSlot[]): ApiLineupSlot[] {
  return lineup.map((slot) => ({
    slotIndex: slot.slotIndex,
    position: slot.position,
    playerId: slotPlayerId(slot) ?? null,
  }));
}

/**
 * Widen the known player pool with players fetched for a filtered view.
 *
 * Filtering the player table fetches only the players matching that filter.
 * Replacing the pool with that subset would make any selected player from
 * another team unresolvable, which emptied their lineup slot. Merging keeps the
 * pool growing instead. Returns the original array when nothing is new, so
 * this cannot drive a render loop.
 */
export function mergePlayerPool(previous: Player[], incoming: Player[]): Player[] {
  const merged = new Map(previous.map((player) => [player.id, player]));
  const added = incoming.filter((player) => !merged.has(player.id));
  if (added.length === 0) return previous;

  for (const player of added) {
    merged.set(player.id, player);
  }
  return Array.from(merged.values());
}
