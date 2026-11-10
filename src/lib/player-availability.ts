/**
 * Whether a player has stopped appearing in box scores.
 *
 * No upstream source this app consumes reports injuries: CFBD has no injury
 * endpoint, and ESPN's college feed is effectively unmaintained. The only
 * availability signal actually in the data is absence — a player who recorded
 * a stat line every week and then stopped. That is a genuinely useful hint
 * when picking, but it is a hint, not a report: a missing line can equally
 * mean a benching, a position change, or a week with no touches.
 *
 * So this deliberately reports what was observed ("no stats in week 8")
 * rather than a diagnosis, and stays silent unless a player has an
 * established history to break from.
 */

export type AvailabilityStatus = 'unknown' | 'active' | 'missed';

export type PlayerAvailability = {
  status: AvailabilityStatus;
  /** Weeks the team played and had stats published, with no line for this player. */
  missedWeeks: number[];
  lastPlayedWeek: number | null;
};

const UNKNOWN: PlayerAvailability = { status: 'unknown', missedWeeks: [], lastPlayedWeek: null };

export function playerAvailability(input: {
  /** Newest week the player recorded a stat line. */
  lastPlayedWeek?: number | null;
  /**
   * Weeks the player's team actually finished a game.
   *
   * Byes have to come from the schedule rather than the player record: teams
   * take more than one bye a season, and the player payload does not populate
   * a bye at all, so anything derived from it would read a bye as an absence.
   */
  teamPlayedWeeks: readonly number[];
  /** Weeks with published live stats, from the season-stats payload. */
  availableWeeks: readonly number[];
  /** Weeks at or after this one are still in progress, so absence means nothing yet. */
  currentWeek?: number;
}): PlayerAvailability {
  const { lastPlayedWeek, teamPlayedWeeks, availableWeeks, currentWeek } = input;

  // A player who has never recorded a stat line is a backup or a redshirt, not
  // someone who disappeared. Flagging those would bury the real signal.
  if (lastPlayedWeek === null || lastPlayedWeek === undefined) return UNKNOWN;
  // No schedule for the team is missing data, not a known absence.
  if (!teamPlayedWeeks.length || !availableWeeks.length) return { ...UNKNOWN, lastPlayedWeek };

  const published = new Set(availableWeeks);
  const missedWeeks = teamPlayedWeeks
    .filter(week => week > lastPlayedWeek)
    // A week whose stats were never published cannot show anyone as absent.
    .filter(week => published.has(week))
    .filter(week => currentWeek === undefined || week < currentWeek)
    .sort((a, b) => a - b);

  return {
    status: missedWeeks.length ? 'missed' : 'active',
    missedWeeks,
    lastPlayedWeek,
  };
}

/** Short badge text; `null` when there is nothing worth showing. */export function availabilityLabel(availability: PlayerAvailability): string | null {
  const count = availability.missedWeeks.length;
  if (availability.status !== 'missed' || !count) return null;
  return count === 1 ? `DNP W${availability.missedWeeks[0]}` : `DNP ${count}WK`;
}

export function availabilityTooltip(availability: PlayerAvailability, team?: string): string | null {
  const weeks = availability.missedWeeks;
  if (availability.status !== 'missed' || !weeks.length) return null;
  const who = team ? `This ${team} player` : 'This player';
  const when = weeks.length === 1
    ? `Week ${weeks[0]}`
    : `Weeks ${weeks.slice(0, -1).join(', ')} and ${weeks[weeks.length - 1]}`;
  return `${who} recorded no stats in ${when}, after last playing in Week ${availability.lastPlayedWeek}. `
    + 'That may mean injury, but it can also mean a benching or no touches — injuries are not reported by the stats source.';
}

/**
 * Completed, non-bye game weeks per team, keyed by lower-cased team name to
 * match what players carry.
 */
export function teamPlayedWeeks(
  schedules: ReadonlyArray<{
    teamName: string;
    weeklyGames: ReadonlyArray<{ week: number; isByeWeek: boolean; isCompleted?: boolean }>;
  }>,
): Map<string, number[]> {
  const played = new Map<string, number[]>();
  for (const schedule of schedules) {
    const weeks = new Set<number>();
    for (const game of schedule.weeklyGames) {
      if (game.isByeWeek || !game.isCompleted) continue;
      weeks.add(game.week);
    }
    played.set(schedule.teamName.toLowerCase(), [...weeks].sort((a, b) => a - b));
  }
  return played;
}
