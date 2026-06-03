import { QueryClient } from '@tanstack/react-query';

// Single shared cache for the app. staleTime keeps revisits instant (served
// from cache, revalidated in the background) instead of cold-fetching.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — hero/category data changes rarely
      gcTime: 1000 * 60 * 30, // keep unused data 30 min for fast back-nav
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
