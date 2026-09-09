export interface ResourceValue<T> {
  data: T;
  sourceCheckedAt?: string | null;
  sourceAttemptedAt?: string | null;
  contentVersion?: string | null;
  sourceStatus?: string | null;
  sourceError?: Error | null;
}

export interface ResourceSnapshot<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  sourceCheckedAt: string | null;
  sourceAttemptedAt: string | null;
  contentVersion: string | null;
  sourceStatus: string | null;
  clientFetchedAt: number | null;
}

export function createResource<T>(
  load: (signal: AbortSignal) => Promise<ResourceValue<T>>,
  options: { ttlMs: number; pollMs?: number; timeoutMs?: number },
) {
  let snapshot: ResourceSnapshot<T> = {
    data: undefined, isLoading: false, error: null, sourceCheckedAt: null,
    sourceAttemptedAt: null, contentVersion: null, sourceStatus: null, clientFetchedAt: null,
  };
  let generation = 0;
  let request: { controller: AbortController; promise: Promise<ResourceSnapshot<T>> } | null = null;
  const listeners = new Map<() => void, boolean>();
  let timer: ReturnType<typeof setInterval> | undefined;

  const publish = (next: ResourceSnapshot<T>) => {
    snapshot = next;
    for (const listener of listeners.keys()) listener();
  };

  const refresh = (force = false): Promise<ResourceSnapshot<T>> => {
    if (request) return request.promise;
    if (!force && snapshot.clientFetchedAt !== null &&
        Date.now() - snapshot.clientFetchedAt < options.ttlMs && !snapshot.error) {
      return Promise.resolve(snapshot);
    }
    const version = generation;
    const controller = new AbortController();
    let rejectAbort: (reason: unknown) => void;
    const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const deadline = setTimeout(
      () => controller.abort(new Error('Request timed out. Please retry.')),
      options.timeoutMs ?? 20_000,
    );
    const pending = {
      controller,
      promise: Promise.resolve(snapshot),
    };
    request = pending;
    pending.promise = (async () => {
      try {
        const value = await Promise.race([
          Promise.resolve().then(() => load(controller.signal)), aborted,
        ]);
        if (version === generation) {
          const unchanged = value.contentVersion != null &&
            value.contentVersion === snapshot.contentVersion && snapshot.data !== undefined;
          publish({
            data: unchanged ? snapshot.data : value.data, isLoading: false, error: value.sourceError ?? null,
            sourceCheckedAt: value.sourceCheckedAt ?? null,
            sourceAttemptedAt: value.sourceAttemptedAt ?? null,
            contentVersion: value.contentVersion ?? null,
            sourceStatus: value.sourceStatus ?? null,
            clientFetchedAt: Date.now(),
          });
        }
      } catch (cause) {
        if (version === generation) {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          publish({ ...snapshot, isLoading: false, error });
        }
      } finally {
        clearTimeout(deadline);
        controller.signal.removeEventListener('abort', onAbort);
        if (request === pending) request = null;
      }
      return snapshot;
    })();
    publish({ ...snapshot, isLoading: true });
    return pending.promise;
  };

  const onFocus = () => {
    if (document.visibilityState !== 'hidden') void refresh();
  };
  const updateTimer = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    if (options.pollMs && [...listeners.values()].some(Boolean) && typeof window !== 'undefined') {
      timer = setInterval(onFocus, options.pollMs);
    }
  };

  return {
    getSnapshot: () => snapshot,
    refresh,
    async read(force = false): Promise<T> {
      const result = await refresh(force);
      if (result.error) throw result.error;
      if (result.data === undefined) throw new Error('Data is unavailable. Please retry.');
      return result.data;
    },
    invalidate(clear = false) {
      generation++;
      request?.controller.abort(new Error('Request superseded'));
      request = null;
      publish({
        ...snapshot, data: clear ? undefined : snapshot.data, clientFetchedAt: null,
        isLoading: false, error: null,
        ...(clear ? { sourceCheckedAt: null, sourceAttemptedAt: null, contentVersion: null, sourceStatus: null } : {}),
      });
      if (listeners.size > 0) void refresh();
    },
    subscribe(listener: () => void, poll = true) {
      const first = listeners.size === 0;
      listeners.set(listener, poll);
      if (first && typeof window !== 'undefined') {
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
      }
      updateTimer();
      void refresh();
      return () => {
        listeners.delete(listener);
        updateTimer();
        if (listeners.size === 0 && typeof window !== 'undefined') {
          window.removeEventListener('focus', onFocus);
          document.removeEventListener('visibilitychange', onFocus);
        }
      };
    },
  };
}

export type AsyncResource<T> = ReturnType<typeof createResource<T>>;
