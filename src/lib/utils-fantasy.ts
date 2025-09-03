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

// Week locking functionality
export function isWeekLocked(week: number): boolean {
  // Week 1 started on August 24, 2024 and is now over (past weeks are locked)
  // Generally, each week begins on Saturday
  const currentDate = new Date();
  
  // College football season dates for 2024-2025
  const weekStartDates = {
    1: new Date('2024-08-24'), // Week 1 start
    2: new Date('2024-08-31'), // Week 2 start  
    3: new Date('2024-09-07'), // Week 3 start
    4: new Date('2024-09-14'), // Week 4 start
    5: new Date('2024-09-21'), // Week 5 start
    6: new Date('2024-09-28'), // Week 6 start
    7: new Date('2024-10-05'), // Week 7 start
    8: new Date('2024-10-12'), // Week 8 start
    9: new Date('2024-10-19'), // Week 9 start
    10: new Date('2024-10-26'), // Week 10 start
    11: new Date('2024-11-02'), // Week 11 start
    12: new Date('2024-11-09'), // Week 12 start
    13: new Date('2024-11-16'), // Week 13 start
    14: new Date('2024-11-23'), // Week 14 start (Thanksgiving week)
    15: new Date('2024-11-30'), // Week 15 start (Conference championships)
  };
  
  const weekStart = weekStartDates[week as keyof typeof weekStartDates];
  if (!weekStart) {
    return true; // Lock unknown weeks
  }
  
  // Lock the week once it starts (on Saturday)
  return currentDate >= weekStart;
}

export function getCurrentWeek(): number {
  const currentDate = new Date();
  
  // If we're before the season starts, return week 1
  if (currentDate < new Date('2024-08-24')) {
    return 1;
  }
  
  // Calculate which week we're currently in
  const seasonStart = new Date('2024-08-24');
  const daysSinceStart = Math.floor((currentDate.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  const weeksSinceStart = Math.floor(daysSinceStart / 7) + 1;
  
  // Cap at week 15 (end of regular season + conference championships)
  return Math.min(weeksSinceStart, 15);
}

export function getWeekStatus(week: number): 'upcoming' | 'current' | 'locked' {
  const currentWeek = getCurrentWeek();
  
  if (week < currentWeek) {
    return 'locked';
  } else if (week === currentWeek) {
    return isWeekLocked(week) ? 'locked' : 'current';
  } else {
    return 'upcoming';
  }
}