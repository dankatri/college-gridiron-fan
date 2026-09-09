import { useCallback, useSyncExternalStore } from 'react';
import type { AsyncResource } from '@/lib/async-resource';

export function useResource<T>(resource: AsyncResource<T>, enabled = true, poll = true) {
  const subscribe = useCallback(
    (listener: () => void) => enabled ? resource.subscribe(listener, poll) : () => {},
    [resource, enabled, poll],
  );
  return useSyncExternalStore(subscribe, resource.getSnapshot, resource.getSnapshot);
}
