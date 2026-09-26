import type { PlayerStats, WeeklyGame } from './types';

/**
 * How a player's points for a single week should be read.
 *
 * - `actual`  the player recorded a stat line, so we show what they scored
 * - `zero`    their game is final but they never appeared in the box score
 * - `pending` no stat line is available yet for an unfinished game
 * - `none`    they have no game that week at all (bye, or an idle Week 0 team)
 * - `unavailable` scoring or schedule data is missing or unreliable
 */
export type WeekPointsKind = 'actual' | 'zero' | 'pending' | 'none' | 'unavailable';

export interface WeekPoints {
  kind: WeekPointsKind;
  /** Present only for recorded scores and confirmed zero scores. */
  points?: number;
}

/**
 * What the app holds for a week's recorded scoring and schedule.
 *
 * - `ready`   both are loaded, so a player missing from a finished game's box
 *             score really did record nothing
 * - `loading` they are still arriving, so nothing can be concluded yet
 * - `missing` nothing usable is held, so absent scores must not read as zero
 *
 * A refresh being in flight, or a rejected refresh, does not make the accepted
 * snapshot unusable. It stays `ready`: the last accepted scores are still real
 * recorded scores, and a finished week must not relabel them as unavailable
 * every time the source is re-observed.
 */
export type WeekDataStatus = 'ready' | 'loading' | 'missing';

/**
 * Resolve each player's actual score independently in a partially played week.
 * Pending or unavailable scores must never be replaced with a predicted number.
 */
export function resolveWeekPoints(
  stats: PlayerStats | undefined,
  game: WeeklyGame | undefined,
  status: WeekDataStatus = 'ready',
): WeekPoints {
  if (stats) return { kind: 'actual', points: stats.fantasyPoints };
  if (game?.isByeWeek) return { kind: 'none' };
  if (status !== 'ready') {
    return status === 'loading' || (game && !game.isCompleted)
      ? { kind: 'pending' }
      : { kind: 'unavailable' };
  }
  if (!game) return { kind: 'none' };
  if (game.isCompleted) return { kind: 'zero', points: 0 };
  return { kind: 'pending' };
}

/**
 * Read a season-stat column off a single week's box score. Player carries a
 * combined `returnYards`, while the box score splits kick and punt returns.
 */
export function weekStatValue(stats: PlayerStats | undefined, key: string): number | undefined {
  if (!stats) return undefined;
  if (key === 'returnYards') return stats.kickReturnYards + stats.puntReturnYards;

  const value = key in stats ? stats[key as keyof PlayerStats] : undefined;
  return typeof value === 'number' ? value : undefined;
}

/** Sum the actual points a lineup scored in a week, ignoring empty slots. */
export function sumActualPoints(
  playerIds: (string | undefined)[],
  actuals: Map<string, PlayerStats>,
): number {
  return playerIds.reduce<number>((total, playerId) => {
    if (!playerId) return total;
    return total + (actuals.get(playerId)?.fantasyPoints ?? 0);
  }, 0);
}

export interface WeekPointsDisplay {
  label: 'Scored' | 'Pending' | 'No game' | 'Unavailable';
  /** A recorded score, or a non-numeric placeholder. */
  text: string;
  /** Label and number together, for prose-style rows. */
  summary: string;
  /** True when the figure is a fallback or a blank, so it can be de-emphasised. */
  muted: boolean;
  title: string;
}

/**
 * Turn a player's week into the label, value and tooltip the UI should show,
 * so tables and lineup cards describe a played week the same way.
 */
export function describeWeekPoints(
  options: { showActuals: boolean; stats?: PlayerStats; game?: WeeklyGame; weekName: string; status?: WeekDataStatus },
): WeekPointsDisplay {
  const { showActuals, stats, game, weekName } = options;

  const resolved: WeekPoints = showActuals
    ? resolveWeekPoints(stats, game, options.status)
    : { kind: game?.isByeWeek ? 'none' : 'pending' };
  const { kind, points } = resolved;

  switch (kind) {
    case 'unavailable':
      return {
        label: 'Unavailable', text: '?', summary: 'Actual points unavailable',
        muted: true, title: `${weekName} scoring or schedule data is unavailable; this is not a zero score`,
      };
    case 'actual': {
      const text = points!.toFixed(1);
      return {
        label: 'Scored',
        text,
        summary: `Scored ${text} pts`,
        muted: false,
        title: `Actual points scored in ${weekName}`,
      };
    }
    case 'zero':
      return {
        label: 'Scored',
        text: '0.0',
        summary: 'Scored 0.0 pts',
        muted: true,
        title: `No ${weekName} stat line recorded`,
      };
    case 'pending':
      return {
        label: 'Pending',
        text: '-',
        summary: 'Awaiting stats',
        muted: true,
        title: `Waiting for recorded ${weekName} stats`,
      };
    default:
      return {
        label: 'No game',
        text: '-',
        summary: `No ${weekName} game`,
        muted: true,
        title: `No ${weekName} game`,
      };
  }
}
