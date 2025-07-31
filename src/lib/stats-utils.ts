import { PlayerStats, Player, SCORING_RULES, GameStatus, LiveUpdate } from './types';

/**
 * Calculate fantasy points from player stats using the scoring rules
 */
export function calculateFantasyPoints(stats: PlayerStats): number {
  let points = 0;
  
  // Passing yards (25 yards = 1 point)
  points += Math.floor(stats.passingYards / 25) * SCORING_RULES.passingYards;
  
  // Rushing yards (10 yards = 1 point)
  points += Math.floor(stats.rushingYards / 10) * SCORING_RULES.rushingYards;
  
  // Receiving yards (10 yards = 1 point)
  points += Math.floor(stats.receivingYards / 10) * SCORING_RULES.receivingYards;
  
  // Return yards (10 yards = 1 point)
  const totalReturnYards = stats.kickReturnYards + stats.puntReturnYards;
  points += Math.floor(totalReturnYards / 10) * SCORING_RULES.returnYards;
  
  // Touchdowns
  points += stats.passingTDs * SCORING_RULES.passingTD;
  points += stats.rushingTDs * SCORING_RULES.rushingTD;
  points += stats.receivingTDs * SCORING_RULES.receivingTD;
  
  // Completions and incompletions
  points += stats.completions * SCORING_RULES.completion;
  const incompletions = stats.attempts - stats.completions;
  points += incompletions * SCORING_RULES.incompletion;
  
  // Interceptions (negative points)
  points += stats.interceptions * SCORING_RULES.interception;
  
  return Math.round(points * 10) / 10; // Round to 1 decimal place
}

/**
 * Create empty stats for a player
 */
export function createEmptyStats(playerId: string, week: number): PlayerStats {
  return {
    playerId,
    week,
    passingYards: 0,
    passingTDs: 0,
    completions: 0,
    attempts: 0,
    interceptions: 0,
    rushingYards: 0,
    rushingTDs: 0,
    receivingYards: 0,
    receptions: 0,
    receivingTDs: 0,
    kickReturnYards: 0,
    puntReturnYards: 0,
    fantasyPoints: 0,
    lastUpdated: new Date(),
  };
}

/**
 * Update player stats with new data
 */
export function updatePlayerStats(
  currentStats: PlayerStats,
  updates: Partial<Omit<PlayerStats, 'playerId' | 'week' | 'fantasyPoints' | 'lastUpdated'>>
): PlayerStats {
  const updatedStats = {
    ...currentStats,
    ...updates,
    lastUpdated: new Date(),
  };
  
  updatedStats.fantasyPoints = calculateFantasyPoints(updatedStats);
  return updatedStats;
}

/**
 * Generate simulated live stats for demo purposes
 */
export function generateLiveStats(players: Player[], week: number): PlayerStats[] {
  return players.map(player => {
    const stats = createEmptyStats(player.id, week);
    
    // Generate random but realistic stats based on position
    if (player.position === 'QB') {
      stats.passingYards = Math.floor(Math.random() * 300) + 150;
      stats.passingTDs = Math.floor(Math.random() * 4) + 1;
      stats.completions = Math.floor(Math.random() * 25) + 15;
      stats.attempts = stats.completions + Math.floor(Math.random() * 15) + 5;
      stats.interceptions = Math.random() < 0.3 ? Math.floor(Math.random() * 2) + 1 : 0;
      stats.rushingYards = Math.floor(Math.random() * 60);
      stats.rushingTDs = Math.random() < 0.2 ? 1 : 0;
    } else if (player.position === 'RB') {
      stats.rushingYards = Math.floor(Math.random() * 120) + 40;
      stats.rushingTDs = Math.floor(Math.random() * 3);
      stats.receivingYards = Math.floor(Math.random() * 60) + 10;
      stats.receptions = Math.floor(Math.random() * 6) + 2;
      stats.receivingTDs = Math.random() < 0.3 ? 1 : 0;
      stats.kickReturnYards = Math.random() < 0.3 ? Math.floor(Math.random() * 100) + 20 : 0;
    } else if (player.position === 'WR') {
      stats.receivingYards = Math.floor(Math.random() * 120) + 30;
      stats.receptions = Math.floor(Math.random() * 8) + 3;
      stats.receivingTDs = Math.floor(Math.random() * 2);
      stats.rushingYards = Math.random() < 0.2 ? Math.floor(Math.random() * 30) : 0;
      stats.rushingTDs = Math.random() < 0.1 ? 1 : 0;
      stats.puntReturnYards = Math.random() < 0.4 ? Math.floor(Math.random() * 80) + 10 : 0;
    }
    
    stats.fantasyPoints = calculateFantasyPoints(stats);
    return stats;
  });
}

/**
 * Generate sample game statuses
 */
export function generateGameStatuses(week: number): GameStatus[] {
  const games: GameStatus[] = [
    {
      week,
      team1: 'USC',
      team2: 'Oregon',
      status: 'in-progress',
      quarter: 3,
      timeRemaining: '8:42',
      team1Score: 21,
      team2Score: 17,
      lastUpdated: new Date(),
    },
    {
      week,
      team1: 'Michigan',
      team2: 'Ohio State',
      status: 'final',
      team1Score: 28,
      team2Score: 24,
      lastUpdated: new Date(),
    },
    {
      week,
      team1: 'Texas',
      team2: 'Georgia',
      status: 'in-progress',
      quarter: 2,
      timeRemaining: '3:15',
      team1Score: 14,
      team2Score: 10,
      lastUpdated: new Date(),
    },
    {
      week,
      team1: 'Alabama',
      team2: 'LSU',
      status: 'scheduled',
      team1Score: 0,
      team2Score: 0,
      lastUpdated: new Date(),
    },
  ];
  
  return games;
}

/**
 * Create a live update event
 */
export function createLiveUpdate(
  playerId: string,
  week: number,
  statType: string,
  statValue: number,
  playerName: string,
  description?: string
): LiveUpdate {
  return {
    id: `${playerId}-${Date.now()}`,
    playerId,
    week,
    statType,
    statValue,
    description: description || `${playerName} - ${statType}: ${statValue}`,
    timestamp: new Date(),
  };
}