export interface Player {
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR';
  team: string;
  conference: string;
  projectedPoints: number;
  // Bye week information
  hasByeWeek?: boolean;
  byeWeek?: number;
  // Media assets
  headshotUrl?: string;
  teamLogoUrl?: string;
  teamColorPrimary?: string;
  teamColorSecondary?: string;
  // Season stats that affect scoring
  passingYards?: number;
  passingTDs?: number;
  completions?: number;
  attempts?: number;
  interceptions?: number;
  rushingYards?: number;
  rushingTDs?: number;
  receivingYards?: number;
  receptions?: number;
  receivingTDs?: number;
  returnYards?: number;
}

export interface PlayerStats {
  playerId: string;
  week: number;
  // Passing stats
  passingYards: number;
  passingTDs: number;
  completions: number;
  attempts: number;
  interceptions: number;
  // Rushing stats
  rushingYards: number;
  rushingTDs: number;
  // Receiving stats
  receivingYards: number;
  receptions: number;
  receivingTDs: number;
  // Return stats
  kickReturnYards: number;
  puntReturnYards: number;
  // Calculated
  fantasyPoints: number;
  lastUpdated: Date;
}

export interface GameStatus {
  week: number;
  team1: string;
  team2: string;
  status: 'scheduled' | 'in-progress' | 'final';
  quarter?: number;
  timeRemaining?: string;
  team1Score: number;
  team2Score: number;
  lastUpdated: Date;
}

export interface TeamSchedule {
  teamId: string;
  teamName: string;
  conference: string;
  weeklyGames: WeeklyGame[];
  byeWeeks: number[];
}

export interface WeeklyGame {
  week: number;
  opponent?: string;
  isHomeGame: boolean;
  gameDate?: Date;
  gameTime?: string;
  isByeWeek: boolean;
  gameId?: string;
}

export interface LiveUpdate {
  id: string;
  playerId: string;
  week: number;
  statType: string;
  statValue: number;
  description: string;
  timestamp: Date;
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
  actualPoints?: number; // Points from live stats
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
export const TOTAL_WEEKS = 18; // Weeks 1-13 (regular season), 14 (rivalry + CCG), 15-18 (CFP rounds)

// League and Competition Types
export interface League {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  ownerName: string;
  joinCode?: string;
  memberCount?: number;
  members: LeagueMember[];
  settings: LeagueSettings;
  createdAt: Date;
  season: number;
}

export interface LeagueMember {
  userId: string;
  username: string;
  avatarUrl?: string;
  role?: 'owner' | 'member';
  joinedAt: Date;
  isActive: boolean;
  totalPoints: number;
  weeklyPoints: { [week: number]: number };
  rank: number;
}

export interface LeagueSettings {
  maxMembers: number;
  isPublic: boolean;
  allowLateJoins: boolean;
  scoringMultiplier: number;
}

export interface LeagueInvite {
  id: string;
  leagueId: string;
  leagueName: string;
  invitedBy: string;
  invitedByName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  expiresAt: Date;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  totalPoints: number;
  weeklyAverage: number;
  bestWeek: number;
  worstWeek: number;
  weeksPlayed: number;
  pointsThisWeek?: number;
  trend: 'up' | 'down' | 'same';
  trendChange: number;
}

export interface WeeklyMatchup {
  week: number;
  user1: {
    userId: string;
    username: string;
    lineup: LineupSlot[];
    points: number;
  };
  user2: {
    userId: string;
    username: string;
    lineup: LineupSlot[];
    points: number;
  };
  winner?: string;
}
