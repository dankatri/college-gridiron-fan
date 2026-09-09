import { useMemo } from 'react';
import { playersResource } from '@/lib/data';
import { useResource } from './use-resource';
import { useScheduleData } from './use-schedule-data';
import type { Player } from '@/lib/types';

const EMPTY: Player[] = [];

export function usePlayers(enabled: boolean) {
  const state = useResource(playersResource, enabled);
  const { data: schedules } = useScheduleData(false, enabled);
  const players = useMemo(() => {
    if (!state.data) return EMPTY;
    if (!schedules) return state.data;
    const byes = new Map(schedules.map(team => [team.teamName.toLowerCase(), team.byeWeeks[0]]));
    return state.data.map(player => {
      const byeWeek = byes.get(player.team.toLowerCase());
      return { ...player, hasByeWeek: byeWeek !== undefined, byeWeek };
    });
  }, [state.data, schedules]);
  return { ...state, players, isLoading: state.isLoading || (!state.data && !state.error) };
}
