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
    console.log(`Fetched roster for ${teamName}:`, players?.slice(0, 3)); // Debug first 3 players
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
  
  // Handle different name field possibilities with better validation
  let fullName = '';
  
  // Try different name field combinations
  if (apiPlayer.name && typeof apiPlayer.name === 'string' && apiPlayer.name.trim()) {
    fullName = apiPlayer.name.trim();
  } else if (apiPlayer.first_name || apiPlayer.last_name) {
    const firstName = (apiPlayer.first_name || '').toString().trim();
    const lastName = (apiPlayer.last_name || '').toString().trim();
    fullName = `${firstName} ${lastName}`.trim();
  }
  
  // Clean up any "undefined" strings that might have slipped through
  fullName = fullName.replace(/undefined/g, '').replace(/\s+/g, ' ').trim();
  
  // Fallback if no valid name is available
  if (!fullName || fullName === '' || fullName === 'undefined undefined') {
    // Log the full player object to help debug
    console.warn('No valid name available for player. Raw data:', JSON.stringify(apiPlayer, null, 2));
    fullName = `Player ${apiPlayer.id}`;
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
export const fetchCurrentPlayers = async (options?: {
  specificTeam?: string;
  specificConference?: string;
  maxPlayersPerPosition?: { QB: number; RB: number; WR: number };
}): Promise<Player[]> => {
  try {
    // Set up player limits based on filtering
    const defaultLimits = { QB: 30, RB: 30, WR: 40 }; // Conservative defaults for "All" view
    const expandedLimits = { QB: 100, RB: 150, WR: 200 }; // More players when filtering
    
    const limits = options?.maxPlayersPerPosition || 
      (options?.specificTeam || options?.specificConference ? expandedLimits : defaultLimits);

    console.log('Fetching players with limits:', limits);
    console.log('Filter options:', { 
      specificTeam: options?.specificTeam, 
      specificConference: options?.specificConference 
    });

    // Get teams to fetch from
    let teamsToFetch: string[] = [];
    
    if (options?.specificTeam && options.specificTeam !== 'All Teams') {
      // Fetch only specific team
      teamsToFetch = [options.specificTeam];
    } else if (options?.specificConference && options.specificConference !== 'All Conferences') {
      // Fetch all teams from specific conference
      const allTeams = await fetchTeams();
      teamsToFetch = allTeams
        .filter(team => team.conference === options.specificConference)
        .map(team => team.school)
        .slice(0, 20); // Limit to prevent too many API calls
    } else {
      // Default set of major programs for "All" view
      teamsToFetch = [
        // Major programs across all conferences
        'Alabama', 'Georgia', 'Tennessee', 'LSU', 'Auburn', 'Florida', 'Texas A&M', 'Arkansas', 'Kentucky', 'South Carolina', // SEC
        'Michigan', 'Ohio State', 'Penn State', 'Michigan State', 'Wisconsin', 'Iowa', 'Illinois', 'Maryland', 'Purdue', 'Indiana', // Big Ten
        'Texas', 'Oklahoma', 'Oklahoma State', 'Kansas State', 'Texas Tech', 'TCU', 'Baylor', 'West Virginia', 'Cincinnati', 'UCF', // Big 12
        'USC', 'Oregon', 'Washington', 'UCLA', 'Utah', 'Oregon State', 'Washington State', 'Colorado', 'Stanford', 'California', // Pac-12
        'Florida State', 'Clemson', 'Miami', 'North Carolina', 'NC State', 'Virginia Tech', 'Pittsburgh', 'Louisville', 'Wake Forest', 'Syracuse', // ACC
        'Notre Dame' // Independent
      ];
    }

    console.log(`Fetching rosters from ${teamsToFetch.length} teams`);

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
    
    for (const team of teamsToFetch) {
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
            
            // Validate that player has a proper name (not just "Player XXXX" fallback)
            if (!player.name || 
                player.name.includes('undefined') || 
                player.name.trim() === '' ||
                player.name.startsWith('Player ')) {
              console.warn('Skipping player with invalid/fallback name:', {
                id: apiPlayer.id,
                name: player.name,
                rawApiPlayer: apiPlayer
              });
              continue;
            }
            
            // Include more players when filtering, be more selective for "All" view
            const minPoints = (options?.specificTeam || options?.specificConference) ? 0 : 2;
            if (player.projectedPoints >= minPoints) {
              allPlayers.push(player);
            }
          } catch (error) {
            console.warn(`Failed to convert player ${apiPlayer.first_name || 'Unknown'} ${apiPlayer.last_name || 'Player'}:`, error);
          }
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.warn(`Failed to fetch roster for ${team}:`, error);
      }
    }

    // Validate that we got valid players with proper names
    const playersWithValidNames = allPlayers.filter(p => 
      p.name && 
      !p.name.includes('undefined') && 
      p.name.trim() !== '' && 
      !p.name.startsWith('Player ')
    );
    
    if (playersWithValidNames.length === 0) {
      console.warn('API returned no players with valid names, falling back to sample data');
      throw new Error('API returned no players with valid names');
    }
    
    if (playersWithValidNames.length < allPlayers.length) {
      console.warn(`Filtered out ${allPlayers.length - playersWithValidNames.length} players with invalid names`);
    }

    // Sort by projected points and return top performers by position
    const sortedPlayers = playersWithValidNames.sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    // Get players by position based on limits
    const qbs = sortedPlayers.filter(p => p.position === 'QB').slice(0, limits.QB);
    const rbs = sortedPlayers.filter(p => p.position === 'RB').slice(0, limits.RB);
    const wrs = sortedPlayers.filter(p => p.position === 'WR').slice(0, limits.WR);
    
    const finalPlayers = [...qbs, ...rbs, ...wrs];
    console.log(`Returning ${finalPlayers.length} players (QB: ${qbs.length}, RB: ${rbs.length}, WR: ${wrs.length})`);
    
    return finalPlayers;
    
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