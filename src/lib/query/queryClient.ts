import { QueryClient } from '@tanstack/react-query';

// Single shared cache for the app. staleTime keeps revisits instant (served
// from cache, revalidated in the background) instead of cold-fetching.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — hero/category data changes rarely
      gcTime: 1000 * 60 * 30, // keep unused data 30 min for fast back-nav
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
