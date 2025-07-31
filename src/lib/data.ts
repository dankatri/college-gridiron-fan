import { Player } from './types';
import { fetchESPNCurrentPlayers, getESPNConferences, getESPNTeams } from './espn-api';

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
    if (hasValidNames) {
      console.log(`Using cached players for ${cacheKey}:`, cachedData.players.length);
      return cachedData.players;
    } else {
      console.warn('Cached data has invalid names, clearing cache for', cacheKey);
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
    
    if (validPlayers.length > 0) {
      // Cache the successful result
      playersCache.set(cacheKey, {
        players: validPlayers,
        timestamp: Date.now()
      });
      
      console.log(`Successfully cached ${validPlayers.length} players for ${cacheKey}`);
      return validPlayers;
    } else {
      console.warn('No valid players returned from ESPN API, falling back to sample data');
      // Fall back to sample data
      const samplePlayers = [...SAMPLE_PLAYERS]; // Create a copy to avoid mutations
      
      playersCache.set(cacheKey, {
        players: samplePlayers,
        timestamp: Date.now()
      });
      
      return samplePlayers;
    }
  } catch (error) {
    console.error('Error fetching players from ESPN:', error);
    console.log('Falling back to sample data');
    
    // Use sample data as fallback
    const samplePlayers = [...SAMPLE_PLAYERS];
    return samplePlayers;
  }
};

// Get conferences (with caching)
export const getConferences = async (): Promise<string[]> => {
  if (conferencesCache.length > 0 && isCacheValid(cacheTimestamp)) {
    return conferencesCache;
  }

  try {
    conferencesCache = await getESPNConferences();
    cacheTimestamp = Date.now();
    return conferencesCache;
  } catch (error) {
    console.error('Failed to fetch conferences from ESPN, using default:', error);
    return CONFERENCES;
  }
};

// Get teams (with caching)
export const getTeams = async (): Promise<string[]> => {
  if (teamsCache.length > 0 && isCacheValid(cacheTimestamp)) {
    return teamsCache;
  }

  try {
    teamsCache = await getESPNTeams();
    cacheTimestamp = Date.now();
    return teamsCache;
  } catch (error) {
    console.error('Failed to fetch teams from ESPN, using default:', error);
    return TEAMS;
  }
};

// Clear cache (useful for refreshing data)
export const clearCache = () => {
  console.log('Clearing player data cache');
  playersCache.clear();
  conferencesCache = [];
  teamsCache = [];
  cacheTimestamp = 0;
};

// Fallback sample data for when API is not available
export const SAMPLE_PLAYERS: Player[] = [
  // Quarterbacks - Top Tier
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
    attempts: 586,
    interceptions: 9,
    rushingYards: -23,
    rushingTDs: 1,
  },
  {
    id: 'qb4',
    name: 'Jayden Daniels',
    position: 'QB',
    team: 'LSU',
    conference: 'SEC',
    projectedPoints: 20.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4429013.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
    teamColorPrimary: '#461D7C',
    teamColorSecondary: '#FDD023',
    passingYards: 3812,
    passingTDs: 40,
    completions: 327,
    attempts: 475,
    interceptions: 4,
    rushingYards: 1134,
    rushingTDs: 10,
  },
  {
    id: 'qb5',
    name: 'Quinn Ewers',
    position: 'QB',
    team: 'Texas',
    conference: 'Big 12',
    projectedPoints: 20.1,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431455.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
    teamColorPrimary: '#BF5700',
    teamColorSecondary: '#FFFFFF',
    passingYards: 3479,
    passingTDs: 22,
    completions: 264,
    attempts: 398,
    interceptions: 6,
    rushingYards: 124,
    rushingTDs: 4,
  },

  // Running Backs - Top Tier
  {
    id: 'rb1',
    name: 'Bijan Robinson',
    position: 'RB',
    team: 'Texas',
    conference: 'Big 12',
    projectedPoints: 16.2,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431296.png',
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
    id: 'rb2',
    name: 'Blake Corum',
    position: 'RB',
    team: 'Michigan',
    conference: 'Big Ten',
    projectedPoints: 15.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4432165.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
    teamColorPrimary: '#00274C',
    teamColorSecondary: '#FFCB05',
    rushingYards: 1463,
    rushingTDs: 18,
    receivingYards: 89,
    receptions: 8,
    receivingTDs: 0,
  },

  // Wide Receivers - Top Tier
  {
    id: 'wr1',
    name: 'Marvin Harrison Jr.',
    position: 'WR',
    team: 'Ohio State',
    conference: 'Big Ten',
    projectedPoints: 18.3,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4432577.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
    teamColorPrimary: '#BB0000',
    teamColorSecondary: '#C5C5C5',
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
    projectedPoints: 17.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4432011.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
    teamColorPrimary: '#4B2E83',
    teamColorSecondary: '#B7A57A',
    receivingYards: 1640,
    receptions: 92,
    receivingTDs: 13,
  },
];

// Conference lists for filtering
export const CONFERENCES = [
  'All Conferences',
  'SEC',
  'Big Ten',
  'Big 12',
  'ACC',
  'Pac-12',
  'AAC',
  'Independent',
  'Mountain West',
  'Sun Belt',
  'MAC',
  'C-USA',
  'FCS'
];

// Team lists for filtering
export const TEAMS = [
  'All Teams',
  // SEC
  'Alabama', 'Auburn', 'Florida', 'Georgia', 'LSU', 'Tennessee', 'Texas A&M', 'South Carolina', 'Kentucky', 'Arkansas',
  // Big Ten
  'Michigan', 'Ohio State', 'Michigan State', 'Illinois', 'Maryland', 'Penn State', 'Iowa', 'Wisconsin', 'Purdue',
  // Big 12
  'Texas', 'Oklahoma', 'TCU', 'Kansas State', 'UCF', 'Oklahoma State', 'Iowa State', 'Baylor', 'West Virginia',
  // ACC
  'Florida State', 'Miami', 'UNC', 'Pittsburgh', 'Syracuse', 'Georgia Tech', 'Louisville', 'Boston College', 'Clemson',
  // Pac-12
  'USC', 'Oregon', 'Washington', 'UCLA', 'Colorado', 'Utah', 'Oregon State', 'Stanford', 'Arizona State', 'Washington State',
  // AAC
  'Cincinnati', 'Tulane', 'Memphis', 'Tulsa',
  // Independent
  'BYU', 'Notre Dame',
  // Mountain West
  'Fresno State', 'Colorado State', 'Nevada', 'Boise State',
  // Sun Belt
  'Coastal Carolina',
  // MAC
  'Western Michigan',
  // C-USA
  'UTSA',
  // FCS
  'North Dakota State'
];