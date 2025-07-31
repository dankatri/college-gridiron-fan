export interface Player {
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR';
  team: string;
  projectedPoints: number;
}

export interface LineupSlot {
  position: 'QB' | 'RB' | 'WR';
  player?: Player;
  slotIndex: number;
}

export interface WeeklyLineup {
  week: number;
  lineup: LineupSlot[];
  totalPoints: number;
  isLocked: boolean;
}

export interface PlayerUsage {
  playerId: string;
  timesUsed: number;
}

export interface ScoringRules {
  rushingYards: number; // per 10 yards
  receivingYards: number; // per 10 yards
  passingYards: number; // per 25 yards
  rushingTD: number;
  receivingTD: number;
  passingTD: number;
  interception: number;
  completion: number;
  incompletion: number;
  returnYards: number; // per 10 yards
}

export const SCORING_RULES: ScoringRules = {
  rushingYards: 1,
  receivingYards: 1,
  passingYards: 1,
  rushingTD: 6,
  receivingTD: 6,
  passingTD: 4,
  interception: -2,
  completion: 0.3,
  incompletion: -0.3,
  returnYards: 1,
};

export const LINEUP_REQUIREMENTS = {
  QB: 2,
  RB: 2,
  WR: 2,
};

export const MAX_PLAYER_USES = 3;
export const TOTAL_WEEKS = 15;