import { Player } from './types';
import { fetchESPNCurrentPlayers, getESPNConferences, getESPNTeams } from './espn-api';

// Fallback sample data for when API is not available - 2025 season active players only
export const SAMPLE_PLAYERS: Player[] = [
  // Quarterbacks - 2025 season active players
  {
    id: 'qb1',
    name: 'Dillon Gabriel',
    position: 'QB',
    team: 'Oregon',
    conference: 'Big Ten',
    projectedPoints: 21.7,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431508.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
    teamColorPrimary: '#154733',
    teamColorSecondary: '#FEE123',
    passingYards: 3660,
    passingTDs: 30,
    completions: 315,
    attempts: 467,
    interceptions: 4,
    rushingYards: 400,
    rushingTDs: 10,
  },
  {
    id: 'qb2',
    name: 'Arch Manning',
    position: 'QB',
    team: 'Texas',
    conference: 'SEC',
    projectedPoints: 20.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685529.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
    teamColorPrimary: '#BF5700',
    teamColorSecondary: '#FFFFFF',
    passingYards: 2100,
    passingTDs: 18,
    completions: 180,
    attempts: 285,
    interceptions: 3,
    rushingYards: 150,
    rushingTDs: 4,
  },
  {
    id: 'qb3',
    name: 'Carson Beck',
    position: 'QB',
    team: 'Georgia',
    conference: 'SEC',
    projectedPoints: 22.1,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431890.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
    teamColorPrimary: '#BA0C2F',
    teamColorSecondary: '#000000',
    passingYards: 3941,
    passingTDs: 24,
    completions: 285,
    attempts: 417,
    interceptions: 12,
    rushingYards: 117,
    rushingTDs: 3,
  },
  {
    id: 'qb4',
    name: 'Miller Moss',
    position: 'QB',
    team: 'USC',
    conference: 'Big Ten',
    projectedPoints: 19.5,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431611.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
    teamColorPrimary: '#990000',
    teamColorSecondary: '#FFCC00',
    passingYards: 2555,
    passingTDs: 18,
    completions: 182,
    attempts: 263,
    interceptions: 6,
    rushingYards: 45,
    rushingTDs: 2,
  },
  {
    id: 'qb5',
    name: 'Drew Allar',
    position: 'QB',
    team: 'Penn State',
    conference: 'Big Ten',
    projectedPoints: 21.0,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431722.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
    teamColorPrimary: '#041E42',
    teamColorSecondary: '#FFFFFF',
    passingYards: 2631,
    passingTDs: 25,
    completions: 180,
    attempts: 287,
    interceptions: 2,
    rushingYards: 344,
    rushingTDs: 3,
  },
  {
    id: 'qb6',
    name: 'Quinn Ewers',
    position: 'QB',
    team: 'Texas',
    conference: 'SEC',
    projectedPoints: 20.3,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431965.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
    teamColorPrimary: '#BF5700',
    teamColorSecondary: '#FFFFFF',
    passingYards: 3479,
    passingTDs: 22,
    completions: 289,
    attempts: 448,
    interceptions: 6,
    rushingYards: 75,
    rushingTDs: 2,
  },
  {
    id: 'qb7',
    name: 'Conner Weigman',
    position: 'QB',
    team: 'Texas A&M',
    conference: 'SEC',
    projectedPoints: 18.9,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431508.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
    teamColorPrimary: '#500000',
    teamColorSecondary: '#FFFFFF',
    passingYards: 1681,
    passingTDs: 12,
    completions: 118,
    attempts: 186,
    interceptions: 4,
    rushingYards: 89,
    rushingTDs: 2,
  },
  {
    id: 'qb8',
    name: 'Cam Ward',
    position: 'QB',
    team: 'Miami',
    conference: 'ACC',
    projectedPoints: 22.5,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685863.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
    teamColorPrimary: '#F47321',
    teamColorSecondary: '#046A38',
    passingYards: 4123,
    passingTDs: 25,
    completions: 292,
    attempts: 445,
    interceptions: 7,
    rushingYards: 196,
    rushingTDs: 4,
  },

  // Running Backs - 2025 season active players
  {
    id: 'rb1',
    name: 'Ollie Gordon II',
    position: 'RB',
    team: 'Oklahoma State',
    conference: 'Big 12',
    projectedPoints: 20.1,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685863.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png',
    teamColorPrimary: '#FF7300',
    teamColorSecondary: '#000000',
    rushingYards: 1732,
    rushingTDs: 21,
    receivingYards: 330,
    receptions: 39,
    receivingTDs: 1,
  },
  {
    id: 'rb2',
    name: 'Quinshon Judkins',
    position: 'RB',
    team: 'Ohio State',
    conference: 'Big Ten',
    projectedPoints: 18.7,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431734.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
    teamColorPrimary: '#CC0000',
    teamColorSecondary: '#000000',
    rushingYards: 1158,
    rushingTDs: 17,
    receivingYards: 149,
    receptions: 16,
    receivingTDs: 0,
  },
  {
    id: 'rb3',
    name: 'Dylan Sampson',
    position: 'RB',
    team: 'Tennessee',
    conference: 'SEC',
    projectedPoints: 19.2,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431593.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
    teamColorPrimary: '#FF8200',
    teamColorSecondary: '#FFFFFF',
    rushingYards: 1485,
    rushingTDs: 22,
    receivingYards: 278,
    receptions: 23,
    receivingTDs: 1,
  },
  {
    id: 'rb4',
    name: 'Kaleb Johnson',
    position: 'RB',
    team: 'Iowa',
    conference: 'Big Ten',
    projectedPoints: 17.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685530.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png',
    teamColorPrimary: '#FFCD00',
    teamColorSecondary: '#000000',
    rushingYards: 1537,
    rushingTDs: 21,
    receivingYards: 109,
    receptions: 8,
    receivingTDs: 0,
  },
  {
    id: 'rb5',
    name: 'Tahj Brooks',
    position: 'RB',
    team: 'Texas Tech',
    conference: 'Big 12',
    projectedPoints: 16.5,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431879.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png',
    teamColorPrimary: '#CC0000',
    teamColorSecondary: '#000000',
    rushingYards: 1538,
    rushingTDs: 10,
    receivingYards: 235,
    receptions: 22,
    receivingTDs: 0,
  },
  {
    id: 'rb6',
    name: 'Jarquez Hunter',
    position: 'RB',
    team: 'Auburn',
    conference: 'SEC',
    projectedPoints: 15.9,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685421.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
    teamColorPrimary: '#0C2340',
    teamColorSecondary: '#C99700',
    rushingYards: 1185,
    rushingTDs: 7,
    receivingYards: 145,
    receptions: 12,
    receivingTDs: 1,
  },

  // Wide Receivers - 2025 season active players
  {
    id: 'wr1',
    name: 'Luther Burden III',
    position: 'WR',
    team: 'Missouri',
    conference: 'SEC',
    projectedPoints: 19.3,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431735.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
    teamColorPrimary: '#F1B82D',
    teamColorSecondary: '#000000',
    receivingYards: 1212,
    receptions: 86,
    receivingTDs: 9,
  },
  {
    id: 'wr2',
    name: 'Emeka Egbuka',
    position: 'WR',
    team: 'Ohio State',
    conference: 'Big Ten',
    projectedPoints: 18.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4432012.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
    teamColorPrimary: '#CC0000',
    teamColorSecondary: '#000000',
    receivingYards: 1191,
    receptions: 67,
    receivingTDs: 10,
  },
  {
    id: 'wr3',
    name: 'Evan Stewart',
    position: 'WR',
    team: 'Oregon',
    conference: 'Big Ten',
    projectedPoints: 17.9,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431584.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
    teamColorPrimary: '#154733',
    teamColorSecondary: '#FEE123',
    receivingYards: 1019,
    receptions: 64,
    receivingTDs: 6,
  },
  {
    id: 'wr4',
    name: 'Elic Ayomanor',
    position: 'WR',
    team: 'Stanford',
    conference: 'ACC',
    projectedPoints: 16.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431967.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/24.png',
    teamColorPrimary: '#8C1515',
    teamColorSecondary: '#DAA900',
    receivingYards: 1013,
    receptions: 54,
    receivingTDs: 8,
  },
  {
    id: 'wr5',
    name: 'Xavier Restrepo',
    position: 'WR',
    team: 'Miami',
    conference: 'ACC',
    projectedPoints: 18.2,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431612.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
    teamColorPrimary: '#F47321',
    teamColorSecondary: '#046A38',
    receivingYards: 1092,
    receptions: 67,
    receivingTDs: 11,
  },
  {
    id: 'wr6',
    name: 'Tetairoa McMillan',
    position: 'WR',
    team: 'Arizona',
    conference: 'Big 12',
    projectedPoints: 19.1,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685792.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png',
    teamColorPrimary: '#CC0000',
    teamColorSecondary: '#003366',
    receivingYards: 1319,
    receptions: 84,
    receivingTDs: 8,
  },
  {
    id: 'wr7',
    name: 'Nick Nash',
    position: 'WR',
    team: 'San José State',
    conference: 'Mountain West',
    projectedPoints: 17.4,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685421.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/23.png',
    teamColorPrimary: '#0055A2',
    teamColorSecondary: '#FFB81C',
    receivingYards: 1356,
    receptions: 97,
    receivingTDs: 8,
  },
  {
    id: 'wr8',
    name: 'Isaiah Bond',
    position: 'WR',
    team: 'Texas',
    conference: 'SEC',
    projectedPoints: 16.7,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685234.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
    teamColorPrimary: '#BF5700',
    teamColorSecondary: '#FFFFFF',
    receivingYards: 847,
    receptions: 48,
    receivingTDs: 5,
  },
  {
    id: 'wr9',
    name: 'Ryan Williams',
    position: 'WR',
    team: 'Alabama',
    conference: 'SEC',
    projectedPoints: 18.5,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685234.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
    teamColorPrimary: '#9E1B32',
    teamColorSecondary: '#FFFFFF',
    receivingYards: 857,
    receptions: 45,
    receivingTDs: 12,
  },
  {
    id: 'wr10',
    name: 'Tre Harris',
    position: 'WR',
    team: 'Ole Miss',
    conference: 'SEC',
    projectedPoints: 17.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685234.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
    teamColorPrimary: '#CE1126',
    teamColorSecondary: '#002654',
    receivingYards: 985,
    receptions: 59,
    receivingTDs: 8,
  },
];

// Cache for API data - now supports multiple cache entries based on filters
const playersCache = new Map<string, { players: Player[], timestamp: number }>();
let conferencesCache: string[] = [];
let teamsCache: string[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Generate cache key based on filter options
const getCacheKey = (options?: { specificTeam?: string; specificConference?: string }) => {
  if (!options) return 'default';
  return `${options.specificTeam || 'all'}_${options.specificConference || 'all'}`;
};

// Check if cache is valid
const isCacheValid = (timestamp: number) => {
  return Date.now() - timestamp < CACHE_DURATION;
};

// Main function to get players (with caching and smart loading)
export const getPlayers = async (options?: { 
  specificTeam?: string; 
  specificConference?: string;
}): Promise<Player[]> => {
  const cacheKey = getCacheKey(options);
  const cachedData = playersCache.get(cacheKey);
  
  // Check if cached data is valid (has proper player names)
  if (cachedData && isCacheValid(cachedData.timestamp)) {
    const hasValidNames = cachedData.players.every(p => p.name && !p.name.includes('undefined') && p.name.trim() !== '');
    if (hasValidNames && cachedData.players.length > 0) {
      console.log(`Using cached players for ${cacheKey}:`, cachedData.players.length);
      return cachedData.players;
    } else {
      console.warn('Cached data has invalid names or is empty, clearing cache for', cacheKey);
      playersCache.delete(cacheKey);
    }
  }

  console.log(`Attempting to fetch players from ESPN with options:`, options);
  
  try {
    console.log('Fetching current players from ESPN...');
    
    // Convert filter options to ESPN API parameters
    const apiOptions: {
      specificTeam?: string;
      specificConference?: string;
    } = {};
    
    if (options?.specificTeam && options.specificTeam !== 'All Teams') {
      apiOptions.specificTeam = options.specificTeam;
    }
    
    if (options?.specificConference && options.specificConference !== 'All Conferences') {
      apiOptions.specificConference = options.specificConference;
    }

    // Fetch from ESPN API
    const allPlayers = await fetchESPNCurrentPlayers(apiOptions);
    console.log(`ESPN API returned ${allPlayers.length} players`);
    
    // Validate that we have good player data
    const validPlayers = allPlayers.filter(p => 
      p.name && 
      p.name.trim() !== '' && 
      !p.name.includes('undefined') &&
      !p.name.startsWith('Player ')
    );
    
    console.log(`Filtered to ${validPlayers.length} valid players`);
    
    // Set minimum player count based on filter type
    const minExpectedPlayers = options?.specificTeam ? 10 : options?.specificConference ? 50 : 100;
    
    if (validPlayers.length >= minExpectedPlayers) {
      // Cache the successful result
      playersCache.set(cacheKey, {
        players: validPlayers,
        timestamp: Date.now()
      });
      
      console.log(`Successfully cached ${validPlayers.length} players for ${cacheKey}`);
      return validPlayers;
    } else {
      const combinedPlayers = [...validPlayers];
      
      // Add sample players that match the filter and aren't already included
      const existingPlayerNames = new Set(validPlayers.map(p => p.name.toLowerCase()));
      const filteredSamplePlayers = SAMPLE_PLAYERS.filter(samplePlayer => {
        const matchesFilter = 
          (!options?.specificTeam || options.specificTeam === 'All Teams' || samplePlayer.team === options.specificTeam) &&
          (!options?.specificConference || options.specificConference === 'All Conferences' || samplePlayer.conference === options.specificConference);
        
        const notDuplicate = !existingPlayerNames.has(samplePlayer.name.toLowerCase());
        
        return matchesFilter && notDuplicate;
      });
      
      combinedPlayers.push(...filteredSamplePlayers);
      
      console.log(`Combined result: ${combinedPlayers.length} players (${validPlayers.length} ESPN + ${filteredSamplePlayers.length} sample)`);
      
      playersCache.set(cacheKey, {
        players: combinedPlayers,
        timestamp: Date.now()
      });
      
      return combinedPlayers;
    }
      
  } catch (error) {
    console.error('Error fetching players from ESPN:', error);
    console.log('Falling back to sample data');
    
    let samplePlayers = [...SAMPLE_PLAYERS];
    
    if (options?.specificTeam && options.specificTeam !== 'All Teams') {
      samplePlayers = samplePlayers.filter(p => p.team === options.specificTeam);
    }
    
    if (options?.specificConference && options.specificConference !== 'All Conferences') {
      samplePlayers = samplePlayers.filter(p => p.conference === options.specificConference);
    }
    
    playersCache.set(cacheKey, {
      players: samplePlayers,
      timestamp: Date.now()
    });
    
    console.log(`Using ${samplePlayers.length} filtered sample players as fallback`);
    return samplePlayers;
  }
}

// Default fallback conferences and teams that should always be available
const DEFAULT_CONFERENCES = [
  'All Conferences', 
  'SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', // Power 5
  'American Athletic', 'Conference USA', 'Mid-American', 'Mountain West', 'Sun Belt', // Group of 5
  'Big Sky', 'Big South', 'Colonial Athletic', 'Ivy League', 'Northeast', // FCS
  'Ohio Valley', 'Patriot League', 'Southern', 'Southland', 'Western Athletic',
  'Independent' // For Notre Dame, etc.
];

const DEFAULT_TEAMS_FROM_SAMPLE = [
  'All Teams',
  ...Array.from(new Set(SAMPLE_PLAYERS.map(p => p.team))).sort()
];

// Get conferences (with caching)
export const getConferences = async (): Promise<string[]> => {
  if (conferencesCache.length > 0 && isCacheValid(cacheTimestamp)) {
    return conferencesCache;
  }

  try {
    const espnConferences = await getESPNConferences();
    console.log(`ESPN conferences loaded: ${espnConferences.length}`, espnConferences);
    
    if (espnConferences.length > 10) {
      conferencesCache = espnConferences;
      cacheTimestamp = Date.now();
      console.log('Successfully loaded ESPN conferences:', espnConferences);
      return conferencesCache;
    } else {
      console.warn('ESPN returned insufficient conferences data, using enhanced defaults');
      throw new Error('ESPN returned insufficient conferences data');
    }
  } catch (error) {
    console.error('Failed to fetch conferences from ESPN, using comprehensive default list:', error);
    
    // Enhanced fallback with more comprehensive conference list
    const enhancedConferences = [
      'All Conferences',
      // Power 5
      'SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12',
      // Group of 5
      'American Athletic', 'Conference USA', 'Mid-American', 'Mountain West', 'Sun Belt',
      // FCS Conferences  
      'Big Sky', 'Big South', 'Colonial Athletic', 'Ivy League', 'Northeast',
      'Ohio Valley', 'Patriot League', 'Southern', 'Southland', 'Western Athletic',
      // Additional conferences
      'ASUN', 'MEAC', 'SWAC', 'Pioneer League', 'NEC',
      // Independent
      'Independent'
    ];
    
    conferencesCache = enhancedConferences;
    cacheTimestamp = Date.now();
    return enhancedConferences;
  }
};

// Get teams (with caching and comprehensive fallback)
export const getTeams = async (): Promise<string[]> => {
  if (teamsCache.length > 1 && isCacheValid(cacheTimestamp)) { // Must have more than just "All Teams"
    return teamsCache;
  }

  console.log('Loading teams from ESPN...');
  
  try {
    const espnTeams = await getESPNTeams();
    console.log(`ESPN teams loaded: ${espnTeams.length}`);
    
    if (espnTeams.length > 50) { // Should have many teams for comprehensive coverage
      teamsCache = espnTeams;
      cacheTimestamp = Date.now();
      console.log('Successfully loaded ESPN teams:', espnTeams.length, 'teams');
      return teamsCache;
    } else {
      console.warn('ESPN returned insufficient teams data, combining with sample data');
      
      // Combine what we got from ESPN with sample data
      const sampleTeamNames = Array.from(new Set(SAMPLE_PLAYERS.map(p => p.team))).sort();
      const combinedTeams = ['All Teams', ...new Set([...espnTeams.slice(1), ...sampleTeamNames])].sort();
      
      teamsCache = combinedTeams;
      cacheTimestamp = Date.now();
      console.log(`Using combined team list: ${combinedTeams.length} teams`);
      return combinedTeams;
    }
  } catch (error) {
    console.error('Failed to fetch teams from ESPN, using sample data teams:', error);
    
    // Enhanced fallback with teams from sample data plus common major teams
    const sampleTeamNames = Array.from(new Set(SAMPLE_PLAYERS.map(p => p.team))).sort();
    const commonMajorTeams = [
      // SEC
      'Alabama', 'Georgia', 'LSU', 'Texas', 'Tennessee', 'Florida', 'Auburn', 'Arkansas', 'Kentucky', 'Mississippi State', 'Missouri', 'Ole Miss', 'South Carolina', 'Texas A&M', 'Vanderbilt',
      // Big Ten
      'Ohio State', 'Michigan', 'Penn State', 'Wisconsin', 'Iowa', 'Minnesota', 'Nebraska', 'Northwestern', 'Illinois', 'Indiana', 'Maryland', 'Michigan State', 'Purdue', 'Rutgers', 'Oregon', 'UCLA', 'USC', 'Washington',
      // Big 12
      'Oklahoma', 'Oklahoma State', 'Texas Tech', 'Baylor', 'TCU', 'Kansas', 'Kansas State', 'Iowa State', 'West Virginia', 'Cincinnati', 'Houston', 'UCF', 'BYU',
      // ACC
      'Clemson', 'Florida State', 'Miami', 'North Carolina', 'NC State', 'Duke', 'Virginia', 'Virginia Tech', 'Wake Forest', 'Georgia Tech', 'Louisville', 'Pittsburgh', 'Syracuse', 'Boston College',
      // Pac-12 (remaining)
      'Stanford', 'Cal', 'Arizona', 'Arizona State', 'Colorado', 'Utah', 'Washington State', 'Oregon State'
    ];
    
    const enhancedTeams = ['All Teams', ...new Set([...sampleTeamNames, ...commonMajorTeams])].sort();
    
    teamsCache = enhancedTeams;
    cacheTimestamp = Date.now();
    console.log(`Using enhanced team fallback: ${enhancedTeams.length} teams`);
    return enhancedTeams;
  }
};

// Clear cache (useful for refreshing data)
export const clearCache = () => {
  playersCache.clear();
  conferencesCache = [];
  teamsCache = [];
  cacheTimestamp = 0;
};