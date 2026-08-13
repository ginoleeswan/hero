import { QueryClient } from '@tanstack/react-query';
import { PERSIST_MAX_AGE } from './persist';

// Single shared cache for the app. staleTime keeps revisits instant (served
// from cache, revalidated in the background) instead of cold-fetching.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — hero/category data changes rarely
      // A WEEK, not the old 30 minutes, and this is load-bearing rather than
      // generous: the persister writes whatever is in the cache, so anything
      // garbage-collected before the app closes is not in the file to restore.
      // A gcTime shorter than PERSIST_MAX_AGE quietly makes persistence a
      // no-op for exactly the pages a reader stopped looking at — which are
      // most of them. In-memory pressure is unchanged in practice because
      // React Native drops the whole heap on termination anyway.
      gcTime: PERSIST_MAX_AGE,
      retry: 2,
      // Revalidate when the app comes back to the front. This is gated by
      // staleTime, so returning within five minutes still costs nothing — it
      // only refetches what has actually gone stale.
      //
      // It was off because on React Native it did nothing anyway: focus is
      // reported by `document.hasFocus()`, which does not exist here, so the
      // focusManager never changed state. `startAppFocusTracking` (called from
      // the root layout) wires it to AppState, which is what makes this
      // meaningful rather than merely enabled.
      refetchOnWindowFocus: true,
    },
  },
});
