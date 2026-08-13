// src/lib/query/PersistedQueryProvider.tsx — the query provider that survives
// a cold start. Mounted only by the native root layout; see ./persist.ts for
// why the web is deliberately excluded.
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from './queryClient';
import { PERSIST_MAX_AGE, shouldPersistQuery } from './persist';

/**
 * Bump to throw every restored cache away.
 *
 * The persisted file holds data in the SHAPE the app had when it was written.
 * Change a row's columns, rename a key, alter what an RPC returns, and a
 * restored cache hands the new code the old shape — which fails as a render
 * error on the reader's first launch after an update, in code that looks
 * correct. Busting is cheap: one cold fetch. Not busting is a crash nobody can
 * reproduce because it needs a device that had the previous version.
 */
const CACHE_VERSION = 'v1';

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: `mythique_query_cache_${CACHE_VERSION}`,
  // Writes are throttled so a fast scroll through a category does not turn the
  // cache into a write loop on the JS thread.
  throttleTime: 2000,
});

export function PersistedQueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: CACHE_VERSION,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
