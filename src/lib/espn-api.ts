import { Player } from './types';
import { SEASON_YEAR, PROJECTION_YEAR, MAJOR_PROGRAMS } from './season-config';

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
    console.log(`Using cached ESPN teams: ${espnTeamsCache.length}`);
    return espnTeamsCache;
  }
  
  try {
    console.log('Fetching teams from ESPN API...');
    const data = await espnRequest('/teams?limit=1000');
    
    console.log('ESPN teams API response structure:', {
      hasSports: !!data.sports,
      sportsLength: data.sports?.length,
      hasLeagues: !!data.sports?.[0]?.leagues,
      leaguesLength: data.sports?.[0]?.leagues?.length,
      hasTeams: !!data.sports?.[0]?.leagues?.[0]?.teams,
      teamsLength: data.sports?.[0]?.leagues?.[0]?.teams?.length
    });
    
    let teams: ESPNTeam[] = [];
    
    // Try the expected structure first
    if (data.sports?.[0]?.leagues?.[0]?.teams) {
      teams = data.sports[0].leagues[0].teams.map((teamData: any) => teamData.team || teamData);
    } 
    // Try alternative structure if teams are at a different level
    else if (data.teams) {
      teams = data.teams.map((teamData: any) => teamData.team || teamData);
    }
    // Try if teams are directly in the response
    else if (Array.isArray(data)) {
      teams = data.map((teamData: any) => teamData.team || teamData);
    }
    
    // Filter out invalid teams and ensure they have conference information
    teams = teams.filter(team => {
      const hasBasicInfo = team && (team.displayName || team.name);
      const hasConferenceInfo = team.conference?.name || team.conference?.shortName;
      
      if (hasBasicInfo && !hasConferenceInfo) {
        console.warn(`Team ${team.displayName || team.name} missing conference info`);
      }
      
      return hasBasicInfo; // Include teams even without conference info for now
    });
    
    console.log(`Processed ${teams.length} valid teams from ESPN`);
    
    if (teams.length > 0) {
      espnTeamsCache = teams;
      cacheTimestamp = Date.now();
      
      // Log conference distribution for debugging
      const conferenceCount = new Map<string, number>();
      teams.forEach(team => {
        const conf = team.conference?.name || 'Unknown';
        conferenceCount.set(conf, (conferenceCount.get(conf) || 0) + 1);
      });
      
      console.log('Teams by conference:', Array.from(conferenceCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10) // Top 10 conferences
        .map(([conf, count]) => `${conf}: ${count}`)
      );
      
      // Log a few sample teams for debugging
      console.log('Sample ESPN teams:', teams.slice(0, 5).map(t => ({
        name: t.displayName || t.name,
        conference: t.conference?.name || 'Unknown',
        id: t.id
      })));
    }
    
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

// Fetch team roster from ESPN (current active roster)
export const fetchESPNTeamRoster = async (teamId: string): Promise<ESPNRoster | null> => {
  try {
    // Try to get current roster data
    const data = await espnRequest(`/teams/${teamId}/roster`);
    
    if (!data || !data.athletes) {
      console.warn(`No roster data found for team ${teamId}`);
      return null;
    }

    // ESPN may return athletes as position groups: [{position: "offense", items: [...]}]
    // or as a flat array of athlete objects. Handle both shapes.
    let flatAthletes: any[] = [];
    if (Array.isArray(data.athletes) && data.athletes.length > 0) {
      if (data.athletes[0].items) {
        // Grouped format — flatten all position groups
        for (const group of data.athletes) {
          if (Array.isArray(group.items)) {
            flatAthletes.push(...group.items);
          }
        }
      } else {
        // Already flat
        flatAthletes = data.athletes;
      }
    }

    // Filter for current season eligible players — negative blacklist approach
    const INELIGIBLE_STATUSES = [
      'DECLARED FOR NFL DRAFT', 'ENTERED NFL DRAFT', 'PROFESSIONAL',
      'FORMER', 'EX-', 'GRADUATED', 'DEPARTED', 'TRANSFERRED OUT',
    ];
    const INELIGIBLE_NOTES = [
      'DECLARED FOR DRAFT', 'ENTERED DRAFT', 'ENTERING DRAFT',
      'ENTERED NFL DRAFT', 'ENTERING NFL', 'LEFT TEAM', 'GRADUATED',
      'TRANSFER OUT', 'DEPARTED', 'NO LONGER', 'OPTED OUT',
    ];

    const eligibleAthletes = flatAthletes.filter((athlete: any) => {
      const hasName = athlete.fullName || athlete.displayName;
      const hasPosition = athlete.position && athlete.position.abbreviation;
      
      if (!hasName || !hasPosition) {
        return false;
      }
      
      const playerName = athlete.fullName || athlete.displayName;
      
      if (athlete.status) {
        const statusUpper = (typeof athlete.status === 'string' ? athlete.status : athlete.status.type || '').toUpperCase();
        if (INELIGIBLE_STATUSES.some(s => statusUpper.includes(s))) {
          console.log(`Excluding player ${playerName} due to status: ${athlete.status}`);
          return false;
        }
      }
      
      if (athlete.notes) {
        const notesUpper = athlete.notes.toUpperCase();
        if (INELIGIBLE_NOTES.some(n => notesUpper.includes(n))) {
          console.log(`Excluding player ${playerName} due to notes: ${athlete.notes}`);
          return false;
        }
      }
      
      if (athlete.eligibility && athlete.eligibility.toUpperCase().includes('EXHAUSTED')) {
        console.log(`Excluding player ${playerName} - eligibility exhausted`);
        return false;
      }
      
      return true;
    });

    console.log(`Filtered ${flatAthletes.length} roster players to ${eligibleAthletes.length} eligible for ${SEASON_YEAR} season`);

    return { ...data, athletes: eligibleAthletes };
  } catch (error) {
    console.error(`Failed to fetch ESPN roster for team ${teamId}:`, error);
    return null;
  }
};

// Fetch player statistics from ESPN
export const fetchESPNPlayerStats = async (playerId: string, season: number = SEASON_YEAR): Promise<any> => {
  try {
    let data = await espnRequest(`/athletes/${playerId}/statistics?season=${season}`);
    
    // If no current season data available, try previous season for projections
    if (!data || !data.statistics || data.statistics.length === 0) {
      console.log(`No ${season} stats for player ${playerId}, trying ${PROJECTION_YEAR}...`);
      data = await espnRequest(`/athletes/${playerId}/statistics?season=${PROJECTION_YEAR}`);
    }

    // Last resort: try without specifying year (gets latest available)
    if (!data || !data.statistics || data.statistics.length === 0) {
      console.log(`No ${PROJECTION_YEAR} stats either, trying unparameterized...`);
      data = await espnRequest(`/athletes/${playerId}/statistics`);
    }
    
    return data;
  } catch (error) {
    console.warn(`Failed to fetch stats for player ${playerId}:`, error);
    return null;
  }
};

// Calculate projected points based on ESPN stats
const calculateProjectedPoints = (stats: any, position: string): number => {
  if (!stats || !stats.statistics) {
    return 0;
  }

  const statMap: { [key: string]: number } = {};
  let points = 0;

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
  
  // Fix headshot URL format - ensure it's a proper ESPN headshot URL
  let finalHeadshotUrl = headshotUrl;
  if (headshotUrl) {
    // Ensure the URL is properly formatted
    if (!headshotUrl.includes('headshots/college-football/players/full/')) {
      // Try to construct proper ESPN headshot URL if we have player ID
      if (espnPlayer.id) {
        finalHeadshotUrl = `https://a.espncdn.com/i/headshots/college-football/players/full/${espnPlayer.id}.png`;
      }
    } else {
      // Use the existing URL but ensure it's formatted correctly
      finalHeadshotUrl = headshotUrl.replace(/\/(s|w)\d+\./, '/full/');
    }
  } else if (espnPlayer.id) {
    // No headshot URL provided, construct one from player ID
    finalHeadshotUrl = `https://a.espncdn.com/i/headshots/college-football/players/full/${espnPlayer.id}.png`;
  } else {
    // No ID or URL available, use a generic placeholder
    finalHeadshotUrl = `https://a.espncdn.com/i/headshots/college-football/players/full/default.png`;
  }
  
  return {
    id: `espn_${espnPlayer.position.abbreviation.toLowerCase()}_${espnPlayer.id}`,
    name: fullName.trim(),
    position: espnPlayer.position.abbreviation as 'QB' | 'RB' | 'WR',
    team: teamData.displayName || teamData.name,
    conference,
    projectedPoints: calculateProjectedPoints(stats, espnPlayer.position.abbreviation),
    // Media assets
    headshotUrl: finalHeadshotUrl,
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
    // Set up player limits - significantly increased for comprehensive coverage
    const defaultLimits = { QB: 120, RB: 150, WR: 180 }; // Increased for better coverage
    const expandedLimits = { QB: 400, RB: 500, WR: 600 }; // Much larger limits when filtering
    
    const limits = options?.maxPlayersPerPosition || 
      (options?.specificTeam || options?.specificConference ? expandedLimits : defaultLimits);

    console.log('Fetching ESPN players with limits:', limits);
    console.log('Filter options:', { 
      specificTeam: options?.specificTeam, 
      specificConference: options?.specificConference 
    });

    // Get all teams
    const allTeams = await fetchESPNTeams();
    console.log(`ESPN API returned ${allTeams.length} total teams`);
    
    // Filter teams based on options
    let teamsToFetch: ESPNTeam[] = [];
    
    if (options?.specificTeam && options.specificTeam !== 'All Teams') {
      teamsToFetch = allTeams.filter(team => 
        team.displayName === options.specificTeam || 
        team.name === options.specificTeam ||
        team.shortDisplayName === options.specificTeam ||
        team.location === options.specificTeam
      );
      console.log(`Filtered to ${teamsToFetch.length} teams matching "${options.specificTeam}"`);
    } else if (options?.specificConference && options.specificConference !== 'All Conferences') {
      // Conference filtering by matching team location against MAJOR_PROGRAMS
      const conferenceTeamNames = MAJOR_PROGRAMS[options.specificConference] || [];
      teamsToFetch = allTeams.filter(team => 
        conferenceTeamNames.some(name => team.location === name)
      );
      console.log(`Filtered to ${teamsToFetch.length} teams in "${options.specificConference}"`);
    } else {
      // Default: match all known major programs by exact location name
      const allMajorNames = Object.values(MAJOR_PROGRAMS).flat();
      teamsToFetch = allTeams.filter(team =>
        allMajorNames.some(name => team.location === name)
      );
      console.log(`Matched ${teamsToFetch.length} major program teams from ESPN`);

      // If name matching found too few, use all teams as fallback
      if (teamsToFetch.length < 20) {
        console.warn(`Only matched ${teamsToFetch.length} teams by name, using all ${allTeams.length} teams`);
        teamsToFetch = allTeams.slice(0, 150);
      }
    }

    if (teamsToFetch.length === 0) {
      console.warn('No teams found matching filter criteria, using fallback teams');
      teamsToFetch = allTeams.slice(0, 100); // Increased fallback to 100 teams
    }

    console.log(`Fetching rosters from ${teamsToFetch.length} ESPN teams`);

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
        
        if (relevantPlayers.length > 0) {
          console.log(`Sample players from ${team.displayName}:`, relevantPlayers.slice(0, 2).map(p => ({
            name: p.fullName || p.displayName,
            position: p.position.abbreviation,
            status: p.status,
            class: p.class,
            eligibility: p.eligibility
          })));
        }
        
        for (const espnPlayer of relevantPlayers) {
          try {
            // Eligibility is already filtered by fetchESPNTeamRoster — trust its output
            const playerName = espnPlayer.fullName || espnPlayer.displayName || '';
            
            if (!playerName) {
              continue;
            }
            
            // Fetch stats for projections
            const stats = await fetchESPNPlayerStats(espnPlayer.id, SEASON_YEAR);
            
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
            
            // For current season players, we want active eligible players
            // Only filter out players with obviously incorrect data
            if (player.name && player.team && player.position) {
              allPlayers.push(player);
            }
          } catch (error) {
            console.warn(`Failed to process ESPN player ${espnPlayer.fullName || espnPlayer.id}:`, error);
          }
        }
        
        // Reduced delay to speed up loading but still avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
        
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
    
    // Log if we filtered out many players (indicating successful eligibility filtering)
    const filteredOutCount = allPlayers.length - playersWithValidNames.length;
    if (filteredOutCount > 0) {
      console.log(`Successfully filtered out ${filteredOutCount} players who are not eligible for ${SEASON_YEAR} season`);
    }

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
  try {
    const teams = await fetchESPNTeams();
    console.log(`Got ${teams.length} teams for conference extraction`);
    
    if (teams.length === 0) {
      throw new Error('No teams returned from ESPN API');
    }
    
    const conferences = Array.from(new Set(
      teams
        .map(team => team.conference?.name)
        .filter(conf => conf && conf !== 'Unknown')
    )).sort();
    
    console.log('Extracted conferences from ESPN:', conferences);
    
    if (conferences.length === 0) {
      throw new Error('No valid conferences found in team data');
    }
    
    return ['All Conferences', ...conferences];
  } catch (error) {
    console.error('Error in getESPNConferences:', error);
    throw error;
  }
};

// Get unique team names from ESPN
export const getESPNTeams = async (): Promise<string[]> => {
  try {
    const teams = await fetchESPNTeams();
    console.log(`Got ${teams.length} teams for team name extraction`);
    
    if (teams.length === 0) {
      throw new Error('No teams returned from ESPN API');
    }
    
    const teamNames = teams
      .map(team => team.displayName || team.name)
      .filter(name => name && name.trim() !== '')
      .sort();
    
    console.log('Extracted team names from ESPN:', teamNames.slice(0, 10), '...');
    
    if (teamNames.length === 0) {
      throw new Error('No valid team names found in team data');
    }
    
    return ['All Teams', ...teamNames];
  } catch (error) {
    console.error('Error in getESPNTeams:', error);
    throw error;
  }
};