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
    
    if (options?.specificTeam && options.specificTeam !== 'All Teams') {
      apiOptions.specificTeam = options.specificTeam;
    }
    
    if (options?.specificConference && options.specificConference !== 'All Conferences') {
      apiOptions.specificConference = options.specificConference;
    }

// Fetch from ESPN API
    // Fetch from ESPN API
    const allPlayers = await fetchESPNCurrentPlayers(apiOptions);
      p.name && 
    console.log(`ESPN API returned ${allPlayers.length} players`);
      !p.name.startsWith('Player ')
    // Validate that we have good player data
    const validPlayers = allPlayers.filter(p => 
    console.log(`Filtered to ${validPlayers.length} valid players`);
      p.name.trim() !== '' && 
      !p.name.includes('undefined') &&
      // Cache the successful result
      playersCache.set(cacheKey, {
        players: validPlayers,
    console.log(`Filtered to ${validPlayers.length} valid players`);
      return validPlayers;
    if (validPlayers.length > 0) {
      // Cache the successful result
      playersCache.set(cacheKey, {
        players: validPlayers,MPLE_PLAYERS]; // Create a copy to avoid mutations
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
      });S];
      
      return samplePlayers;
    }
  } catch (error) {
    console.error('Error fetching players from ESPN:', error);
    console.log('Falling back to sample data');
    return conferencesCache;
    // Use sample data as fallback
    const samplePlayers = [...SAMPLE_PLAYERS];
  try {
    conferencesCache = await getESPNConferences();
    cacheTimestamp = Date.now();
    return conferencesCache;
  } catch (error) {
    console.error('Failed to fetch conferences from ESPN, using default:', error);
  if (conferencesCache.length > 0 && isCacheValid(cacheTimestamp)) {
  }
};

// Get teams (with caching)
export const getTeams = async (): Promise<string[]> => {
    cacheTimestamp = Date.now();
    return teamsCache;
  }

  try {
    teamsCache = await getESPNTeams();
    cacheTimestamp = Date.now();
    return teamsCache;
  } catch (error) {
    console.error('Failed to fetch teams from ESPN, using default:', error);
  if (teamsCache.length > 0 && isCacheValid(cacheTimestamp)) {
  }
};

// Clear cache (useful for refreshing data)
export const clearCache = () => {
    cacheTimestamp = Date.now();
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
    projectedPoints: 21.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431890.png',
  },
  {
    id: 'qb3',
    name: 'Michael Penix Jr.',
    position: 'QB',
    completions: 359,
    attempts: 520,
    projectedPoints: 21.2,
    rushingYards: 234,adshots/college-football/players/full/4432011.png',
    rushingTDs: 6,om/i/teamlogos/ncaa/500/264.png',
    teamColorPrimary: '#4B2E83',
    teamColorSecondary: '#B7A57A',
    passingYards: 4903,
    name: 'Michael Penix Jr.',
    completions: 420,
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
    rushingYards: -23,adshots/college-football/players/full/4429013.png',
    rushingTDs: 1,com/i/teamlogos/ncaa/500/99.png',
    teamColorPrimary: '#461D7C',
    teamColorSecondary: '#FDD023',
    passingYards: 3812,
    name: 'Jayden Daniels',
    completions: 327,
    team: 'LSU',
    interceptions: 6,
    projectedPoints: 20.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4429013.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
    teamColorPrimary: '#461D7C',
    teamColorSecondary: '#FDD023',
    teamColorSecondary: '#C5C5C5',
    receivingYards: 1211,
    receptions: 67,
    attempts: 475,
  },
  {
    id: 'wr2',
    name: 'Rome Odunze',
    position: 'WR',
    id: 'qb5',
    name: 'Quinn Ewers',
    projectedPoints: 17.8,
    team: 'Texas',/headshots/college-football/players/full/4432011.png',
  'ACC',
    projectedPoints: 20.1,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431455.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
    teamColorPrimary: '#BF5700',
    teamColorSecondary: '#FFFFFF',
    passingYards: 3479,
    passingTDs: 22,
    completions: 264,
    attempts: 398,
    rushingYards: 124,    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431296.png',    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',    teamColorPrimary: '#BF5700',    teamColorSecondary: '#FFFFFF',    id: 'rb2',    name: 'Blake Corum',    projectedPoints: 15.8,    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4432165.png',    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',    teamColorPrimary: '#00274C',    teamColorSecondary: '#FFCB05',    rushingYards: 1463,    receptions: 8,    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4432577.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
    teamColorPrimary: '#BB0000',
    teamColorSecondary: '#C5C5C5',
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4432011.png',    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',    teamColorPrimary: '#4B2E83',    teamColorSecondary: '#B7A57A',    receivingYards: 1640,    receptions: 92,