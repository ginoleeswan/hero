import { supabase } from '../supabase';

// Block list: hides a blocker's chosen users from their own view. RLS on
// blocked_users scopes select/insert/delete to blocker_id = auth.uid() (no
// update policy — a block has no mutable state; unblocking is a delete).
// The filtering effect on matchup_takes lives entirely in that table's SELECT
// policy — this module is pure CRUD over blocked_users, nothing here filters
// anything client-side.
//
// blocked_users.user_id references auth.users, not user_profiles, so
// PostgREST can't embed display name/avatar via a nested select — same
// constraint as matchup_takes in takes.ts. getBlockedUsers resolves them with
// a second `in()` query against user_profiles instead.

export interface BlockedUser {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface BlockedUserRow {
  blocked_id: string;
  created_at: string;
}

const UNIQUE_VIOLATION = '23505';

/**
 * Block a user. `blocker_id` is not a caller-supplied parameter — the caller
 * can never claim to block on someone else's behalf. It's read from the
 * current session via `auth.getUser()` and sent as literally the signed-in
 * user's own id, which is exactly what the insert policy's `with check
 * (blocker_id = (select auth.uid()))` requires: the column is `not null`
 * with no default, so *something* has to be sent, and RLS rejects anything
 * but the caller's own id anyway.
 *
 * Blocking someone already blocked hits the (blocker_id, blocked_id) primary
 * key and comes back as a 23505 unique-violation. That's not a failure the
 * UI should surface — the caller's intent ("this person is blocked") is
 * already satisfied — so it's treated as success. Deliberately not papered
 * over with `upsert`: an upsert would also succeed on a benign conflict for
 * the wrong reason (silently overwriting), and would hide the same signal we
 * want to keep visible for any other error code.
 */
export async function blockUser(blockedId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[blockUser] error: not signed in');
    return false;
  }
  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: user.id, blocked_id: blockedId });
  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return true;
    console.warn('[blockUser] error:', error.message);
    return false;
  }
  return true;
}

/** Unblock a user (delete). RLS-enforced to the caller's own blocks. */
export async function unblockUser(blockedId: string): Promise<boolean> {
  const { error } = await supabase.from('blocked_users').delete().eq('blocked_id', blockedId);
  if (error) {
    console.warn('[unblockUser] error:', error.message);
    return false;
  }
  return true;
}

/** The caller's block list for the settings screen. Empty array on error. */
export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[getBlockedUsers] error:', error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as BlockedUserRow[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.blocked_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds);
  if (profileError) {
    console.warn('[getBlockedUsers] profile lookup error:', profileError.message);
  }
  const profileById = new Map<string, { display_name: string | null; avatar_url: string | null }>(
    (
      (profiles ?? []) as unknown as {
        id: string;
        display_name: string | null;
        avatar_url: string | null;
      }[]
    ).map((p) => [p.id, p]),
  );

  return rows.map((r) => {
    const profile = profileById.get(r.blocked_id);
    return {
      userId: r.blocked_id,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      createdAt: r.created_at,
    };
  });
}
