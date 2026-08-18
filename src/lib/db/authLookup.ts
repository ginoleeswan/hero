// src/lib/db/authLookup.ts — the email-first step of the unified auth screen.
//
// One RPC decides which form the user sees next: password entry (account
// exists), account creation (no account), or a pointer at the OAuth button
// they originally used (account exists but has no password — a password
// prompt would be a dead end they cannot escape without support mail).
import { supabase } from '../supabase';

export type EmailLookup = { exists: false } | { exists: true; providers: string[] };

/** True when the account can sign in with a password. */
export function hasPasswordProvider(l: EmailLookup): boolean {
  return l.exists && l.providers.includes('email');
}

/** The OAuth providers on the account, for "you signed up with …" copy. */
export function oauthProviders(l: EmailLookup): string[] {
  return l.exists ? l.providers.filter((p) => p !== 'email') : [];
}

/**
 * Look up whether an email has an account and which providers it uses.
 *
 * Throws on transport failure — the caller distinguishes "no account" (a
 * routing decision) from "could not check" (an error state that must not be
 * misread as "no account", or a flaky connection funnels an existing user
 * into sign-up and a confusing "already registered" error).
 */
export async function lookupEmail(email: string): Promise<EmailLookup> {
  const { data, error } = await supabase.rpc('auth_lookup_email', { p_email: email });
  if (error) throw error;
  const row = data as { exists: boolean; providers?: string[] };
  return row.exists ? { exists: true, providers: row.providers ?? ['email'] } : { exists: false };
}
