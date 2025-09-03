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
  const currentDate = new Date();
  
  // College football season dates for 2025 based on provided schedule
  const weekStartDates = {
    1: new Date('2025-08-30'), // Week 1 start (estimated late August)
    2: new Date('2025-09-02'), // Week 2: 2 Sep - 7
    3: new Date('2025-09-08'), // Week 3: 8 Sep - 14
    4: new Date('2025-09-15'), // Week 4: 15 Sep - 21
    5: new Date('2025-09-22'), // Week 5: 22 Sep - 28
    6: new Date('2025-09-29'), // Week 6: 29 Sep - 5 Oct
    7: new Date('2025-10-06'), // Week 7: 6 Oct - 12
    8: new Date('2025-10-13'), // Week 8: 13 Oct - 19
    9: new Date('2025-10-20'), // Week 9: 20 Oct - 26
    10: new Date('2025-10-27'), // Week 10: 27 Oct - 2 Nov
    11: new Date('2025-11-03'), // Week 11: 3 Nov - 9
    12: new Date('2025-11-10'), // Week 12: 10 Nov - 16
    13: new Date('2025-11-17'), // Week 13: 17 Nov - 23
    14: new Date('2025-11-24'), // Week 14: 24 Nov - 30
    15: new Date('2025-12-01'), // Week 15: 1 Dec - 7
    16: new Date('2025-12-08'), // Week 16: 8 Dec - 13 Dec
    17: new Date('2025-12-13'), // Bowls: 13 Dec - 20 Jan
    18: new Date('2025-12-19'), // CFP: 19 Dec - 19 Jan
  };
  
  const weekStart = weekStartDates[week as keyof typeof weekStartDates];
  if (!weekStart) {
    return true; // Lock unknown weeks
  }
  
  // Lock the week once it starts
  return currentDate >= weekStart;
}

export function getCurrentWeek(): number {
  const currentDate = new Date();
  
  // If we're before the 2025 season starts, return week 1
  if (currentDate < new Date('2025-08-30')) {
    return 1;
  }
  
  // Week start dates for 2025 season
  const weekStartDates = [
    new Date('2025-08-30'), // Week 1
    new Date('2025-09-02'), // Week 2
    new Date('2025-09-08'), // Week 3
    new Date('2025-09-15'), // Week 4
    new Date('2025-09-22'), // Week 5
    new Date('2025-09-29'), // Week 6
    new Date('2025-10-06'), // Week 7
    new Date('2025-10-13'), // Week 8
    new Date('2025-10-20'), // Week 9
    new Date('2025-10-27'), // Week 10
    new Date('2025-11-03'), // Week 11
    new Date('2025-11-10'), // Week 12
    new Date('2025-11-17'), // Week 13
    new Date('2025-11-24'), // Week 14
    new Date('2025-12-01'), // Week 15
    new Date('2025-12-08'), // Week 16
    new Date('2025-12-13'), // Bowls
    new Date('2025-12-19'), // CFP
  ];
  
  // Find the current week based on the date
  for (let i = weekStartDates.length - 1; i >= 0; i--) {
    if (currentDate >= weekStartDates[i]) {
      return i + 1;
    }
  }
  
  return 1; // Default to week 1
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