import { lazy, Suspense, useMemo, useState, type ComponentType } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Button } from './ui/button';

/** Retry only this surface: a failed deployment chunk must not reload a draft. */
export function optionalFeature<Props extends object>(
  label: string,
  load: () => Promise<{ default: ComponentType<Props> }>,
) {
  return function OptionalFeature(props: Props) {
    const [attempt, setAttempt] = useState(0);
    const Feature = useMemo(() => lazy(load), [attempt]);
    return (
      <ErrorBoundary
        resetKeys={[attempt]}
        onError={error => console.error(`Unable to display ${label}`, error)}
        fallbackRender={() => (
          <div role="alert" className="rounded-lg border border-destructive p-4 space-y-3">
            <p>Unable to display {label}. Your unsaved lineup has not been cleared.</p>
            <p className="text-sm">You can return to Set Lineup and save before refreshing the page.</p>
            <Button variant="outline" disabled={attempt >= 2} onClick={() => setAttempt(value => value + 1)}>
              Retry {label}
            </Button>
          </div>
        )}
      >
        <Suspense fallback={<p role="status" className="p-4 text-muted-foreground">Loading {label}...</p>}>
          <Feature {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}
