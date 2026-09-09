import { useMemo } from 'react';
import { seasonStatsResource } from '@/lib/season-stats-data';
import { useResource } from './use-resource';

export function useSeasonStats() {
  const state = useResource(seasonStatsResource);
  const actuals = useMemo(
    () => new Map(state.data?.stats.map(stat => [stat.playerId, stat]) ?? []),
    [state.data],
  );
  return {
    actuals,
    isLoading: state.data === undefined && !state.error,
    complete: state.data !== undefined && state.data.missingWeeks.length === 0,
    hasData: state.data !== undefined && (state.data.availableWeeks.length > 0 || state.data.missingWeeks.length === 0),
    error: state.error,
  };
}
