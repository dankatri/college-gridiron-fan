import { ALL_WEEKS } from './types';
import { RIVALRY_WEEK } from './season-config';
import { isWeekComplete } from './week-lock';

export function groupNavigationWeeks(now: Date) {
  const completed: number[] = [];
  const regular: number[] = [];
  const postseason: number[] = [];

  for (const week of ALL_WEEKS) {
    if (isWeekComplete(week, now)) completed.push(week);
    else if (week > RIVALRY_WEEK) postseason.push(week);
    else regular.push(week);
  }

  return { completed, regular, postseason };
}
