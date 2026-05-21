import { TeamSchedule, WeeklyGame } from './types';
import { SEASON_YEAR } from './season-config';

// Cache for team schedules
let scheduleCache: Map<string, TeamSchedule> = new Map();
let cacheTimestamp: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Clear the schedule cache to force fresh data
 */
export function clearScheduleCache() {
  scheduleCache.clear();
  cacheTimestamp = 0;
  console.log('Schedule cache cleared');
}

/**
 * Check if schedule cache is valid
 */
function isScheduleCacheValid(): boolean {
  return Date.now() - cacheTimestamp < CACHE_DURATION;
}

/**
 * Fetch team schedules from ESPN College Football API
 */
export async function getTeamSchedules(): Promise<TeamSchedule[]> {
  if (scheduleCache.size > 0 && isScheduleCacheValid()) {
    console.log('Using cached schedule data');
    return Array.from(scheduleCache.values());
  }

  try {
    console.log('Fetching fresh schedule data from ESPN...');
    
    const teamsResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=1000');
    
    if (!teamsResponse.ok) {
      throw new Error(`ESPN teams API error: ${teamsResponse.status}`);
    }

    const teamsData = await teamsResponse.json();
    const schedules: TeamSchedule[] = [];

    // Process each team to get their schedule
    for (const team of teamsData.sports[0].leagues[0].teams.slice(0, 50)) { // Limit for performance
      try {
        const teamId = team.team.id;
        const teamName = team.team.displayName;
        const conference = team.team.conferenceId || 'Independent';

        // Fetch schedule for this specific team
        const scheduleResponse = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${teamId}/schedule?season=${SEASON_YEAR}`
        );

        if (scheduleResponse.ok) {
          const scheduleData = await scheduleResponse.json();
          const weeklyGames: WeeklyGame[] = [];
          const byeWeeks: number[] = [];

          // Create a map of all weeks (1-15)
          const allWeeks = Array.from({ length: 15 }, (_, i) => i + 1);
          const scheduledWeeks = new Set<number>();

          // Process scheduled games
          if (scheduleData.events) {
            for (const event of scheduleData.events) {
              const week = event.week?.number;
              if (week && week <= 15) {
                scheduledWeeks.add(week);
                
                const homeTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
                const awayTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
                const isHomeGame = homeTeam?.team.id === teamId;
                const opponent = isHomeGame ? awayTeam?.team.displayName : homeTeam?.team.displayName;

                weeklyGames.push({
                  week,
                  opponent,
                  isHomeGame,
                  gameDate: new Date(event.date),
                  isByeWeek: false,
                  gameId: event.id
                });
              }
            }
          }

          // Identify bye weeks (weeks without scheduled games)
          for (const week of allWeeks) {
            if (!scheduledWeeks.has(week)) {
              byeWeeks.push(week);
              weeklyGames.push({
                week,
                isHomeGame: false,
                isByeWeek: true
              });
            }
          }

          // Sort weekly games by week
          weeklyGames.sort((a, b) => a.week - b.week);

          const teamSchedule: TeamSchedule = {
            teamId,
            teamName,
            conference,
            weeklyGames,
            byeWeeks
          };

          schedules.push(teamSchedule);
          scheduleCache.set(teamId, teamSchedule);
        }
      } catch (error) {
        console.warn(`Failed to fetch schedule for team ${team.team.displayName}:`, error);
      }
    }

    cacheTimestamp = Date.now();
    console.log(`Loaded schedules for ${schedules.length} teams`);
    return schedules;

  } catch (error) {
    console.error('Failed to fetch team schedules:', error);
    
    // Return sample schedule data for development
    const sampleSchedules: TeamSchedule[] = [
      {
        teamId: 'georgia',
        teamName: 'Georgia Bulldogs',
        conference: 'SEC',
        weeklyGames: [
          { week: 1, opponent: 'Clemson Tigers', isHomeGame: false, isByeWeek: false },
          { week: 2, opponent: 'Tennessee Tech', isHomeGame: true, isByeWeek: false },
          { week: 3, isByeWeek: true, isHomeGame: false },
          { week: 4, opponent: 'Alabama Crimson Tide', isHomeGame: true, isByeWeek: false },
          // ... more weeks
        ],
        byeWeeks: [3, 9]
      },
      {
        teamId: 'alabama',
        teamName: 'Alabama Crimson Tide',
        conference: 'SEC',
        weeklyGames: [
          { week: 1, opponent: 'Western Kentucky', isHomeGame: true, isByeWeek: false },
          { week: 2, opponent: 'South Florida', isHomeGame: true, isByeWeek: false },
          { week: 3, opponent: 'Wisconsin Badgers', isHomeGame: false, isByeWeek: false },
          { week: 4, opponent: 'Georgia Bulldogs', isHomeGame: false, isByeWeek: false },
          { week: 5, isByeWeek: true, isHomeGame: false },
        ],
        byeWeeks: [5, 11]
      }
    ];

    // Cache the sample data
    for (const schedule of sampleSchedules) {
      scheduleCache.set(schedule.teamId, schedule);
    }
    cacheTimestamp = Date.now();

    return sampleSchedules;
  }
}

/**
 * Get schedule for a specific team
 */
export async function getTeamSchedule(teamName: string): Promise<TeamSchedule | null> {
  const schedules = await getTeamSchedules();
  return schedules.find(s => 
    s.teamName.toLowerCase().includes(teamName.toLowerCase()) ||
    teamName.toLowerCase().includes(s.teamName.toLowerCase())
  ) || null;
}

/**
 * Check if a team has a bye week in a specific week
 */
export async function isTeamOnBye(teamName: string, week: number): Promise<boolean> {
  const schedule = await getTeamSchedule(teamName);
  return schedule?.byeWeeks.includes(week) || false;
}

/**
 * Get all teams on bye for a specific week
 */
export async function getTeamsOnBye(week: number): Promise<string[]> {
  const schedules = await getTeamSchedules();
  return schedules
    .filter(schedule => schedule.byeWeeks.includes(week))
    .map(schedule => schedule.teamName);
}

/**
 * Get opponent for a team in a specific week
 */
export async function getTeamOpponent(teamName: string, week: number): Promise<string | null> {
  const schedule = await getTeamSchedule(teamName);
  const weekGame = schedule?.weeklyGames.find(game => game.week === week);
  return weekGame?.opponent || null;
}