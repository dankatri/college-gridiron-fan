import type { Page } from '@playwright/test';
import type { Player } from '../../src/lib/types';
import { SEASON_STAT_FIELDS, seasonPlayerStatsSchema, type SeasonPlayerStats, type SeasonStatsPayload } from '../../src/lib/season-stats';

export function actualStats(playerId: string, overrides: Partial<SeasonPlayerStats> = {}): SeasonPlayerStats {
  return seasonPlayerStatsSchema.parse({
    playerId, ...Object.fromEntries(SEASON_STAT_FIELDS.map(field => [field, 0])), ...overrides,
  });
}

export const now = '2026-09-07T12:00:00.000Z';
export const teamLogo = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path fill="#123abc" d="M2 2h20v20H2z"/></svg>',
)}`;
export const user = { id: 'test-user', displayName: 'Test Member', email: 'member@example.test', hasPasskey: true };
export const league = {
  id: 'league-a', name: 'Test League', ownerId: user.id, ownerName: user.displayName,
  season: 2026, maxMembers: 20, isPublic: false, allowLateJoins: true,
  createdAt: now, joinedAt: now, memberCount: 2, members: [
    { userId: user.id, displayName: user.displayName, joinedAt: now, role: 'owner' },
    { userId: 'other-user', displayName: 'Other Member', joinedAt: now, role: 'member' },
  ],
};

export const players: Player[] = [
  { id: 'qb-finished', name: 'Alex Finished', position: 'QB', team: 'Completed University', conference: 'East', projectedPoints: 22, passingYards: 200, passingTDs: 2 },
  { id: 'qb-future', name: 'Jamie Quarterback', position: 'QB', team: 'Future University', conference: 'West', projectedPoints: 21, passingYards: 250, passingTDs: 1 },
  { id: 'qb-other', name: 'Casey Walker Jr.', position: 'QB', team: 'Other University', conference: 'West', projectedPoints: 19, passingYards: 90, passingTDs: 0 },
  { id: 'rb-future', name: 'Robin Runner', position: 'RB', team: 'Future University', conference: 'West', projectedPoints: 15, rushingYards: 100, rushingTDs: 2 },
  { id: 'rb-other', name: 'Taylor Runner', position: 'RB', team: 'Other University', conference: 'West', projectedPoints: 14, rushingYards: 80, rushingTDs: 1 },
  { id: 'wr-future', name: 'Sam Receiver', position: 'WR', team: 'Future University', conference: 'West', projectedPoints: 12, receivingYards: 100, receptions: 6 },
  { id: 'wr-other', name: 'Drew Receiver', position: 'WR', team: 'Other University', conference: 'West', projectedPoints: 11, receivingYards: 90, receptions: 5 },
];

export function slots(playerId = 'qb-finished') {
  return ['QB', 'QB', 'RB', 'RB', 'WR', 'WR'].map((position, slotIndex) => ({
    position, slotIndex, playerId: slotIndex === 0 ? playerId : null,
  }));
}

export const lineup = {
  id: 'saved-lineup', week: 1, season: 2026, slots: slots(),
  projectedPoints: '22', actualPoints: null, lockedAt: null,
};

export const schedules = [...new Set(players.map(player => player.team))].map((teamName, index) => ({
  teamId: `team-${index}`, teamName, conference: index === 0 ? 'East' : 'West', byeWeeks: [0],
  weeklyGames: [{
    week: 1, gameId: `game-${index}`, isHomeGame: true, isByeWeek: false,
    opponent: `Opponent ${index}`, gameDate: index === 0 ? '2026-09-05T18:00:00.000Z' : '2026-09-07T23:00:00.000Z',
    isCompleted: index === 0, ...(index === 0 ? { teamPoints: 31, opponentPoints: 14 } : {}),
  }],
}));

export const live = {
  week: 1, updatedAt: now, stats: [{
    playerId: 'qb-finished', week: 1, passingYards: 200, passingTDs: 2, completions: 20,
    attempts: 30, interceptions: 0, rushingYards: 0, rushingTDs: 0, receivingYards: 0,
    receptions: 0, receivingTDs: 0, kickReturnYards: 0, puntReturnYards: 0,
    fantasyPoints: 19, lastUpdated: now,
  }],
  games: schedules.map((schedule, index) => ({
    week: 1, team1: schedule.teamName, team2: `Opponent ${index}`,
    status: index === 0 ? 'final' : 'scheduled', team1Score: index === 0 ? 31 : 0,
    team2Score: index === 0 ? 14 : 0, lastUpdated: now,
  })),
};

export async function mockApp(page: Page) {
  const requests: string[] = [];
  const errors: string[] = [];
  const state: {
    currentUser: typeof user | null; schedulesFail: boolean; schedules: typeof schedules; liveFail: boolean; liveRefreshing: boolean; seasonFail: boolean;
    liveStatsMissing: boolean; livePendingTeams: string[] | null;
    seasonStats: SeasonStatsPayload;
    leagues: typeof league[];
    playerPool: Player[]; lineups: typeof lineup[]; usage: Array<{ playerId: string; timesUsed: number }>;
  } = {
    currentUser: user,
    schedules: structuredClone(schedules),
    leagues: [structuredClone(league)],
    schedulesFail: false, liveFail: false, liveRefreshing: false, seasonFail: false, playerPool: players,
    liveStatsMissing: false, livePendingTeams: null,
    seasonStats: {
      season: 2026, updatedAt: now, availableWeeks: [0, 1], missingWeeks: [],
      stats: live.stats.map(({ week: _week, lastUpdated: _lastUpdated, ...stats }) => stats),
    },
    lineups: [structuredClone(lineup)], usage: [{ playerId: 'qb-finished', timesUsed: 1 }],
  };
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date(now));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}${url.search}`);
    const respond = (json: unknown, status = 200) => route.fulfill({ json, status });
    if (url.pathname === '/api/me') return respond({ user: state.currentUser });
    if (url.pathname === '/api/auth/logout') {
      state.currentUser = null;
      return respond({ ok: true });
    }
    if (url.pathname === '/api/auth/login') {
      state.currentUser = { ...user, id: 'other-user', displayName: 'Other Member', email: request.postDataJSON().email };
      return respond({ user: state.currentUser });
    }
    if (url.pathname === '/api/leagues') return respond({ leagues: state.leagues });
    if (url.pathname === '/api/players') return respond({ players: state.playerPool, updatedAt: now });
    if (url.pathname === '/api/teams') return respond({ teams: schedules.map(team => ({ school: team.teamName, conference: team.conference })), updatedAt: now });
    if (url.pathname === '/api/season-stats') return respond(
      state.seasonFail ? { error: 'Season stats unavailable' } : state.seasonStats,
      state.seasonFail ? 503 : 200,
    );
    if (url.pathname === '/api/schedules') return respond(
      state.schedulesFail ? { error: 'Schedule unavailable' } : { schedules: state.schedules, updatedAt: now },
      state.schedulesFail ? 503 : 200,
    );
    if (url.pathname === '/api/live') return respond(
      state.liveFail
        ? { error: 'Live unavailable' }
        : {
            ...live, week: Number(url.searchParams.get('week') ?? 1),
            ...(state.liveStatsMissing ? { stats: [] } : {}),
            ...(state.livePendingTeams ? { pendingTeams: state.livePendingTeams } : {}),
            ...(state.liveRefreshing ? { sourceStatus: 'refreshing' } : {}),
          },
      state.liveFail ? 503 : 200,
    );
    if (url.pathname === '/api/leagues/league-a/lineups') {
      if (request.method() === 'PUT') {
        const body = request.postDataJSON();
        const saved = { ...lineup, ...body };
        state.lineups = [...state.lineups.filter(row => row.week !== body.week), saved];
        return respond({ lineup: saved, playerUsage: state.usage });
      }
      return respond({
        lineups: state.lineups,
        lineup: state.lineups.find(row => row.week === Number(url.searchParams.get('week') ?? 1)),
        playerUsage: state.usage,
      });
    }
    if (url.pathname === '/api/leagues/league-a') return respond({ league });
    if (url.pathname === '/api/leagues/league-a/leaderboard') return respond({
      leaderboard: [
        { userId: user.id, username: user.displayName, rank: 1, totalPoints: 19, weeklyPoints: { 1: 19 }, weeksScored: 1, winningWeeks: 0 },
        { userId: 'other-user', username: 'Other Member', rank: 2, totalPoints: 0, weeklyPoints: {}, weeksScored: 0, winningWeeks: 0 },
      ],
    });
    if (url.pathname === '/api/player-log') return respond({
      player: state.playerPool.find(player => player.id === url.searchParams.get('playerId')),
      season: 2026, weeks: [], totals: null, updatedAt: now,
    });
    errors.push(`Unmocked endpoint: ${request.method()} ${url.pathname}`);
    return respond({ error: 'Unexpected test request' }, 500);
  });
  return { requests, errors, state };
}
