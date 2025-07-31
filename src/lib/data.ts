import { Player } from './types';
import { fetchESPNCurrentPlayers, getESPNConferences, getESPNTeams } from './espn-api';

// Fallback sample data for when API is not available - expanded with more conferences and teams
export const SAMPLE_PLAYERS: Player[] = [
  // Quarterbacks - Expanded to include more conferences
  {
    id: 'qb1',
    name: 'Caleb Williams',
    position: 'QB',
    team: 'USC',
    conference: 'Pac-12',
    projectedPoints: 22.5,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431611.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
    teamColorPrimary: '#990000',
    teamColorSecondary: '#FFCC00',
    passingYards: 3633,
    passingTDs: 30,
    completions: 310,
    attempts: 496,
    interceptions: 5,
    rushingYards: 382,
    rushingTDs: 6,
  },
  {
    id: 'qb2',
    name: 'Bo Nix',
    position: 'QB',
    team: 'Oregon',
    conference: 'Pac-12',
    projectedPoints: 21.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431890.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
    teamColorPrimary: '#154733',
    teamColorSecondary: '#FEE123',
    passingYards: 4145,
    passingTDs: 45,
    completions: 359,
    attempts: 520,
    interceptions: 3,
    rushingYards: 234,
    rushingTDs: 6,
  },
  {
    id: 'qb3',
    name: 'Michael Penix Jr.',
    position: 'QB',
    team: 'Washington',
    conference: 'Pac-12',
    projectedPoints: 21.2,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4432011.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
    teamColorPrimary: '#4B2E83',
    teamColorSecondary: '#B7A57A',
    passingYards: 4903,
    passingTDs: 36,
    completions: 420,
    attempts: 595,
    interceptions: 9,
    rushingYards: -52,
    rushingTDs: 1,
  },
  // Add SEC QBs
  {
    id: 'qb4',
    name: 'Quinn Ewers',
    position: 'QB',
    team: 'Texas',
    conference: 'SEC',
    projectedPoints: 20.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685529.png',
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
    id: 'qb5',
    name: 'Jayden Daniels',
    position: 'QB',
    team: 'LSU',
    conference: 'SEC',
    projectedPoints: 24.1,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431583.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
    teamColorPrimary: '#461D7C',
    teamColorSecondary: '#FDD023',
    passingYards: 3812,
    passingTDs: 40,
    completions: 327,
    attempts: 527,
    interceptions: 4,
    rushingYards: 1134,
    rushingTDs: 10,
  },
  // Add Big Ten QBs
  {
    id: 'qb6',
    name: 'J.J. McCarthy',
    position: 'QB',
    team: 'Michigan',
    conference: 'Big Ten',
    projectedPoints: 19.5,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431722.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
    teamColorPrimary: '#00274C',
    teamColorSecondary: '#FFCB05',
    passingYards: 2991,
    passingTDs: 22,
    completions: 237,
    attempts: 355,
    interceptions: 4,
    rushingYards: 202,
    rushingTDs: 3,
  },
  // Add ACC QBs
  {
    id: 'qb7',
    name: 'Drake Maye',
    position: 'QB',
    team: 'North Carolina',
    conference: 'ACC',
    projectedPoints: 20.3,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431965.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
    teamColorPrimary: '#13294B',
    teamColorSecondary: '#4B9CD3',
    passingYards: 3608,
    passingTDs: 24,
    completions: 298,
    attempts: 491,
    interceptions: 9,
    rushingYards: 449,
    rushingTDs: 9,
  },
  // Add Group of 5 QBs
  {
    id: 'qb8',
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

  // Running Backs - Expanded across more conferences
  {
    id: 'rb1',
    name: 'Blake Corum',
    position: 'RB',
    team: 'Michigan',
    conference: 'Big Ten',
    projectedPoints: 18.2,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431734.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
    teamColorPrimary: '#00274C',
    teamColorSecondary: '#FFCB05',
    rushingYards: 1245,
    rushingTDs: 27,
    receivingYards: 189,
    receptions: 21,
    receivingTDs: 1,
  },
  {
    id: 'rb2',
    name: 'Bijan Robinson',
    position: 'RB',
    team: 'Texas',
    conference: 'SEC',
    projectedPoints: 19.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431593.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
    teamColorPrimary: '#BF5700',
    teamColorSecondary: '#FFFFFF',
    rushingYards: 1580,
    rushingTDs: 18,
    receivingYards: 314,
    receptions: 25,
    receivingTDs: 2,
  },
  {
    id: 'rb3',
    name: 'Jonathon Brooks',
    position: 'RB',
    team: 'Texas',
    conference: 'SEC',
    projectedPoints: 17.5,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685530.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
    teamColorPrimary: '#BF5700',
    teamColorSecondary: '#FFFFFF',
    rushingYards: 1139,
    rushingTDs: 10,
    receivingYards: 95,
    receptions: 8,
    receivingTDs: 0,
  },
  // Add more RBs from different conferences
  {
    id: 'rb4',
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
    id: 'rb5',
    name: 'Audric Estime',
    position: 'RB',
    team: 'Notre Dame',
    conference: 'Independent',
    projectedPoints: 16.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431879.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
    teamColorPrimary: '#0C2340',
    teamColorSecondary: '#C99700',
    rushingYards: 920,
    rushingTDs: 14,
    receivingYards: 78,
    receptions: 6,
    receivingTDs: 0,
  },

  // Wide Receivers - Expanded across conferences
  {
    id: 'wr1',
    name: 'Marvin Harrison Jr.',
    position: 'WR',
    team: 'Ohio State',
    conference: 'Big Ten',
    projectedPoints: 20.3,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431735.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
    teamColorPrimary: '#CC0000',
    teamColorSecondary: '#000000',
    receivingYards: 1211,
    receptions: 67,
    receivingTDs: 14,
  },
  {
    id: 'wr2',
    name: 'Rome Odunze',
    position: 'WR',
    team: 'Washington',
    conference: 'Pac-12',
    projectedPoints: 19.1,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4432012.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
    teamColorPrimary: '#4B2E83',
    teamColorSecondary: '#B7A57A',
    receivingYards: 1640,
    receptions: 92,
    receivingTDs: 13,
  },
  {
    id: 'wr3',
    name: 'Malik Nabers',
    position: 'WR',
    team: 'LSU',
    conference: 'SEC',
    projectedPoints: 18.7,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431584.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
    teamColorPrimary: '#461D7C',
    teamColorSecondary: '#FDD023',
    receivingYards: 1569,
    receptions: 89,
    receivingTDs: 14,
  },
  // Add more WRs from different conferences
  {
    id: 'wr4',
    name: 'Josh Downs',
    position: 'WR',
    team: 'North Carolina',
    conference: 'ACC',
    projectedPoints: 17.2,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431967.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
    teamColorPrimary: '#13294B',
    teamColorSecondary: '#4B9CD3',
    receivingYards: 1127,
    receptions: 72,
    receivingTDs: 8,
  },
  {
    id: 'wr5',
    name: 'Jordan Addison',
    position: 'WR',
    team: 'USC',
    conference: 'Pac-12',
    projectedPoints: 18.9,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431612.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
    teamColorPrimary: '#990000',
    teamColorSecondary: '#FFCC00',
    receivingYards: 1593,
    receptions: 75,
    receivingTDs: 8,
  },
  {
    id: 'wr6',
    name: 'Rashee Rice',
    position: 'WR',
    team: 'SMU',
    conference: 'American Athletic',
    projectedPoints: 16.4,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685792.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2567.png',
    teamColorPrimary: '#CC0000',
    teamColorSecondary: '#003366',
    receivingYards: 1355,
    receptions: 96,
    receivingTDs: 6,
  },
  // Add Mountain West players
  {
    id: 'wr7',
    name: 'Tory Horton',
    position: 'WR',
    team: 'Colorado State',
    conference: 'Mountain West',
    projectedPoints: 14.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685421.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/36.png',
    teamColorPrimary: '#1E4D2B',
    teamColorSecondary: '#C8B99C',
    receivingYards: 1136,
    receptions: 90,
    receivingTDs: 8,
  },
  // Add Sun Belt players
  {
    id: 'wr8',
    name: 'Kaelon Black',
    position: 'WR',
    team: 'Appalachian State',
    conference: 'Sun Belt',
    projectedPoints: 13.9,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685234.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png',
    teamColorPrimary: '#000000',
    teamColorSecondary: '#FFDD00',
    receivingYards: 987,
    receptions: 65,
    receivingTDs: 7,
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
      teredSamplePlayers = SAMPLE_PLAYERS.filter(samplePlayer => {
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
      
    } catch (error) {
    console.error('Error fetching players from ESPN:', error);
    console.log('Falling back to sample data');
    
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

    const espnConferences = await getESPNConferences();
    console.log(`ESPN conferences loaded: ${espnConferences.length}`, espnConferences);
    
      conferencesCache = espnConferences;
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