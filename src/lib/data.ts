import { Player } from './types';
import { getTeamSchedules, clearScheduleCache } from './schedule-data';
import { ALL_FBS_CONFERENCES } from './season-config';

// Minimal fallback sample data — used only when ESPN API is completely unavailable.
// In production, prefer showing an error state over stale data.
// This tiny fixture ensures the app can render something in dev/offline mode.
export const SAMPLE_PLAYERS: Player[] = [
  // Quarterbacks
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
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431508.png',
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

  // Running Backs
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
  {
    id: 'rb11',
    name: 'Nicholas Singleton',
    position: 'RB',
    team: 'Penn State',
    conference: 'Big Ten',
    projectedPoints: 17.2,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685530.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
    teamColorPrimary: '#041E42',
    teamColorSecondary: '#FFFFFF',
    rushingYards: 1141,
    rushingTDs: 9,
    receivingYards: 189,
    receptions: 18,
    receivingTDs: 1,
  },
  {
    id: 'rb14',
    name: 'Jordan McFadden',
    position: 'RB',
    team: 'Clemson',
    conference: 'ACC',
    projectedPoints: 16.4,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685421.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png',
    teamColorPrimary: '#F56600',
    teamColorSecondary: '#522D80',
    rushingYards: 1089,
    rushingTDs: 12,
    receivingYards: 145,
    receptions: 12,
    receivingTDs: 1,
  },
  {
    id: 'rb15',
    name: 'Sean Tucker',
    position: 'RB',
    team: 'Syracuse',
    conference: 'ACC',
    projectedPoints: 17.6,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4431879.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/183.png',
    teamColorPrimary: '#D44500',
    teamColorSecondary: '#000E54',
    rushingYards: 1496,
    rushingTDs: 12,
    receivingYards: 319,
    receptions: 28,
    receivingTDs: 1,
  },

  // Wide Receivers
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
    id: 'wr17',
    name: 'Jaylen Reed',
    position: 'WR',
    team: 'Michigan State',
    conference: 'Big Ten',
    projectedPoints: 16.8,
    headshotUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/4685421.png',
    teamLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
    teamColorPrimary: '#18453B',
    teamColorSecondary: '#FFFFFF',
    receivingYards: 892,
    receptions: 46,
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

const applyPlayerFilters = (
  players: Player[],
  options?: { specificTeam?: string; specificConference?: string }
) => {
  return players.filter((player) => {
    const teamMatches =
      !options?.specificTeam ||
      options.specificTeam === 'All Teams' ||
      player.team === options.specificTeam;

    const conferenceMatches =
      !options?.specificConference ||
      options.specificConference === 'All Conferences' ||
      player.conference === options.specificConference;

    return teamMatches && conferenceMatches;
  });
};

// Check if cache is valid
const isCacheValid = (timestamp: number) => {
  return Date.now() - timestamp < CACHE_DURATION;
};

/**
 * Annotates players with their team's first bye week from the cached schedules.
 * Failures are non-fatal — bye weeks are advisory, players still render.
 */
const withByeWeeks = async (players: Player[]): Promise<Player[]> => {
  try {
    const schedules = await getTeamSchedules();
    if (schedules.length === 0) return players;

    const byeByTeam = new Map(
      schedules.map(schedule => [schedule.teamName.toLowerCase(), schedule.byeWeeks[0]]),
    );

    return players.map(player => {
      const byeWeek = byeByTeam.get(player.team.toLowerCase());
      return byeWeek ? { ...player, hasByeWeek: true, byeWeek } : { ...player, hasByeWeek: false };
    });
  } catch (error) {
    console.warn('Could not attach bye weeks:', error);
    return players;
  }
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
      console.warn('Cached data has invalid names or is empty, clearing cache for', cacheKey);
      playersCache.delete(cacheKey);
    }
  }

  console.log('Fetching players from /api/players with options:', options);

  try {
    const response = await fetch('/api/players');
    if (!response.ok) {
      throw new Error(`/api/players failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const apiPlayers = Array.isArray(payload)
      ? (payload as Player[])
      : Array.isArray(payload?.players)
        ? (payload.players as Player[])
        : [];

    const filteredApiPlayers = applyPlayerFilters(apiPlayers, options);
    const validApiPlayers = await withByeWeeks(
      filteredApiPlayers.filter(p =>
        p.name &&
        p.name.trim() !== '' &&
        !p.name.includes('undefined') &&
        !p.name.startsWith('Player ')
      )
    );

    if (validApiPlayers.length > 0) {
      playersCache.set(cacheKey, {
        players: validApiPlayers,
        timestamp: Date.now()
      });
      console.log(`Loaded ${validApiPlayers.length} players from /api/players for ${cacheKey}`);
      return validApiPlayers;
    }

    console.warn('/api/players returned no cached players yet. Returning empty result.');
    playersCache.set(cacheKey, {
      players: [],
      timestamp: Date.now()
    });
    return [];
  } catch (error) {
    console.error('Failed to load players from /api/players:', error);
  }

  // Offline/dev fallback only. The server cache is the sole real data source.
  const samplePlayers = applyPlayerFilters(SAMPLE_PLAYERS, options).map(player => ({
    ...player,
    hasByeWeek: Boolean(player.byeWeek),
  }));

  playersCache.set(cacheKey, { players: samplePlayers, timestamp: Date.now() });
  console.warn(`Using ${samplePlayers.length} sample players as fallback`);
  return samplePlayers;
};

// Default fallback conferences — derived from season-config
const DEFAULT_CONFERENCES = [
  'All Conferences', 
  ...ALL_FBS_CONFERENCES,
];

const DEFAULT_TEAMS_FROM_SAMPLE = [
  'All Teams',
  ...Array.from(new Set(SAMPLE_PLAYERS.map(p => p.team))).sort()
];

type CachedTeam = { school: string; conference: string };

let teamDirectoryPromise: Promise<CachedTeam[]> | null = null;

/** Fetches the cached FBS team directory once and shares it between callers. */
const getTeamDirectory = async (): Promise<CachedTeam[]> => {
  if (!teamDirectoryPromise) {
    teamDirectoryPromise = (async () => {
      try {
        const response = await fetch('/api/teams');
        if (!response.ok) throw new Error(`/api/teams failed: ${response.status}`);
        const payload = await response.json();
        const teams = Array.isArray(payload?.teams) ? (payload.teams as CachedTeam[]) : [];
        if (teams.length === 0) throw new Error('/api/teams returned no teams');
        return teams;
      } catch (error) {
        console.warn('Falling back to configured team/conference lists:', error);
        teamDirectoryPromise = null;
        return [];
      }
    })();
  }
  return teamDirectoryPromise;
};

// Get conferences (with caching)
export const getConferences = async (): Promise<string[]> => {
  if (conferencesCache.length > 0 && isCacheValid(cacheTimestamp)) {
    return conferencesCache;
  }

  const teams = await getTeamDirectory();
  const conferences = Array.from(new Set(teams.map(team => team.conference).filter(Boolean))).sort();

  conferencesCache = conferences.length > 0
    ? ['All Conferences', ...conferences]
    : DEFAULT_CONFERENCES;
  cacheTimestamp = Date.now();
  return conferencesCache;
};

// Get teams (with caching)
export const getTeams = async (): Promise<string[]> => {
  if (teamsCache.length > 1 && isCacheValid(cacheTimestamp)) {
    return teamsCache;
  }

  const teams = await getTeamDirectory();
  const schools = Array.from(new Set(teams.map(team => team.school).filter(Boolean))).sort();

  teamsCache = schools.length > 0 ? ['All Teams', ...schools] : DEFAULT_TEAMS_FROM_SAMPLE;
  cacheTimestamp = Date.now();
  return teamsCache;
};

// Clear cache (useful for refreshing data)
export const clearCache = () => {
  playersCache.clear();
  conferencesCache = [];
  teamsCache = [];
  cacheTimestamp = 0;
  clearScheduleCache();
};
