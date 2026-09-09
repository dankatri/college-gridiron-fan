import { League, LeagueMember, LeaderboardEntry, WeeklyLineup, WeeklyMatchup } from './types';
import { countWinningWeeks } from './leaderboard-wins';

/**
 * Generate a unique league ID
 */
export function generateLeagueId(): string {
  return `league_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique invite ID
 */
export function generateInviteId(): string {
  return `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate leaderboard entries from league members and their lineups
 */
export function calculateLeaderboard(
  members: LeagueMember[],
  allLineups: { [userId: string]: WeeklyLineup[] },
  currentWeek: number
): LeaderboardEntry[] {
  const winningWeeks = countWinningWeeks(members.map(member => ({
    userId: member.userId,
    weeklyPoints: Object.fromEntries((allLineups[member.userId] ?? [])
      .flatMap(lineup => typeof lineup.actualPoints === 'number' ? [[lineup.week, lineup.actualPoints] as const] : [])),
  })));
  const entries: LeaderboardEntry[] = members.map((member, index) => {
    const userLineups = allLineups[member.userId] || [];
    const weeklyPoints = userLineups.map(lineup => lineup.actualPoints || lineup.totalPoints);
    
    const totalPoints = weeklyPoints.reduce((sum, points) => sum + points, 0);
    const weeksPlayed = weeklyPoints.length;
    const weeklyAverage = weeksPlayed > 0 ? totalPoints / weeksPlayed : 0;
    const bestWeek = weeklyPoints.length > 0 ? Math.max(...weeklyPoints) : 0;
    const worstWeek = weeklyPoints.length > 0 ? Math.min(...weeklyPoints) : 0;

    // Calculate trend (comparing last 2 weeks)
    let trend: 'up' | 'down' | 'same' = 'same';
    let trendChange = 0;
    
    if (weeklyPoints.length >= 2) {
      const lastWeek = weeklyPoints[weeklyPoints.length - 1];
      const previousWeek = weeklyPoints[weeklyPoints.length - 2];
      trendChange = lastWeek - previousWeek;
      
      if (trendChange > 0) trend = 'up';
      else if (trendChange < 0) trend = 'down';
    }

    // Get current week points
    const currentWeekLineup = userLineups.find(lineup => lineup.week === currentWeek);
    const pointsThisWeek = currentWeekLineup ? 
      (currentWeekLineup.actualPoints ?? currentWeekLineup.totalPoints) : undefined;

    return {
      rank: 0, // Will be set after sorting
      userId: member.userId,
      username: member.username,
      avatarUrl: member.avatarUrl,
      totalPoints,
      winningWeeks: winningWeeks.get(member.userId) ?? 0,
      weeklyAverage,
      bestWeek,
      worstWeek,
      weeksPlayed,
      pointsThisWeek,
      trend,
      trendChange
    };
  });

  // Sort by total points (descending) and assign ranks
  entries.sort((a, b) => b.totalPoints - a.totalPoints);
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

/**
 * Update league member points from their lineups
 */
export function updateLeagueMemberPoints(
  member: LeagueMember,
  userLineups: WeeklyLineup[]
): LeagueMember {
  const weeklyPoints: { [week: number]: number } = {};
  let totalPoints = 0;

  userLineups.forEach(lineup => {
    const points = lineup.actualPoints ?? lineup.totalPoints;
    weeklyPoints[lineup.week] = points;
    totalPoints += points;
  });

  return {
    ...member,
    totalPoints,
    weeklyPoints
  };
}

/**
 * Generate weekly matchups for league members
 */
export function generateWeeklyMatchups(
  members: LeagueMember[],
  week: number,
  allLineups: { [userId: string]: WeeklyLineup[] }
): WeeklyMatchup[] {
  const matchups: WeeklyMatchup[] = [];
  const availableMembers = [...members];

  // Simple pairing - in real app, you'd want more sophisticated scheduling
  while (availableMembers.length >= 2) {
    const user1Data = availableMembers.shift()!;
    const user2Data = availableMembers.shift()!;

    const user1Lineup = allLineups[user1Data.userId]?.find(l => l.week === week);
    const user2Lineup = allLineups[user2Data.userId]?.find(l => l.week === week);

    const user1Points = user1Lineup ? (user1Lineup.actualPoints ?? user1Lineup.totalPoints) : 0;
    const user2Points = user2Lineup ? (user2Lineup.actualPoints ?? user2Lineup.totalPoints) : 0;

    let winner: string | undefined;
    if (user1Points > user2Points) winner = user1Data.userId;
    else if (user2Points > user1Points) winner = user2Data.userId;

    matchups.push({
      week,
      user1: {
        userId: user1Data.userId,
        username: user1Data.username,
        lineup: user1Lineup?.lineup || [],
        points: user1Points
      },
      user2: {
        userId: user2Data.userId,
        username: user2Data.username,
        lineup: user2Lineup?.lineup || [],
        points: user2Points
      },
      winner
    });
  }

  return matchups;
}

/**
 * Check if a user can join a league
 */
export function canJoinLeague(league: League, userId: string): { canJoin: boolean; reason?: string } {
  if (league.members.some(m => m.userId === userId)) {
    return { canJoin: false, reason: 'Already a member of this league' };
  }

  if (league.members.length >= league.settings.maxMembers) {
    return { canJoin: false, reason: 'League is full' };
  }

  if (!league.settings.allowLateJoins) {
    // In a real app, you'd check if the season has started
    // For now, we'll allow joins
  }

  return { canJoin: true };
}

/**
 * Generate league join code
 */
export function generateLeagueJoinCode(): string {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

/**
 * Calculate league statistics
 */
export function calculateLeagueStats(
  members: LeagueMember[],
  allLineups: { [userId: string]: WeeklyLineup[] }
) {
  const allScores: number[] = [];
  let totalWeeksPlayed = 0;

  members.forEach(member => {
    const userLineups = allLineups[member.userId] || [];
    userLineups.forEach(lineup => {
      const points = lineup.actualPoints ?? lineup.totalPoints;
      allScores.push(points);
      totalWeeksPlayed++;
    });
  });

  if (allScores.length === 0) {
    return {
      averageScore: 0,
      highScore: 0,
      lowScore: 0,
      totalMembers: members.length,
      activeMembers: members.filter(m => m.isActive).length,
      totalWeeksPlayed: 0
    };
  }

  return {
    averageScore: allScores.reduce((sum, score) => sum + score, 0) / allScores.length,
    highScore: Math.max(...allScores),
    lowScore: Math.min(...allScores),
    totalMembers: members.length,
    activeMembers: members.filter(m => m.isActive).length,
    totalWeeksPlayed
  };
}