import { LINEUP_REQUIREMENTS } from '../lib/types';

export type LineupSlotInput = {
  slotIndex: number;
  position: 'QB' | 'RB' | 'WR';
  playerId: string | null;
};

export function normalizeSlots(slots: LineupSlotInput[]): LineupSlotInput[] {
  return [...slots]
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((slot) => ({ ...slot, playerId: slot.playerId ?? null }));
}

/** How many slots actually have a player in them. */
export function countFilledSlots(slots: LineupSlotInput[]): number {
  return slots.filter((slot) => !!slot.playerId).length;
}

/**
 * Checks the shape of a lineup. Empty slots are allowed so a lineup can be
 * saved half-finished and picked up again later; the only thing that has to
 * hold is that the slot layout itself is intact.
 */
export function validateLineupSlots(slots: LineupSlotInput[]): { ok: true } | { ok: false; error: string } {
  const requiredSlotCount = Object.values(LINEUP_REQUIREMENTS).reduce((sum, count) => sum + count, 0);
  if (slots.length !== requiredSlotCount) {
    return { ok: false, error: `Lineup must have exactly ${requiredSlotCount} slots` };
  }

  const positionCounts: Record<'QB' | 'RB' | 'WR', number> = { QB: 0, RB: 0, WR: 0 };
  const slotIndices = new Set<number>();
  const playerIds = new Set<string>();

  for (const slot of slots) {
    if (!['QB', 'RB', 'WR'].includes(slot.position)) {
      return { ok: false, error: 'Lineup contains an invalid position' };
    }

    if (slotIndices.has(slot.slotIndex)) {
      return { ok: false, error: 'Lineup contains duplicate slot indexes' };
    }
    slotIndices.add(slot.slotIndex);

    positionCounts[slot.position] += 1;

    if (slot.playerId !== null && typeof slot.playerId !== 'string') {
      return { ok: false, error: 'Lineup contains an invalid player reference' };
    }

    if (slot.playerId) {
      if (playerIds.has(slot.playerId)) {
        return { ok: false, error: 'Lineup cannot include duplicate players' };
      }
      playerIds.add(slot.playerId);
    }
  }

  if (
    positionCounts.QB !== LINEUP_REQUIREMENTS.QB ||
    positionCounts.RB !== LINEUP_REQUIREMENTS.RB ||
    positionCounts.WR !== LINEUP_REQUIREMENTS.WR
  ) {
    return { ok: false, error: 'Lineup must include exactly 2 QB, 2 RB, and 2 WR' };
  }

  return { ok: true };
}

export function toUsageMap(slotsByWeek: Array<{ slots: LineupSlotInput[] }>): Map<string, number> {
  const usage = new Map<string, number>();
  for (const row of slotsByWeek) {
    for (const slot of row.slots) {
      if (!slot.playerId) continue;
      usage.set(slot.playerId, (usage.get(slot.playerId) ?? 0) + 1);
    }
  }
  return usage;
}
