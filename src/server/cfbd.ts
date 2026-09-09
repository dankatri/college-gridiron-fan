/**
 * College Football Data (CFBD) API client.
 *
 * SERVER-ONLY. The CFBD API key must never reach the browser bundle — see
 * https://api.collegefootballdata.com/authentication. Import this from the
 * refresh scripts or from `api/` handlers, never from `src/lib` or components.
 */

const CFBD_BASE_URL = 'https://api.collegefootballdata.com';

export type CfbdTeam = {
  id: number;
  school: string;
  mascot: string | null;
  abbreviation: string | null;
  conference: string | null;
  classification: string | null;
  color: string | null;
  alternateColor: string | null;
  logos: string[] | null;
};

export type CfbdRosterPlayer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  team: string;
  position: string | null;
  jersey: number | null;
  year: number | null;
};

export type CfbdSeasonStat = {
  season: number;
  playerId: string;
  player: string;
  position: string | null;
  team: string;
  conference: string | null;
  category: string;
  statType: string;
  stat: string;
};

export type CfbdGame = {
  id: number;
  season: number;
  week: number;
  seasonType: string;
  startDate: string | null;
  startTimeTBD: boolean | null;
  completed: boolean | null;
  neutralSite: boolean | null;
  homeId: number;
  homeTeam: string;
  homeConference: string | null;
  homePoints: number | null;
  awayId: number;
  awayTeam: string;
  awayConference: string | null;
  awayPoints: number | null;
};

export type CfbdCalendarWeek = {
  season: number;
  week: number;
  seasonType: string;
  startDate: string;
  endDate: string;
};

export type CfbdGamePlayers = {
  id: number;
  teams: {
    team: string;
    conference: string | null;
    homeAway: string;
    points: number | null;
    categories: {
      name: string;
      types: {
        name: string;
        athletes: { id: string; name: string; stat: string }[];
      }[];
    }[];
  }[];
};

function getApiKey(): string {
  const key = process.env.CFBD_API_KEY;
  if (!key) {
    throw new Error('CFBD_API_KEY is not configured');
  }
  return key;
}

/**
 * CFBD responses are cached server-side: a cold call can take 30s while a warm
 * one takes 3-8s. Retries use a generous timeout rather than failing fast.
 */
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 3;
let requestCount = 0;
export const getCfbdRequestCount = () => requestCount;

export async function cfbdFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${CFBD_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const authHeader = `Bearer ${getApiKey()}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      requestCount++;
      const response = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status === 401) {
        throw new Error('CFBD rejected the API key (401). Check CFBD_API_KEY.');
      }
      if (response.status === 429) {
        throw new Error('CFBD rate limit reached (429).');
      }
      if (!response.ok) {
        throw new Error(`CFBD ${path} failed: ${response.status} ${await response.text().catch(() => '')}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      // A bad key or quota failure will not resolve itself; stop retrying.
      if (error instanceof Error && /401|429/.test(error.message)) throw error;
      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = 2_000 * attempt;
        console.warn(`[cfbd] ${path} attempt ${attempt} failed, retrying in ${backoffMs}ms`, error);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`CFBD ${path} failed`);
}

export const getFbsTeams = (year: number) => cfbdFetch<CfbdTeam[]>('/teams/fbs', { year });

export const getRoster = (year: number, team?: string) =>
  cfbdFetch<CfbdRosterPlayer[]>('/roster', { year, team });

export const getSeasonStats = (year: number, category: string) =>
  cfbdFetch<CfbdSeasonStat[]>('/stats/player/season', { year, category });

export const getGames = (year: number, seasonType = 'both') =>
  cfbdFetch<CfbdGame[]>('/games', { year, seasonType, classification: 'fbs' });

/**
 * Games across every division. Needed when counting a team's completed games in
 * a season where it was still FCS (teams promoted to FBS since then would
 * otherwise have a silently truncated count, inflating per-game projections).
 */
export const getAllDivisionGames = (year: number, seasonType = 'both') =>
  cfbdFetch<CfbdGame[]>('/games', { year, seasonType });

export const getCalendar = (year: number) => cfbdFetch<CfbdCalendarWeek[]>('/calendar', { year });

export const getGamePlayerStats = (year: number, week: number, seasonType = 'regular') =>
  cfbdFetch<CfbdGamePlayers[]>('/games/players', { year, week, seasonType, classification: 'fbs' });
