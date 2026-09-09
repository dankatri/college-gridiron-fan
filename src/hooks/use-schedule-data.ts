import { schedulesResource } from '@/lib/schedule-data';
import { useResource } from './use-resource';

export function useScheduleData(poll = false, enabled = true) {
  return useResource(schedulesResource, enabled, poll);
}
