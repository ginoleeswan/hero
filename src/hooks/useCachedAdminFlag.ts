import { useEffect, useState } from 'react';

const KEY = 'mythique.is_admin';

/** Last-known admin state (localStorage). For optimistic UI/prefetch only —
 *  every admin surface re-verifies server-side. */
export function readCachedAdminFlag(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
}

export function writeCachedAdminFlag(isAdmin: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, isAdmin ? '1' : '0');
}

/**
 * The admin flag, backed by the last-known value (localStorage) so admin-only
 * UI — the settings "Admin" section, command-center entry points — renders on
 * FIRST paint for a returning admin instead of popping in when the profile
 * query resolves.
 *
 * Safe to be optimistic: every admin surface re-verifies server-side (RLS'd
 * RPCs; /admin/health bounces non-admins), so a stale `true` shows a dead
 * entry at worst, and the cache corrects itself the moment the profile lands.
 * Non-admins never have the cached flag, so they never see a flash.
 */
export function useCachedAdminFlag(
  profile: { is_admin?: boolean | null } | null | undefined,
): boolean {
  // Read once on mount — localStorage doesn't exist on native, where the
  // profile query result is the only source.
  const [cached] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1',
  );
  useEffect(() => {
    if (!profile || typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY, profile.is_admin ? '1' : '0');
  }, [profile]);
  return profile ? !!profile.is_admin : cached;
}
