import { sql } from 'drizzle-orm';
import { MAJOR_PROGRAMS, SEASON_YEAR, WEEK_START_DATES } from '../../src/lib/season-config';
import { db } from '../../src/server/db';
import { dataCache } from '../../src/server/schema';
import pLimit from 'p-limit';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

const CACHE_KEY = `schedules-${SEASON_YEAR}`;
const ESPN_SCHEDULE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams';

type GameInfo = {
  week: number;
  date: string;
  opponent: string;
  isHomeGame: boolean;
  isByeWeek: false;
};

type ByeWeekInfo = {
  week: number;
  isByeWeek: true;
};

type TeamSchedule = {
  teamId: string;
  teamName: string;
  conference: string;
  games: (GameInfo | ByeWeekInfo)[];
  byeWeeks: number[];
};

const getAuthToken = (authHeader: string | null): string | null => {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
};

async function fetchTeamSchedule(
  teamId: string,
  teamName: string,
  conference: string,
): Promise<TeamSchedule> {
  // Use the scoreboard approach: fetch each week's games for this team
  // But simpler: use the team schedule endpoint with current season
  const url = `${ESPN_SCHEDULE_URL}/${teamId}/schedule`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`Schedule fetch failed for ${teamName}: ${resp.status}`);
      return { teamId, teamName, conference, games: [], byeWeeks: [] };
    }

    const data = await resp.json();
    const events = data.events || [];
    const games: (GameInfo | ByeWeekInfo)[] = [];
    const scheduledWeeks = new Set<number>();

    for (const event of events) {
      const week = event.week?.number;
      if (!week || week > 18) continue;

      scheduledWeeks.add(week);
      const comps = event.competitions?.[0];
      if (!comps) continue;

      const homeTeam = comps.competitors?.find((c: any) => c.homeAway === 'home');
      const awayTeam = comps.competitors?.find((c: any) => c.homeAway === 'away');
      const isHome = homeTeam?.team?.id === teamId;
      const opponent = isHome
        ? awayTeam?.team?.displayName || 'TBD'
        : homeTeam?.team?.displayName || 'TBD';

      games.push({
        week,
        date: event.date || '',
        opponent,
        isHomeGame: isHome,
        isByeWeek: false as const,
      });
    }

    // If the team schedule endpoint returned no events, try scoreboard approach
    if (games.length === 0) {
      // Fallback: we'll let the schedule be empty for now
      console.log(`No schedule events for ${teamName} (${teamId}), may not be published yet`);
    }

    // Identify bye weeks (regular season weeks 1-14 without games)
    const byeWeeks: number[] = [];
    for (let w = 1; w <= 14; w++) {
      if (!scheduledWeeks.has(w)) {
        byeWeeks.push(w);
        games.push({ week: w, isByeWeek: true as const });
      }
    }

    games.sort((a, b) => a.week - b.week);

    return { teamId, teamName, conference, games, byeWeeks };
  } catch (error) {
    console.error(`Error fetching schedule for ${teamName}:`, error);
    return { teamId, teamName, conference, games: [], byeWeeks: [] };
  }
}

export default async function handler(request: Request): Promise<Response> {
  const startedAt = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  const token = getAuthToken(request.headers.get('authorization'));

  if (!cronSecret || !token || token !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build team list from config
  const teams: { id: string; name: string; conference: string }[] = [];
  for (const [conf, confTeams] of Object.entries(MAJOR_PROGRAMS)) {
    for (const [name, id] of Object.entries(confTeams)) {
      teams.push({ id, name, conference: conf });
    }
  }

  console.log(`[cron/refresh-schedules] Fetching schedules for ${teams.length} teams`);

  const limiter = pLimit(8);
  const schedules = await Promise.all(
    teams.map((t) => limiter(() => fetchTeamSchedule(t.id, t.name, t.conference))),
  );

  const teamsWithGames = schedules.filter((s) => s.games.length > 0).length;

  // Store in cache
  await db
    .insert(dataCache)
    .values({ key: CACHE_KEY, data: schedules })
    .onConflictDoUpdate({
      target: dataCache.key,
      set: { data: schedules, updatedAt: sql`now()` },
    });

  const durationMs = Date.now() - startedAt;
  console.log(`[cron/refresh-schedules] Done: ${teamsWithGames}/${teams.length} teams with games, ${durationMs}ms`);

  return new Response(
    JSON.stringify({ ok: true, teams: teams.length, teamsWithGames, durationMs }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
