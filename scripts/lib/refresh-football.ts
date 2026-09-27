import pLimit from 'p-limit';
import { z } from 'zod';
import { SEASON_YEAR, REGULAR_SEASON_LAST_WEEK, weekForDate } from '../../src/lib/season-config';
import { buildGameStatuses, buildTeamSchedules, effectiveKickoff } from '../../src/server/cfbd-transform';
import { getFbsTeams, getGames, getGamePlayerStats, type CfbdGame, type CfbdGamePlayers, type CfbdTeam } from '../../src/server/cfbd';
import { liveStatsCacheKey, playersCacheKey, schedulesCacheKey, teamsCacheKey } from '../../src/server/cache-keys';
import type { Player, TeamSchedule } from '../../src/lib/types';
import type { CacheRun } from '../../src/server/cache-publication';
import { readPublishedCache } from '../../src/server/read-published-cache';
import { readCache, refreshCache } from './cache';
import { assertScheduleCompleteness, buildAcceptedLiveStats, refreshWeeks, type AcceptedLiveSnapshot } from './refresh-policy';
import { logStep } from './runner';

export async function loadGameContext(): Promise<{ teams: CfbdTeam[]; games: CfbdGame[] }> {
  const directory = await readPublishedCache<Array<{
    id: string; school: string; conference: string; logo: string | null;
    color: string | null; alternateColor: string | null;
  }>>(teamsCacheKey(SEASON_YEAR));
  const parsed = z.array(z.object({
    id: z.string().regex(/^\d+$/), school: z.string(), conference: z.string(),
    logo: z.string().nullable(), color: z.string().nullable(), alternateColor: z.string().nullable(),
  })).nonempty().safeParse(directory.data);
  const cachedTeams = parsed.success && directory.sourceCheckedAt &&
    Date.now() - Date.parse(directory.sourceCheckedAt) < 36 * 60 * 60 * 1000
    ? parsed.data.map(team => ({
      id: Number(team.id), school: team.school, conference: team.conference,
      color: team.color, alternateColor: team.alternateColor, logos: team.logo ? [team.logo] : [],
      abbreviation: null, classification: 'fbs', mascot: null,
    })) : null;
  const [teams, games] = await Promise.all([cachedTeams ?? getFbsTeams(SEASON_YEAR), getGames(SEASON_YEAR, 'both')]);
  if (!teams.length || !games.length) throw new Error('CFBD discovery returned no teams/games; retaining accepted data');
  return { teams, games };
}

export async function refreshSchedules(run: CacheRun, context?: Awaited<ReturnType<typeof loadGameContext>>) {
  const key = schedulesCacheKey(SEASON_YEAR);
  await refreshCache(key, run, async () => {
    const { teams, games } = context ?? await loadGameContext();
    const previous = await readCache<TeamSchedule[]>(key);
    const next = buildTeamSchedules({ teams, games, weekForDate, regularSeasonLastWeek: REGULAR_SEASON_LAST_WEEK });
    assertScheduleCompleteness(previous, next);
    logStep('schedule candidate', { teams: next.length, sourceGames: games.length });
    return next;
  });
}

export async function refreshLiveWeeks(
  run: CacheRun, games: CfbdGame[], now: Date, sweep: boolean, forcedWeek?: number,
) {
  // Current play must not wait behind a slow historical correction endpoint.
  const weeks = refreshWeeks(games, now, sweep, forcedWeek).sort((a, b) => b - a);
  logStep('live refresh scope', { weeks, sweep, forcedWeek });
  const limit = pLimit(3);
  const requests = new Map<string, Promise<{ data: CfbdGamePlayers[] } | { error: unknown }>>();
  let playerContext: Promise<{ players: Player[]; idByAthlete: Map<string, string> }> | undefined;
  const failures: number[] = [];
  for (const week of weeks) {
    try {
      await refreshCache(liveStatsCacheKey(SEASON_YEAR, week), run, async () => {
        playerContext ??= readCache<Player[]>(playersCacheKey(SEASON_YEAR)).then(players => {
          if (!players?.length) throw new Error('No cached player pool; live refresh cannot safely map athlete IDs');
          return { players, idByAthlete: new Map(players.map(player => [player.id.split('_').pop()!, player.id])) };
        });
        const { players, idByAthlete } = await playerContext;
        const weekGames = games.filter(game => {
          const kickoff = effectiveKickoff(game);
          return kickoff !== null && weekForDate(kickoff) === week;
        });
        const pairs = new Map(weekGames.map(game => [`${game.seasonType}:${game.week}`, game]));
        for (const [pair, game] of pairs) if (!requests.has(pair)) {
          requests.set(pair, limit(() => getGamePlayerStats(SEASON_YEAR, game.week, game.seasonType))
            .then(data => ({ data }), error => ({ error })));
        }
        // A box-score source that fails for one CFBD week must not discard the
        // ones that succeeded. Games left without a box are held at their last
        // accepted stat lines below, exactly as a lagging source is, so the
        // rest of the week still publishes fresh scores.
        const boxes: CfbdGamePlayers[] = [];
        const unreachable: string[] = [];
        for (const pair of pairs.keys()) {
          const result = await requests.get(pair)!;
          if ('error' in result) {
            unreachable.push(pair);
            console.error(`Box scores for ${pair} are unreachable; its games stay held`, result.error);
            continue;
          }
          boxes.push(...result.data);
        }
        if (pairs.size && unreachable.length === pairs.size) {
          throw new Error(`No box-score source could be reached for week ${week}`);
        }
        const uniqueBoxes = [...new Map(boxes.map(box => [box.id, box])).values()];
        const previous = await readCache<AcceptedLiveSnapshot>(liveStatsCacheKey(SEASON_YEAR, week));
        const observedAt = new Date();
        const { stats, holds } = buildAcceptedLiveStats({
          games: weekGames, boxes: uniqueBoxes, previous, players, idByAthlete, week, now: observedAt,
        });
        if (holds.length) logStep('live teams held at last accepted stats', { week, holds });
        const statuses = buildGameStatuses(weekGames, week, observedAt);
        // A held team has no verified box score, so its players must not be
        // read as having scored zero. Publishing the names lets the client tell
        // "recorded nothing" apart from "nothing recorded yet".
        const pendingTeams = [...new Set(holds.map(hold => hold.team))].sort();
        logStep('live candidate', { week, players: stats.length, games: statuses.length, pendingTeams, unreachable });
        return { week, updatedAt: observedAt.toISOString(), stats, games: statuses, pendingTeams };
      });
    } catch (error) {
      failures.push(week);
      console.error(`Live week ${week} refresh failed; keeping its last accepted snapshot`, error);
    }
  }
  if (failures.length) throw new Error(`Live weeks could not be refreshed: ${failures.join(', ')}`);
}
