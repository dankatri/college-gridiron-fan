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
  return lineup.some(slot => slot.player?.id === playerId);
}

export function removePlayerFromLineup(playerId: string, lineup: LineupSlot[]): LineupSlot[] {
  return lineup.map(slot =>
    slot.player?.id === playerId
      ? { ...slot, player: undefined }
      : slot
  );
}

export function addPlayerToLineup(player: Player, slotIndex: number, lineup: LineupSlot[]): LineupSlot[] {
  return lineup.map(slot =>
    slot.slotIndex === slotIndex
      ? { ...slot, player }
      : slot
  );
}