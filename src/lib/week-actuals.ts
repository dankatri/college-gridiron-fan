import type { Player, PlayerStats, WeeklyGame } from './types';

/**
 * How a player's points for a single week should be read.
 *
 * - `actual`  the player recorded a stat line, so we show what they scored
 * - `zero`    their game is final but they never appeared in the box score
 * - `pending` their game has not been played yet, so the projection still applies
 * - `none`    they have no game that week at all (bye, or an idle Week 0 team)
 */
export type WeekPointsKind = 'actual' | 'zero' | 'pending' | 'none';

export interface WeekPoints {
  kind: WeekPointsKind;
  /** Undefined only when kind is `none`. */
  points?: number;
}

/**
 * Decide whether to show a player's real score or their projection for a week.
 *
 * A week can be part-played (Week 0 spreads across a full week of kickoffs), so
 * this resolves per player rather than per week: anyone who has already played
 * shows their actual points, anyone still to play keeps their projection.
 */
export function resolveWeekPoints(
  player: Player,
  stats: PlayerStats | undefined,
  game: WeeklyGame | undefined,
): WeekPoints {
  if (stats) return { kind: 'actual', points: stats.fantasyPoints };
  if (!game || game.isByeWeek) return { kind: 'none' };
  if (game.isCompleted) return { kind: 'zero', points: 0 };
  return { kind: 'pending', points: player.projectedPoints };
}

/**
 * Read a season-stat column off a single week's box score. Player carries a
 * combined `returnYards`, while the box score splits kick and punt returns.
 */
export function weekStatValue(stats: PlayerStats | undefined, key: string): number | undefined {
  if (!stats) return undefined;
  if (key === 'returnYards') return stats.kickReturnYards + stats.puntReturnYards;

  const value = (stats as unknown as Record<string, unknown>)[key];
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
  label: 'Projected' | 'Scored';
  /** Just the number, for table cells. */
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
  player: Player,
  options: { showActuals: boolean; stats?: PlayerStats; game?: WeeklyGame; weekName: string },
): WeekPointsDisplay {
  const { showActuals, stats, game, weekName } = options;

  if (!showActuals) {
    const text = player.projectedPoints.toFixed(1);
    return {
      label: 'Projected',
      text,
      summary: `Projected ${text} pts`,
      muted: false,
      title: 'Projected points per game',
    };
  }

  const { kind, points } = resolveWeekPoints(player, stats, game);

  switch (kind) {
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
    case 'pending': {
      const text = points!.toFixed(1);
      return {
        label: 'Projected',
        text,
        summary: `Projected ${text} pts`,
        muted: true,
        title: `${weekName} game not played yet - showing projection`,
      };
    }
    default:
      return {
        label: 'Scored',
        text: '-',
        summary: `No ${weekName} game`,
        muted: true,
        title: `No ${weekName} game`,
      };
  }
}
