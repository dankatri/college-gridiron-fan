import { Player } from './types';

// ESPN API configuration - no API key required for public endpoints  
const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football';

// Interface for ESPN player data
interface ESPNPlayer {
  id: string;
  fullName: string;
  displayName: string;
  position: {
    id: string;
    name: string;
    displayName: string;
    abbreviation: string;
  };
  jersey?: string;
  height?: number;
  weight?: number;
  age?: number;
  headshot?: {
    href: string;
  };
}

interface ESPNTeam {
  id: string;
  uid: string;
  location: string;
  name: string;
  displayName: string;
  shortDisplayName: string;
  color: string;
  alternateColor: string;
  logo: string;
  conference?: {
    id: string;
    name: string;
    shortName: string;
  };
  record?: {
    items: Array<{
      description: string;
      type: string;
      summary: string;
    }>;
  };
}

interface ESPNRoster {
  team: ESPNTeam;
  athletes: Array<{
    id: string;
    fullName: string;
    displayName: string;
    shortName: string;
    position: {
      id: string;
      name: string;
      displayName: string;
      abbreviation: string;
    };
    jersey?: string;
    height?: number;
    weight?: number;
    age?: number;
    headshot?: {
      href: string;
    };
  }>;
}

interface ESPNPlayerStats {
  player: {
    id: string;
    fullName: string;
    displayName: string;
  };
  team: {
    id: string;
    name: string;
    displayName: string;
  };
  statistics: Array<{
    name: string;
    displayName: string;
    shortDisplayName: string;
    description: string;
    value: number;
    displayValue: string;
  }>;
}

// ESPN API request helper
const espnRequest = async (endpoint: string): Promise<any> => {
  console.log(`Making ESPN API request to: ${ESPN_BASE_URL}${endpoint}`);
  
  try {
    const response = await fetch(`${ESPN_BASE_URL}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'College Fantasy Football App',
      },
    });

    if (!response.ok) {
      console.error(`ESPN API request failed: ${response.status} ${response.statusText}`);
      throw new Error(`ESPN API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('ESPN API request error:', error);
    throw error;
  }
};

// Cache for team info
let espnTeamsCache: ESPNTeam[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Check if cache is valid
const isCacheValid = () => {
  return Date.now() - cacheTimestamp < CACHE_DURATION;
};

// Fetch teams from ESPN
export const fetchESPNTeams = async (): Promise<ESPNTeam[]> => {
  if (espnTeamsCache.length > 0 && isCacheValid()) {
    return espnTeamsCache;
  }
  
  try {
    const data = await espnRequest('/teams');
    const teams: ESPNTeam[] = data.sports?.[0]?.leagues?.[0]?.teams?.map((teamData: any) => teamData.team) || [];
    
    espnTeamsCache = teams;
    cacheTimestamp = Date.now();
    
    console.log(`Fetched ${teams.length} teams from ESPN`);
    return teams;
  } catch (error) {
    console.error('Failed to fetch ESPN teams:', error);
    return [];
  }
};

// Get conference for a team
const getTeamConference = async (teamId: string): Promise<string> => {
  const teams = await fetchESPNTeams();
  const team = teams.find(t => t.id === teamId);
  return team?.conference?.name || 'Unknown';
};

// Fetch team roster from ESPN
export const fetchESPNTeamRoster = async (teamId: string): Promise<ESPNRoster | null> => {
  try {
    const data = await espnRequest(`/teams/${teamId}/roster`);
    
    if (!data || !data.athletes) {
      console.warn(`No roster data found for team ${teamId}`);
      return null;
    }

    const roster: ESPNRoster = {
      team: data.team,
      athletes: data.athletes
    };

    console.log(`Fetched roster for ${data.team?.displayName || teamId}: ${data.athletes?.length || 0} players`);
    return roster;
  } catch (error) {
    console.error(`Failed to fetch ESPN roster for team ${teamId}:`, error);
    return null;
  }
};

// Fetch player statistics from ESPN (2024 season)
export const fetchESPNPlayerStats = async (playerId: string, season: number = 2024): Promise<any> => {
  try {
    const data = await espnRequest(`/athletes/${playerId}/statistics?season=${season}`);
    return data;
  } catch (error) {
    console.warn(`Failed to fetch stats for player ${playerId}:`, error);
    return null;
  }
};

// Calculate projected points based on ESPN stats
const calculateProjectedPoints = (stats: any, position: string): number => {
  let points = 0;

  if (!stats || !stats.statistics) return 0;

  // Convert ESPN stats format to values we can use
  const statMap: { [key: string]: number } = {};
  stats.statistics.forEach((stat: any) => {
    const name = stat.shortDisplayName || stat.name;
    const value = typeof stat.value === 'number' ? stat.value : parseFloat(stat.displayValue) || 0;
    statMap[name] = value;
  });

  if (position === 'QB') {
    // Passing stats
    const passingYards = statMap['PASS YDS'] || statMap['PassingYards'] || 0;
    const passingTDs = statMap['PASS TD'] || statMap['PassingTouchdowns'] || 0;
    const interceptions = statMap['INT'] || statMap['Interceptions'] || 0;
    const completions = statMap['COMP'] || statMap['Completions'] || 0;
    const attempts = statMap['ATT'] || statMap['Attempts'] || 0;
    const incompletions = attempts > completions ? attempts - completions : 0;
    
    // Rushing stats for QBs
    const rushingYards = statMap['RUSH YDS'] || statMap['RushingYards'] || 0;
    const rushingTDs = statMap['RUSH TD'] || statMap['RushingTouchdowns'] || 0;

    points += Math.floor(passingYards / 25) * 1; // 25 passing yards = 1 point
    points += passingTDs * 4; // Passing TD = 4 points
    points += interceptions * -2; // Interception = -2 points
    points += completions * 0.3; // Completion = 0.3 points
    points += incompletions * -0.3; // Incompletion = -0.3 points
    points += Math.floor(rushingYards / 10) * 1; // 10 rush yards = 1 point
    points += rushingTDs * 6; // Rushing TD = 6 points
  } else if (position === 'RB') {
    const rushingYards = statMap['RUSH YDS'] || statMap['RushingYards'] || 0;
    const rushingTDs = statMap['RUSH TD'] || statMap['RushingTouchdowns'] || 0;
    const receivingYards = statMap['REC YDS'] || statMap['ReceivingYards'] || 0;
    const receivingTDs = statMap['REC TD'] || statMap['ReceivingTouchdowns'] || 0;
    const returnYards = (statMap['KR YDS'] || 0) + (statMap['PR YDS'] || 0);

    points += Math.floor(rushingYards / 10) * 1; // 10 rush yards = 1 point
    points += rushingTDs * 6; // Rushing TD = 6 points
    points += Math.floor(receivingYards / 10) * 1; // 10 receiving yards = 1 point
    points += receivingTDs * 6; // Receiving TD = 6 points
    points += Math.floor(returnYards / 10) * 1; // 10 return yards = 1 point
  } else if (position === 'WR') {
    const receivingYards = statMap['REC YDS'] || statMap['ReceivingYards'] || 0;
    const receivingTDs = statMap['REC TD'] || statMap['ReceivingTouchdowns'] || 0;
    const rushingYards = statMap['RUSH YDS'] || statMap['RushingYards'] || 0;
    const rushingTDs = statMap['RUSH TD'] || statMap['RushingTouchdowns'] || 0;
    const returnYards = (statMap['KR YDS'] || 0) + (statMap['PR YDS'] || 0);

    points += Math.floor(receivingYards / 10) * 1; // 10 receiving yards = 1 point
    points += receivingTDs * 6; // Receiving TD = 6 points
    points += Math.floor(rushingYards / 10) * 1; // 10 rush yards = 1 point
    points += rushingTDs * 6; // Rushing TD = 6 points
    points += Math.floor(returnYards / 10) * 1; // 10 return yards = 1 point
  }

  return Math.max(0, points); // Ensure non-negative
};

// Extract stats from ESPN player stats response
const extractPlayerStats = (statsData: any) => {
  if (!statsData || !statsData.statistics) {
    return {};
  }

  const statMap: { [key: string]: number } = {};
  statsData.statistics.forEach((stat: any) => {
    const name = stat.shortDisplayName || stat.name;
    const value = typeof stat.value === 'number' ? stat.value : parseFloat(stat.displayValue) || 0;
    statMap[name] = value;
  });

  return {
    // QB stats
    passingYards: statMap['PASS YDS'] || statMap['PassingYards'] || 0,
    passingTDs: statMap['PASS TD'] || statMap['PassingTouchdowns'] || 0,
    completions: statMap['COMP'] || statMap['Completions'] || 0,
    attempts: statMap['ATT'] || statMap['Attempts'] || 0,
    interceptions: statMap['INT'] || statMap['Interceptions'] || 0,
    // RB/WR stats
    rushingYards: statMap['RUSH YDS'] || statMap['RushingYards'] || 0,
    rushingTDs: statMap['RUSH TD'] || statMap['RushingTouchdowns'] || 0,
    receivingYards: statMap['REC YDS'] || statMap['ReceivingYards'] || 0,
    receptions: statMap['REC'] || statMap['Receptions'] || 0,
    receivingTDs: statMap['REC TD'] || statMap['ReceivingTouchdowns'] || 0,
    returnYards: (statMap['KR YDS'] || 0) + (statMap['PR YDS'] || 0),
  };
};

// Convert ESPN data to our Player format
const convertESPNPlayerToPlayer = async (espnPlayer: any, teamData: ESPNTeam, stats: any): Promise<Player> => {
  const conference = teamData.conference?.name || 'Unknown';
  
  // Clean up player name
  let fullName = espnPlayer.fullName || espnPlayer.displayName || '';
  if (!fullName) {
    console.warn('No name available for ESPN player:', espnPlayer);
    fullName = `Player ${espnPlayer.id}`;
  }
  
  const extractedStats = extractPlayerStats(stats);
  
  // Get media assets
  const headshotUrl = espnPlayer.headshot?.href || espnPlayer.headshot;
  const teamLogoUrl = teamData.logo;
  const teamColorPrimary = teamData.color ? `#${teamData.color}` : undefined;
  const teamColorSecondary = teamData.alternateColor ? `#${teamData.alternateColor}` : undefined;
  
  return {
    id: `espn_${espnPlayer.position.abbreviation.toLowerCase()}_${espnPlayer.id}`,
    name: fullName.trim(),
    position: espnPlayer.position.abbreviation as 'QB' | 'RB' | 'WR',
    team: teamData.displayName || teamData.name,
    conference,
    projectedPoints: calculateProjectedPoints(stats, espnPlayer.position.abbreviation),
    // Media assets
    headshotUrl,
    teamLogoUrl,
    teamColorPrimary,
    teamColorSecondary,
    // QB stats
    passingYards: extractedStats.passingYards,
    passingTDs: extractedStats.passingTDs,
    completions: extractedStats.completions,
    attempts: extractedStats.attempts,
    interceptions: extractedStats.interceptions,
    // RB/WR stats
    rushingYards: extractedStats.rushingYards,
    rushingTDs: extractedStats.rushingTDs,
    receivingYards: extractedStats.receivingYards,
    receptions: extractedStats.receptions,
    receivingTDs: extractedStats.receivingTDs,
    returnYards: extractedStats.returnYards,
  };
};

// Main function to fetch current players from ESPN
export const fetchESPNCurrentPlayers = async (options?: {
  specificTeam?: string;
  specificConference?: string;
  maxPlayersPerPosition?: { QB: number; RB: number; WR: number };
}): Promise<Player[]> => {
  try {
    // Set up player limits - increased for better selection
    const defaultLimits = { QB: 50, RB: 60, WR: 80 }; // Increased from 30/30/40
    const expandedLimits = { QB: 150, RB: 200, WR: 250 }; // Increased limits when filtering
    
    const limits = options?.maxPlayersPerPosition || 
      (options?.specificTeam || options?.specificConference ? expandedLimits : defaultLimits);

    console.log('Fetching ESPN players with limits:', limits);
    console.log('Filter options:', { 
      specificTeam: options?.specificTeam, 
      specificConference: options?.specificConference 
    });

    // Get all teams
    const allTeams = await fetchESPNTeams();
    
    // Filter teams based on options
    let teamsToFetch: ESPNTeam[] = [];
    
    if (options?.specificTeam && options.specificTeam !== 'All Teams') {
      teamsToFetch = allTeams.filter(team => 
        team.displayName === options.specificTeam || 
        team.name === options.specificTeam ||
        team.shortDisplayName === options.specificTeam ||
        team.location === options.specificTeam
      );
    } else if (options?.specificConference && options.specificConference !== 'All Conferences') {
      teamsToFetch = allTeams.filter(team => 
        team.conference?.name === options.specificConference ||
        team.conference?.shortName === options.specificConference
      ).slice(0, 40); // Increased limit for conference filtering
    } else {
      // Get teams from all major conferences for expanded player selection
      const majorConferences = [
        'SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', // Power 5
        'American Athletic', 'Conference USA', 'Mid-American', 'Mountain West', 'Sun Belt', // Group of 5
        'Big Sky', 'Big South', 'Colonial Athletic', 'Ivy League', 'Northeast', 
        'Ohio Valley', 'Patriot League', 'Southern', 'Southland', 'Western Athletic'
      ];
      teamsToFetch = allTeams.filter(team => 
        team.conference && majorConferences.includes(team.conference.name)
      ).slice(0, 100); // Increased from 60 to 100 teams for more player diversity
    }

    if (teamsToFetch.length === 0) {
      console.warn('No teams found matching filter criteria, using more teams');
      teamsToFetch = allTeams.slice(0, 80); // Increased from 30 to 80 teams for better coverage
    }

    console.log(`Fetching rosters from ${teamsToFetch.length} ESPN teams across expanded conferences`);

    const allPlayers: Player[] = [];
    
    // Fetch rosters and stats for each team
    for (const team of teamsToFetch) {
      try {
        const roster = await fetchESPNTeamRoster(team.id);
        
        if (!roster || !roster.athletes) {
          console.warn(`No roster data for team ${team.displayName}`);
          continue;
        }
        
        // Filter for QB, RB, WR positions only
        const relevantPlayers = roster.athletes.filter(player => 
          ['QB', 'RB', 'WR'].includes(player.position.abbreviation)
        );
        
        console.log(`Processing ${relevantPlayers.length} players from ${team.displayName}`);
        
        for (const espnPlayer of relevantPlayers) {
          try {
            // Fetch 2024 stats for the player
            const stats = await fetchESPNPlayerStats(espnPlayer.id, 2024);
            
            const player = await convertESPNPlayerToPlayer(espnPlayer, team, stats);
            
            // Validate player has a proper name
            if (!player.name || 
                player.name.includes('undefined') || 
                player.name.trim() === '' ||
                player.name.startsWith('Player ')) {
              console.warn('Skipping ESPN player with invalid name:', {
                id: espnPlayer.id,
                name: player.name,
                rawName: espnPlayer.fullName || espnPlayer.displayName
              });
              continue;
            }
            
            // Include more players when filtering, be more selective for "All" view
            const minPoints = (options?.specificTeam || options?.specificConference) ? 0 : 1;
            if (player.projectedPoints >= minPoints) {
              allPlayers.push(player);
            }
          } catch (error) {
            console.warn(`Failed to process ESPN player ${espnPlayer.fullName || espnPlayer.id}:`, error);
          }
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`Failed to fetch roster for ESPN team ${team.displayName}:`, error);
      }
    }

    // Filter out players with invalid names
    const playersWithValidNames = allPlayers.filter(p => 
      p.name && 
      !p.name.includes('undefined') && 
      p.name.trim() !== '' && 
      !p.name.startsWith('Player ')
    );
    
    if (playersWithValidNames.length === 0) {
      console.warn('ESPN returned no players with valid names');
      throw new Error('ESPN returned no players with valid names');
    }
    
    console.log(`ESPN data validation: ${playersWithValidNames.length}/${allPlayers.length} players have valid names`);

    // Sort by projected points and return top performers by position
    const sortedPlayers = playersWithValidNames.sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    // Get players by position based on limits
    const qbs = sortedPlayers.filter(p => p.position === 'QB').slice(0, limits.QB);
    const rbs = sortedPlayers.filter(p => p.position === 'RB').slice(0, limits.RB);
    const wrs = sortedPlayers.filter(p => p.position === 'WR').slice(0, limits.WR);
    
    const finalPlayers = [...qbs, ...rbs, ...wrs];
    console.log(`Returning ${finalPlayers.length} ESPN players (QB: ${qbs.length}, RB: ${rbs.length}, WR: ${wrs.length})`);
    
    return finalPlayers;
    
  } catch (error) {
    console.error('Error fetching ESPN players:', error);
    throw error;
  }
};

// Get unique conferences from ESPN teams
export const getESPNConferences = async (): Promise<string[]> => {
  const teams = await fetchESPNTeams();
  const conferences = Array.from(new Set(
    teams
      .map(team => team.conference?.name)
      .filter(conf => conf && conf !== 'Unknown')
  )).sort();
  
  return ['All Conferences', ...conferences];
};

// Get unique team names from ESPN
export const getESPNTeams = async (): Promise<string[]> => {
  const teams = await fetchESPNTeams();
  const teamNames = teams.map(team => team.displayName || team.name).sort();
  
  return ['All Teams', ...teamNames];
};