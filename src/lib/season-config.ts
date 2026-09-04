/**
 * Season configuration — single source of truth for all season-scoped constants.
 * Update this file once per season. Everything else reads from here.
 */

import { FIRST_WEEK } from './types';

export const SEASON_YEAR = 2026;

// Use previous season's stats for projections until current season games start
export const PROJECTION_YEAR = 2025;

/**
 * The last week that is still part of the regular season (the conference
 * championships). Weeks 15-18 are the CFP, where a missing week means the team
 * did not qualify rather than a bye.
 */
export const REGULAR_SEASON_LAST_WEEK = 14;

/**
 * 2026 CFB Season Week Start Dates (Saturday-anchored).
 *
 * Each date is the Saturday that anchors the week's main slate of games, and a
 * week runs until the next Saturday anchor. Thursday/Friday games fall inside
 * the week they precede.
 *
 * Sources:
 * - ESPN 2026 schedule: espn.com/college-football/schedule
 * - CFP official: collegefootballplayoff.com
 * - Conference championship dates: fbschedules.com
 *
 * Numbering is zero-based to match how the sport counts: the late-August
 * opening slate is Week 0, so the first full Saturday is Week 1.
 */
export const WEEK_START_DATES: Record<number, Date> = {
  0:  new Date('2026-08-29T00:00:00-05:00'), // Week 0: Aug 29 (Dublin, Brazil, early kickoffs)
  1:  new Date('2026-09-05T00:00:00-05:00'), // Sep 5 – 12
  2:  new Date('2026-09-12T00:00:00-05:00'), // Sep 12 – 19
  3:  new Date('2026-09-19T00:00:00-05:00'), // Sep 19 – 26
  4:  new Date('2026-09-26T00:00:00-05:00'), // Sep 26 – Oct 3
  5:  new Date('2026-10-03T00:00:00-05:00'), // Oct 3 – 10
  6:  new Date('2026-10-10T00:00:00-05:00'), // Oct 10 – 17
  7:  new Date('2026-10-17T00:00:00-05:00'), // Oct 17 – 24
  8:  new Date('2026-10-24T00:00:00-05:00'), // Oct 24 – 31
  9:  new Date('2026-10-31T00:00:00-05:00'), // Oct 31 – Nov 7
  10: new Date('2026-11-07T00:00:00-06:00'), // Nov 7 – 14 (DST ends Nov 1)
  11: new Date('2026-11-14T00:00:00-06:00'), // Nov 14 – 21
  12: new Date('2026-11-21T00:00:00-06:00'), // Nov 21 – 28
  13: new Date('2026-11-28T00:00:00-06:00'), // Nov 28 – Dec 5 (Rivalry Week: Iron Bowl, The Game, etc.)
  14: new Date('2026-12-05T00:00:00-06:00'), // Dec 5 – 12 (Conference Championships)
  15: new Date('2026-12-12T00:00:00-06:00'), // Army-Navy Dec 12 + CFP First Round (Dec 18-19, on-campus)
  16: new Date('2026-12-26T00:00:00-06:00'), // CFP Quarterfinals (Dec 30 + Jan 1)
  17: new Date('2027-01-09T00:00:00-06:00'), // CFP Semifinals (Jan 14-15: Orange & Sugar Bowls)
  18: new Date('2027-01-20T00:00:00-06:00'), // National Championship (Jan 25, Allegiant Stadium, Las Vegas)
};

/**
 * How far before its Saturday anchor a week actually opens.
 *
 * A week's slate starts on the Thursday night before the anchor Saturday, so
 * the boundary sits three days earlier, on the Wednesday. Anchoring on the
 * Saturday itself pushed every Thursday and Friday game into the week before
 * it — that is how Sep 3-4 games ended up in Week 0 instead of Week 1.
 */
const WEEK_LEAD_IN_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The instant week `week` opens — the canonical boundary for every week
 * calculation in the app (which games belong to it, when it locks, which week
 * is current).
 *
 * Returns undefined for weeks outside the season.
 */
export function weekBoundary(week: number): Date | undefined {
  const anchor = WEEK_START_DATES[week];
  if (!anchor) return undefined;
  return new Date(anchor.getTime() - WEEK_LEAD_IN_DAYS * DAY_MS);
}

/**
 * The app week whose window contains `date`.
 *
 * Week N runs from its boundary until week N+1's; the final week is
 * open-ended. Thursday and Friday games therefore fall inside the week they
 * precede, and Sunday/Monday games (Labor Day) stay with the Saturday they
 * follow. This is the app's canonical week definition and the only safe way to
 * place an upstream game, because CollegeFootballData numbers its own weeks
 * differently (its weeks do not align with ours, and its entire postseason is
 * a single week).
 *
 * Returns null for dates before the season opens. Week 0 is a valid result, so
 * callers must test for null rather than falsiness.
 */
export function weekForDate(date: Date): number | null {
  const time = date.getTime();
  if (Number.isNaN(time) || time < weekBoundary(FIRST_WEEK)!.getTime()) return null;

  const weeks = Object.keys(WEEK_START_DATES).map(Number).sort((a, b) => a - b);
  let match: number | null = null;
  for (const week of weeks) {
    if (time >= weekBoundary(week)!.getTime()) match = week;
    else break;
  }
  return match;
}

/** Half-open [start, end) window for an app week; the last week has no end. */
export function weekWindow(week: number): { start: Date; end: Date | null } | null {
  const start = weekBoundary(week);
  if (!start) return null;
  return { start, end: weekBoundary(week + 1) ?? null };
}

/**
 * Week labels for display — customize postseason naming.
 */
export const WEEK_LABELS: Record<number, string> = {
  0: 'Week 0',
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
