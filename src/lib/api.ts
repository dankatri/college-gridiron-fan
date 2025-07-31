import { Player } from './types';

// College Football Data API configuration
const API_BASE_URL = 'https://api.collegefootballdata.com';

// You'll need to provide your API key
let API_KEY = '';

export const setApiKey = (key: string) => {
  API_KEY = key;
};

// API request helper
const apiRequest = async (endpoint: string): Promise<any> => {
  if (!API_KEY) {
    console.log('No API key provided, will fall back to sample data');
    throw new Error('API key not provided. Please call setApiKey() first.');
  }

  console.log(`Making API request to: ${API_BASE_URL}${endpoint}`);
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`API request failed: ${response.status} ${response.statusText}`);
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

// Interface for raw API responses
interface ApiPlayer {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string; // Some endpoints return full name
  team: string;
  position: string;
  jersey?: number;
  weight?: number;
  height?: number;
  year?: number;
  home_city?: string;
  home_state?: string;
}

interface ApiTeam {
  id: number;
  school: string;
  mascot: string;
  abbreviation: string;
  alt_name1?: string;
  alt_name2?: string;
  alt_name3?: string;
  conference: string;
  division?: string;
  color: string;
  alt_color: string;
  logos: string[];
}

interface ApiPlayerStats {
  playerId: string;
  season: number;
  team: string;
  conference: string;
  category: string;
  statType: string;
  stat: number;
}

// Cache for team info
let teamsCache: ApiTeam[] = [];

// Fetch teams and conferences
export const fetchTeams = async (): Promise<ApiTeam[]> => {
  if (teamsCache.length > 0) {
    return teamsCache;
  }
  
  try {
    teamsCache = await apiRequest('/teams');
    return teamsCache;
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    return [];
  }
};

// Get conference for a team
const getTeamConference = async (teamName: string): Promise<string> => {
  const teams = await fetchTeams();
  const team = teams.find(t => 
    t.school.toLowerCase() === teamName.toLowerCase() ||
    t.alt_name1?.toLowerCase() === teamName.toLowerCase() ||
    t.alt_name2?.toLowerCase() === teamName.toLowerCase()
  );
  return team?.conference || 'Unknown';
};

// Fetch current roster for a team
export const fetchTeamRoster = async (teamName: string, year: number = 2025): Promise<ApiPlayer[]> => {
  try {
    const players = await apiRequest(`/roster?team=${encodeURIComponent(teamName)}&year=${year}`);
    return players || [];
  } catch (error) {
    console.error(`Failed to fetch roster for ${teamName}:`, error);
    return [];
  }
};

// Fetch player stats
export const fetchPlayerStats = async (year: number = 2024): Promise<ApiPlayerStats[]> => {
  try {
    const stats = await apiRequest(`/stats/player/season?year=${year}`);
    return stats || [];
  } catch (error) {
    console.error('Failed to fetch player stats:', error);
    return [];
  }
};

// Calculate projected points based on stats
const calculateProjectedPoints = (stats: any, position: string): number => {
  let points = 0;

  if (position === 'QB') {
    // Passing stats
    const passingYards = stats.passingYards || 0;
    const passingTDs = stats.passingTDs || 0;
    const interceptions = stats.interceptions || 0;
    const completions = stats.completions || 0;
    const attempts = stats.attempts || 0;
    const incompletions = attempts - completions;
    
    // Rushing stats for QBs
    const rushingYards = stats.rushingYards || 0;
    const rushingTDs = stats.rushingTDs || 0;

    points += Math.floor(passingYards / 25) * 1; // 25 passing yards = 1 point
    points += passingTDs * 4; // Passing TD = 4 points
    points += interceptions * -2; // Interception = -2 points
    points += completions * 0.3; // Completion = 0.3 points
    points += incompletions * -0.3; // Incompletion = -0.3 points
    points += Math.floor(rushingYards / 10) * 1; // 10 rush yards = 1 point
    points += rushingTDs * 6; // Rushing TD = 6 points
  } else if (position === 'RB') {
    const rushingYards = stats.rushingYards || 0;
    const rushingTDs = stats.rushingTDs || 0;
    const receivingYards = stats.receivingYards || 0;
    const receivingTDs = stats.receivingTDs || 0;
    const returnYards = stats.returnYards || 0;

    points += Math.floor(rushingYards / 10) * 1; // 10 rush yards = 1 point
    points += rushingTDs * 6; // Rushing TD = 6 points
    points += Math.floor(receivingYards / 10) * 1; // 10 receiving yards = 1 point
    points += receivingTDs * 6; // Receiving TD = 6 points
    points += Math.floor(returnYards / 10) * 1; // 10 return yards = 1 point
  } else if (position === 'WR') {
    const receivingYards = stats.receivingYards || 0;
    const receivingTDs = stats.receivingTDs || 0;
    const rushingYards = stats.rushingYards || 0;
    const rushingTDs = stats.rushingTDs || 0;
    const returnYards = stats.returnYards || 0;

    points += Math.floor(receivingYards / 10) * 1; // 10 receiving yards = 1 point
    points += receivingTDs * 6; // Receiving TD = 6 points
    points += Math.floor(rushingYards / 10) * 1; // 10 rush yards = 1 point
    points += rushingTDs * 6; // Rushing TD = 6 points
    points += Math.floor(returnYards / 10) * 1; // 10 return yards = 1 point
  }

  return Math.max(0, points); // Ensure non-negative
};

// Convert API data to our Player format
const convertApiPlayerToPlayer = async (apiPlayer: ApiPlayer, stats: any): Promise<Player> => {
  const conference = await getTeamConference(apiPlayer.team);
  
  // Handle different name field possibilities
  let fullName = '';
  
  if (apiPlayer.name) {
    // Some endpoints return full name
    fullName = apiPlayer.name.trim();
  } else if (apiPlayer.first_name || apiPlayer.last_name) {
    // Other endpoints return separate first/last names
    const firstName = apiPlayer.first_name || '';
    const lastName = apiPlayer.last_name || '';
    fullName = `${firstName} ${lastName}`.trim();
  }
  
  // Fallback if no name is available
  if (!fullName) {
    fullName = `Player ${apiPlayer.id}`;
    console.warn('No name available for player:', apiPlayer);
  }
  
  return {
    id: `${apiPlayer.position.toLowerCase()}_${apiPlayer.id}`,
    name: fullName,
    position: apiPlayer.position as 'QB' | 'RB' | 'WR',
    team: apiPlayer.team,
    conference,
    projectedPoints: calculateProjectedPoints(stats, apiPlayer.position),
    // QB stats
    passingYards: stats.passingYards || 0,
    passingTDs: stats.passingTDs || 0,
    completions: stats.completions || 0,
    attempts: stats.attempts || 0,
    interceptions: stats.interceptions || 0,
    // RB/WR stats
    rushingYards: stats.rushingYards || 0,
    rushingTDs: stats.rushingTDs || 0,
    receivingYards: stats.receivingYards || 0,
    receptions: stats.receptions || 0,
    receivingTDs: stats.receivingTDs || 0,
    returnYards: stats.returnYards || 0,
  };
};

// Main function to fetch all current players
export const fetchCurrentPlayers = async (): Promise<Player[]> => {
  try {
    // Get current year (2025) rosters from major programs
    const majorPrograms = [
      // SEC
      'Alabama', 'Auburn', 'Florida', 'Georgia', 'LSU', 'Tennessee', 'Texas A&M', 
      'South Carolina', 'Kentucky', 'Arkansas', 'Missouri', 'Mississippi State', 
      'Ole Miss', 'Vanderbilt', 'Texas', 'Oklahoma',
      
      // Big Ten
      'Michigan', 'Ohio State', 'Penn State', 'Michigan State', 'Iowa', 'Wisconsin', 
      'Illinois', 'Indiana', 'Maryland', 'Minnesota', 'Nebraska', 'Northwestern', 
      'Purdue', 'Rutgers', 'Oregon', 'Washington', 'UCLA', 'USC',
      
      // Big 12
      'Baylor', 'Cincinnati', 'Houston', 'Iowa State', 'Kansas', 'Kansas State', 
      'Oklahoma State', 'TCU', 'Texas Tech', 'UCF', 'West Virginia', 'BYU',
      'Arizona', 'Arizona State', 'Colorado', 'Utah',
      
      // ACC
      'Clemson', 'Florida State', 'Miami', 'North Carolina', 'NC State', 'Virginia', 
      'Virginia Tech', 'Wake Forest', 'Boston College', 'Syracuse', 'Pittsburgh', 
      'Louisville', 'Georgia Tech', 'Duke', 'SMU', 'California', 'Stanford',
      
      // Other major programs
      'Notre Dame', 'Navy', 'Army'
    ];

    // Fetch 2024 stats to project 2025 performance (most recent complete season)
    const statsData = await fetchPlayerStats(2024);
    
    // Group stats by player
    const playerStatsMap = new Map<string, any>();
    statsData.forEach(stat => {
      const key = `${stat.playerId}_${stat.team}`;
      if (!playerStatsMap.has(key)) {
        playerStatsMap.set(key, {
          playerId: stat.playerId,
          team: stat.team,
          conference: stat.conference,
        });
      }
      
      const playerStats = playerStatsMap.get(key)!;
      
      // Map stat types to our format
      switch (stat.statType) {
        case 'YDS':
          if (stat.category === 'passing') playerStats.passingYards = stat.stat;
          else if (stat.category === 'rushing') playerStats.rushingYards = stat.stat;
          else if (stat.category === 'receiving') playerStats.receivingYards = stat.stat;
          break;
        case 'TD':
          if (stat.category === 'passing') playerStats.passingTDs = stat.stat;
          else if (stat.category === 'rushing') playerStats.rushingTDs = stat.stat;
          else if (stat.category === 'receiving') playerStats.receivingTDs = stat.stat;
          break;
        case 'INT':
          if (stat.category === 'passing') playerStats.interceptions = stat.stat;
          break;
        case 'C/ATT':
          if (stat.category === 'passing') {
            // Parse completions/attempts format like "250/400"
            const parts = stat.stat.toString().split('/');
            if (parts.length === 2) {
              playerStats.completions = parseInt(parts[0]) || 0;
              playerStats.attempts = parseInt(parts[1]) || 0;
            }
          }
          break;
        case 'REC':
          if (stat.category === 'receiving') playerStats.receptions = stat.stat;
          break;
      }
    });

    // Fetch current rosters
    const allPlayers: Player[] = [];
    
    for (const team of majorPrograms) {
      try {
        const roster = await fetchTeamRoster(team, 2025);
        
        // Filter for QB, RB, WR positions only
        const relevantPlayers = roster.filter(player => 
          ['QB', 'RB', 'WR'].includes(player.position)
        );
        
        for (const apiPlayer of relevantPlayers) {
          // Look for their 2024 stats
          const statsKey = `${apiPlayer.id}_${team}`;
          const stats = playerStatsMap.get(statsKey) || {};
          
          try {
            const player = await convertApiPlayerToPlayer(apiPlayer, stats);
            
            // Validate that player has a proper name
            if (!player.name || player.name.includes('undefined') || player.name.trim() === '') {
              console.warn('Skipping player with invalid name:', player);
              continue;
            }
            
            // Only include players with some statistical production or high potential
            if (player.projectedPoints > 2 || !stats.passingYards) {
              allPlayers.push(player);
            }
          } catch (error) {
            console.warn(`Failed to convert player ${apiPlayer.first_name} ${apiPlayer.last_name}:`, error);
          }
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`Failed to fetch roster for ${team}:`, error);
      }
    }

    // Validate that we got valid players
    if (allPlayers.length === 0 || allPlayers.every(p => !p.name || p.name.includes('undefined'))) {
      console.warn('API returned no valid players or all players have invalid names, falling back to sample data');
      throw new Error('API returned invalid player data');
    }

    // Sort by projected points and return top performers by position
    const sortedPlayers = allPlayers.sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    // Get top players by position to ensure good distribution
    const qbs = sortedPlayers.filter(p => p.position === 'QB').slice(0, 50);
    const rbs = sortedPlayers.filter(p => p.position === 'RB').slice(0, 60);
    const wrs = sortedPlayers.filter(p => p.position === 'WR').slice(0, 80);
    
    return [...qbs, ...rbs, ...wrs];
    
  } catch (error) {
    console.error('Error fetching current players:', error);
    throw error;
  }
};

// Get unique conferences from current players
export const getCurrentConferences = async (): Promise<string[]> => {
  const teams = await fetchTeams();
  const conferences = Array.from(new Set(teams.map(team => team.conference)))
    .filter(conf => conf && conf !== 'Unknown')
    .sort();
  
  return ['All Conferences', ...conferences];
};

// Get unique teams from current players
export const getCurrentTeams = async (): Promise<string[]> => {
  const teams = await fetchTeams();
  const teamNames = teams.map(team => team.school).sort();
  
  return ['All Teams', ...teamNames];
};