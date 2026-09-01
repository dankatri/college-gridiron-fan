/**
 * Season configuration — single source of truth for all season-scoped constants.
 * Update this file once per season. Everything else reads from here.
 */

export const SEASON_YEAR = 2026;

// Use previous season's stats for projections until current season games start
export const PROJECTION_YEAR = 2025;

/**
 * App weeks 1-14 are the regular season (13 = rivalry week, 14 = conference
 * championships); 15-18 are the CFP rounds. Only regular-season gaps count as
 * bye weeks — a missing playoff week just means the team did not qualify.
 */
export const REGULAR_SEASON_WEEKS = 14;

/**
 * 2026 CFB Season Week Start Dates (Saturday-anchored).
 *
 * Each date is the Saturday that anchors the week's main slate of games.
 * Thursday/Friday games in a given week fall within that week's window.
 *
 * Sources:
 * - ESPN 2026 schedule: espn.com/college-football/schedule
 * - CFP official: collegefootballplayoff.com
 * - Conference championship dates: fbschedules.com
 *
 * Week 0 games (Aug 29 — Dublin, Brazil) fold into the Week 1 window.
 */
export const WEEK_START_DATES: Record<number, Date> = {
  1:  new Date('2026-08-29T00:00:00-05:00'), // Week 0/1: Aug 29 (Week 0 games) – Sep 5 (main Week 1 slate)
  2:  new Date('2026-09-05T00:00:00-05:00'), // Sep 5 – 12
  3:  new Date('2026-09-12T00:00:00-05:00'), // Sep 12 – 19
  4:  new Date('2026-09-19T00:00:00-05:00'), // Sep 19 – 26
  5:  new Date('2026-09-26T00:00:00-05:00'), // Sep 26 – Oct 3
  6:  new Date('2026-10-03T00:00:00-05:00'), // Oct 3 – 10
  7:  new Date('2026-10-10T00:00:00-05:00'), // Oct 10 – 17
  8:  new Date('2026-10-17T00:00:00-05:00'), // Oct 17 – 24
  9:  new Date('2026-10-24T00:00:00-05:00'), // Oct 24 – 31
  10: new Date('2026-10-31T00:00:00-05:00'), // Oct 31 – Nov 7
  11: new Date('2026-11-07T00:00:00-06:00'), // Nov 7 – 14 (DST ends Nov 1)
  12: new Date('2026-11-14T00:00:00-06:00'), // Nov 14 – 21
  13: new Date('2026-11-21T00:00:00-06:00'), // Nov 21 – 28 (Rivalry Week: Iron Bowl, The Game, etc.)
  14: new Date('2026-11-28T00:00:00-06:00'), // Nov 28 – Dec 5 (Conference Championships Sat Dec 5)
  15: new Date('2026-12-12T00:00:00-06:00'), // CFP First Round (Dec 18-19, on-campus)
  16: new Date('2026-12-26T00:00:00-06:00'), // CFP Quarterfinals (Dec 30 + Jan 1)
  17: new Date('2027-01-09T00:00:00-06:00'), // CFP Semifinals (Jan 14-15: Orange & Sugar Bowls)
  18: new Date('2027-01-20T00:00:00-06:00'), // National Championship (Jan 25, Allegiant Stadium, Las Vegas)
};

/**
 * The app week whose window contains `date`.
 *
 * Week N runs from WEEK_START_DATES[N] until WEEK_START_DATES[N + 1]; the final
 * week is open-ended. This is the app's canonical week definition and the only
 * safe way to place an upstream game, because CollegeFootballData numbers its
 * own weeks differently (its 2026 week 1 spans two of our weeks, and its entire
 * postseason is a single week).
 *
 * Returns null for dates before the season opens.
 */
export function weekForDate(date: Date): number | null {
  const time = date.getTime();
  if (Number.isNaN(time) || time < WEEK_START_DATES[1].getTime()) return null;

  const weeks = Object.keys(WEEK_START_DATES).map(Number).sort((a, b) => a - b);
  let match: number | null = null;
  for (const week of weeks) {
    if (time >= WEEK_START_DATES[week].getTime()) match = week;
    else break;
  }
  return match;
}

/** Half-open [start, end) window for an app week; the last week has no end. */
export function weekWindow(week: number): { start: Date; end: Date | null } | null {
  const start = WEEK_START_DATES[week];
  if (!start) return null;
  return { start, end: WEEK_START_DATES[week + 1] ?? null };
}

/**
 * Week labels for display — customize postseason naming.
 */
export const WEEK_LABELS: Record<number, string> = {
  1: 'Week 1',
  2: 'Week 2',
  3: 'Week 3',
  4: 'Week 4',
  5: 'Week 5',
  6: 'Week 6',
  7: 'Week 7',
  8: 'Week 8',
  9: 'Week 9',
  10: 'Week 10',
  11: 'Week 11',
  12: 'Week 12',
  13: 'Rivalry Week',
  14: 'Championship Week',
  15: 'CFP First Round',
  16: 'CFP Quarterfinals',
  17: 'CFP Semifinals',
  18: 'National Championship',
};

/**
 * Conference lists updated for 2026 realignment.
 * Used for display ordering and fallback classification.
 * The ESPN /teams endpoint provides authoritative live assignments.
 */
export const POWER_CONFERENCES = ['SEC', 'Big Ten', 'Big 12', 'ACC'] as const;

export const GROUP_OF_FIVE_CONFERENCES = [
  'American Athletic', 'Conference USA', 'Mid-American',
  'Mountain West', 'Sun Belt', 'Pac-12',
] as const;

export const ALL_FBS_CONFERENCES = [
  ...POWER_CONFERENCES,
  ...GROUP_OF_FIVE_CONFERENCES,
  'Independent',
] as const;

// Dev-mode assertion: validate week date spacing (Vite only)
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).process === 'undefined') {
  try {
    if (import.meta.env?.DEV) {
  const weeks = Object.keys(WEEK_START_DATES).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < weeks.length - 1; i++) {
    const curr = WEEK_START_DATES[weeks[i]];
    const next = WEEK_START_DATES[weeks[i + 1]];
    const gapDays = (next.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (gapDays < 6) {
      console.warn(
        `⚠️ Season config: Week ${weeks[i]}→${weeks[i + 1]} gap is only ${gapDays} days (expected ≥7)`
      );
    }
  }
    }
  } catch {
    // Not in Vite — skip dev assertions
  }
}
