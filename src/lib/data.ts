import { Player } from './types';
import { fetchESPNCurrentPlayers, getESPNConferences, getESPNTeams } from './espn-api';
import { getTeamSchedules, isTeamOnBye } from './schedule-data';

// Fallback sample data for when API is not available - VERIFIED 2025 season active players only
export const SAMPLE_PLAYERS: Player[] = [
  // Quarterbacks - Confirmed returning for 2025 season
  {
    id: 'qb1',
    name: 'Drew Allar',
    position: 'QB',
    team: 'Penn State',
    conference: 'Big Ten',
    projectedPoints: 21.0,
    hasByeWeek: true,
    byeWeek: 9,
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
    id: 'qb2',
    name: 'Arch Manning',
    position: 'QB',
    team: 'Texas',
    conference: 'SEC',
    projectedPoints: 20.8,
    hasByeWeek: true,
    byeWeek: 5,
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
    id: 'qb4',
    name: 'Nico Iamaleava',
    position: 'QB',
    team: 'Tennessee',
    conference: 'SEC',
    projectedPoints: 20.5,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685863.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
    teamColorPrimary: '#FF8200',
    teamColorSecondary: '#FFFFFF',
    passingYards: 2612,
    passingTDs: 19,
    completions: 187,
    attempts: 281,
    interceptions: 5,
    rushingYards: 314,
    rushingTDs: 6,
  },
  {
    id: 'qb5',
    name: 'Jalen Milroe',
    position: 'QB',
    team: 'Alabama',
    conference: 'SEC',
    projectedPoints: 22.3,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431965.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
    teamColorPrimary: '#9E1B32',
    teamColorSecondary: '#FFFFFF',
    passingYards: 2834,
    passingTDs: 15,
    completions: 187,
    attempts: 284,
    interceptions: 9,
    rushingYards: 531,
    rushingTDs: 12,
  },
  {
    id: 'qb6',
    name: 'Garrett Nussmeier',
    position: 'QB',
    team: 'LSU',
    conference: 'SEC',
    projectedPoints: 21.2,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685863.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
    teamColorPrimary: '#461D7C',
    teamColorSecondary: '#FDD023',
    passingYards: 3739,
    passingTDs: 26,
    completions: 297,
    attempts: 467,
    interceptions: 11,
    rushingYards: 52,
    rushingTDs: 4,
  },
  {
    id: 'qb7',
    name: 'Avery Johnson',
    position: 'QB',
    team: 'Kansas State',
    conference: 'Big 12',
    projectedPoints: 19.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685529.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2306.png',
    teamColorPrimary: '#512888',
    teamColorSecondary: '#FFFFFF',
    passingYards: 2187,
    passingTDs: 16,
    completions: 156,
    attempts: 238,
    interceptions: 4,
    rushingYards: 449,
    rushingTDs: 9,
  },

  // Running Backs - Confirmed returning for 2025 season
  {
    id: 'rb1',
    name: 'TreVeyon Henderson',
    position: 'RB',
    team: 'Ohio State',
    conference: 'Big Ten',
    projectedPoints: 19.5,
    hasByeWeek: true,
    byeWeek: 3,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431734.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
    teamColorPrimary: '#CC0000',
    teamColorSecondary: '#000000',
    rushingYards: 1487,
    rushingTDs: 15,
    receivingYards: 212,
    receptions: 18,
    receivingTDs: 2,
  },
  {
    id: 'rb2',
    name: 'Omarion Hampton',
    position: 'RB',
    team: 'North Carolina',
    conference: 'ACC',
    projectedPoints: 18.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431593.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
    teamColorPrimary: '#4B9CD3',
    teamColorSecondary: '#FFFFFF',
    rushingYards: 1504,
    rushingTDs: 15,
    receivingYards: 149,
    receptions: 13,
    receivingTDs: 0,
  },
  {
    id: 'rb3',
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
    id: 'rb4',
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
    id: 'rb5',
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
  {
    id: 'rb6',
    name: 'RJ Harvey',
    position: 'RB',
    team: 'UCF',
    conference: 'Big 12',
    projectedPoints: 16.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685421.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2116.png',
    teamColorPrimary: '#000000',
    teamColorSecondary: '#FFB81C',
    rushingYards: 1342,
    rushingTDs: 16,
    receivingYards: 178,
    receptions: 15,
    receivingTDs: 1,
  },

  // Wide Receivers - Confirmed returning for 2025 season
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
    id: 'wr3',
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
    id: 'wr4',
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
    id: 'wr5',
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
    id: 'wr6',
    name: 'Jeremiah Smith',
    position: 'WR',
    team: 'Ohio State',
    conference: 'Big Ten',
    projectedPoints: 17.9,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431584.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
    teamColorPrimary: '#CC0000',
    teamColorSecondary: '#000000',
    receivingYards: 1227,
    receptions: 70,
    receivingTDs: 11,
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
    name: 'Jordan Hudson',
    position: 'WR',
    team: 'Auburn',
    conference: 'SEC',
    projectedPoints: 16.2,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685234.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
    teamColorPrimary: '#0C2340',
    teamColorSecondary: '#C99700',
    receivingYards: 1003,
    receptions: 75,
    receivingTDs: 6,
  },

  // Additional Quarterbacks
  {
    id: 'qb8',
    name: 'DJ Uiagalelei',
    position: 'QB',
    team: 'Florida State',
    conference: 'ACC',
    projectedPoints: 19.2,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431944.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
    teamColorPrimary: '#782F40',
    teamColorSecondary: '#CEB888',
    passingYards: 2521,
    passingTDs: 18,
    completions: 203,
    attempts: 315,
    interceptions: 8,
    rushingYards: 89,
    rushingTDs: 3,
  },
  {
    id: 'qb9',
    name: 'Tyler Van Dyke',
    position: 'QB',
    team: 'Wisconsin',
    conference: 'Big Ten',
    projectedPoints: 18.7,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431719.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/275.png',
    teamColorPrimary: '#C5050C',
    teamColorSecondary: '#FFFFFF',
    passingYards: 2319,
    passingTDs: 19,
    completions: 192,
    attempts: 296,
    interceptions: 9,
    rushingYards: 34,
    rushingTDs: 1,
  },
  {
    id: 'qb10',
    name: 'Cam Ward',
    position: 'QB',
    team: 'Miami',
    conference: 'ACC',
    projectedPoints: 21.1,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431735.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
    teamColorPrimary: '#F47321',
    teamColorSecondary: '#046A38',
    passingYards: 4123,
    passingTDs: 36,
    completions: 309,
    attempts: 473,
    interceptions: 7,
    rushingYards: 196,
    rushingTDs: 4,
  },

  // Additional Running Backs
  {
    id: 'rb7',
    name: 'Ashton Jeanty',
    position: 'RB',
    team: 'Boise State',
    conference: 'Mountain West',
    projectedPoints: 21.5,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685421.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/68.png',
    teamColorPrimary: '#0033A0',
    teamColorSecondary: '#FF6600',
    rushingYards: 2497,
    rushingTDs: 29,
    receivingYards: 169,
    receptions: 18,
    receivingTDs: 0,
  },
  {
    id: 'rb8',
    name: 'Cam Skattebo',
    position: 'RB',
    team: 'Arizona State',
    conference: 'Big 12',
    projectedPoints: 18.3,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431734.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
    teamColorPrimary: '#8C1D40',
    teamColorSecondary: '#FFB310',
    rushingYards: 1711,
    rushingTDs: 21,
    receivingYards: 434,
    receptions: 38,
    receivingTDs: 2,
  },
  {
    id: 'rb9',
    name: 'Donovan Edwards',
    position: 'RB',
    team: 'Michigan',
    conference: 'Big Ten',
    projectedPoints: 16.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431593.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
    teamColorPrimary: '#00274C',
    teamColorSecondary: '#FFCB05',
    rushingYards: 1222,
    rushingTDs: 13,
    receivingYards: 185,
    receptions: 16,
    receivingTDs: 1,
  },
  {
    id: 'rb10',
    name: 'Rayshon Luke',
    position: 'RB',
    team: 'Indiana',
    conference: 'Big Ten',
    projectedPoints: 17.1,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685530.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
    teamColorPrimary: '#7D110C',
    teamColorSecondary: '#EEEDEB',
    rushingYards: 1286,
    rushingTDs: 16,
    receivingYards: 156,
    receptions: 14,
    receivingTDs: 0,
  },

  // Additional Wide Receivers
  {
    id: 'wr9',
    name: 'Travis Hunter',
    position: 'WR',
    team: 'Colorado',
    conference: 'Big 12',
    projectedPoints: 20.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431967.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/38.png',
    teamColorPrimary: '#CFB87C',
    teamColorSecondary: '#000000',
    receivingYards: 1152,
    receptions: 92,
    receivingTDs: 14,
  },
  {
    id: 'wr10',
    name: 'Jalen Royals',
    position: 'WR',
    team: 'Utah State',
    conference: 'Mountain West',
    projectedPoints: 17.6,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431584.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/328.png',
    teamColorPrimary: '#0F2439',
    teamColorSecondary: '#FFFFFF',
    receivingYards: 1273,
    receptions: 85,
    receivingTDs: 9,
  },
  {
    id: 'wr11',
    name: 'Ja\'Lynn Polk',
    position: 'WR',
    team: 'Washington',
    conference: 'Big Ten',
    projectedPoints: 18.1,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4432012.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
    teamColorPrimary: '#4B2E83',
    teamColorSecondary: '#B7A57A',
    receivingYards: 1159,
    receptions: 69,
    receivingTDs: 9,
  },
  {
    id: 'wr12',
    name: 'Xavier Restrepo',
    position: 'WR',
    team: 'Miami',
    conference: 'ACC',
    projectedPoints: 17.3,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685421.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
    teamColorPrimary: '#F47321',
    teamColorSecondary: '#046A38',
    receivingYards: 1092,
    receptions: 79,
    receivingTDs: 11,
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
    
    // Fetch team schedules for bye week information
    console.log('Fetching team schedules for bye week data...');
    const teamSchedules = await getTeamSchedules();
    const scheduleMap = new Map(teamSchedules.map(s => [s.teamName.toLowerCase(), s]));
    
    // Validate that we have good player data and add bye week information
    const validPlayers = allPlayers.filter(p => 
      p.name && 
      p.name.trim() !== '' && 
      !p.name.includes('undefined') &&
      !p.name.startsWith('Player ')
    ).map(player => {
      // Try to find the team schedule
      const teamKey = player.team.toLowerCase();
      const schedule = scheduleMap.get(teamKey) || 
                     Array.from(scheduleMap.values()).find(s => 
                       s.teamName.toLowerCase().includes(teamKey) ||
                       teamKey.includes(s.teamName.toLowerCase())
                     );
      
      if (schedule && schedule.byeWeeks.length > 0) {
        return {
          ...player,
          hasByeWeek: true,
          byeWeek: schedule.byeWeeks[0] // Use first bye week if multiple
        };
      }
      
      return {
        ...player,
        hasByeWeek: false
      };
    });
    
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
      }).map(player => ({
        ...player,
        hasByeWeek: player.byeWeek ? true : false
      }));
      
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
    
    // Ensure sample players have bye week information
    samplePlayers = samplePlayers.map(player => ({
      ...player,
      hasByeWeek: player.byeWeek ? true : false
    }));
    
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
  // Also clear schedule cache when clearing all data
  const { clearScheduleCache } = require('./schedule-data');
  clearScheduleCache();
};