import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * Tab/sub-tab state mirrored to a URL query param, so a refresh (or a shared
 * link) restores the exact view instead of snapping back to the default — used
 * by the admin command center's top-level tabs (`?tab=`) and each lane's
 * sub-tabs (`?sub=`).
 *
 * `valid` guards against a stale param (e.g. a `?sub` left over from a
 * different top-level tab): an unrecognised value falls back to `fallback`.
 * Web-only in practice; on native the params simply stay at the fallback.
 */
export function useUrlTabState<T extends string>(
  param: string,
  fallback: T,
  valid?: readonly T[],
): [T, (v: T) => void] {
  const router = useRouter();
  const params = useLocalSearchParams();
  const raw = params[param];
  const candidate = (Array.isArray(raw) ? raw[0] : raw) as T | undefined;
  const value = candidate && (!valid || valid.includes(candidate)) ? candidate : fallback;

  const set = useCallback(
    (v: T) => {
      // setParams merges into the current URL without a navigation entry.
      router.setParams({ [param]: v } as Record<string, string>);
    },
    [router, param],
  );

  return [value, set];
}
