import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getProfile, upsertProfile } from '../lib/db/profiles';
import { track, identify, resetAnalytics } from '../lib/analytics';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Declared before the auth-state effect that calls it (stable identity so the
  // subscription doesn't re-bind). Merges Google OAuth metadata into the profile.
  const syncGoogleProfile = useCallback(async (user: User) => {
    try {
      const meta = user.user_metadata ?? {};
      const existing = await getProfile(user.id);
      const supabaseHost = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? '';
      const hasOwnAvatar = !!existing?.avatar_url?.includes(supabaseHost);
      await upsertProfile(user.id, {
        display_name: (meta.full_name as string | undefined) ?? existing?.display_name ?? undefined,
        avatar_url: hasOwnAvatar
          ? existing!.avatar_url!
          : ((meta.avatar_url as string | undefined) ?? existing?.avatar_url ?? undefined),
      });
    } catch {
      // non-fatal — profile sync failure shouldn't block sign-in
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // The whole app is gated on `loading` (see the boot gate in the layouts), so
    // this flag MUST always clear or the app hangs on the splash loader forever.
    // getSession() can reject or stall (a hung token refresh, a paused/unreachable
    // Supabase project, a throw during web `detectSessionInUrl` parsing), so it's
    // guarded on every path: resolve, reject, and a hard safety timeout. On any
    // failure we fall through to the logged-out state — the catalogue browses fine
    // without a session, and a returning user can retry sign-in.
    const settle = (session: Session | null) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    // Backstop: if getSession() never settles, don't wedge the app on the loader.
    // Idempotent — setLoading(false) is a no-op once auth has already resolved.
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => settle(session))
      .catch(() => settle(null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      settle(session);
      // Tie events to the account, and cut the tie on the way out — otherwise
      // the next person to use the device inherits the last one's identity.
      if (session?.user) identify(session.user.id);
      else if (event === 'SIGNED_OUT') resetAnalytics();
      // Sync Google profile on web OAuth redirect (and any platform on first sign-in)
      if (event === 'SIGNED_IN' && session?.user) {
        const provider = session.user.app_metadata?.provider;
        if (provider === 'google') {
          syncGoogleProfile(session.user);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [syncGoogleProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) track('log_in', { method: 'password' });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) track('sign_up', { method: 'password' });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  };

  const syncAppleProfile = async (
    user: User,
    fullName?: { givenName?: string | null; familyName?: string | null } | null,
  ) => {
    try {
      const displayName = [fullName?.givenName, fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (!displayName) return; // Apple didn't return a name (subsequent sign-in)

      const existing = await getProfile(user.id);
      if (existing?.display_name) return; // never overwrite an existing name

      await upsertProfile(user.id, { display_name: displayName });
    } catch {
      // non-fatal — profile sync failure shouldn't block sign-in
    }
  };

  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Return to the page the user was acting on (not the root) — losing the
          // character/debate context after OAuth forced a re-navigation.
          redirectTo: window.location.href,
        },
      });
      return { error };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- native-only module, loaded lazily off the web path
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices();
      const { data: googleData } = await GoogleSignin.signIn();
      const idToken = googleData?.idToken;
      if (!idToken) return { error: new Error('No ID token returned from Google') };

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      return { error };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Google sign-in failed') };
    }
  };

  const signInWithApple = async (): Promise<{ error: Error | null }> => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          // Return to the page the user was acting on (not the root) — losing the
          // character/debate context after OAuth forced a re-navigation.
          redirectTo: window.location.href,
        },
      });
      return { error };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- iOS-only native module, loaded lazily off the web path
      const AppleAuthentication = require('expo-apple-authentication');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { error: new Error('No identity token from Apple') };
      }

      const {
        data: { user: signedInUser },
        error,
      } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) return { error };

      // Apple only returns the user's name on the FIRST sign-in (and never in the
      // token), so capture it here. Don't overwrite an existing display name.
      if (signedInUser) {
        await syncAppleProfile(signedInUser, credential.fullName);
      }
      return { error: null };
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
        return { error: null };
      }
      return { error: err instanceof Error ? err : new Error('Apple sign-in failed') };
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ error: Error | null }> => {
    // Re-authenticate first to ensure the session is fresh
    const email = (await supabase.auth.getUser()).data.user?.email ?? '';
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (reAuthError) return { error: reAuthError };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  const deleteAccount = async (): Promise<{ error: Error | null }> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { error: new Error('Not authenticated') };

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: new Error(body.error ?? 'Failed to delete account') };
    }
    await supabase.auth.signOut();
    return { error: null };
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    signInWithGoogle,
    signInWithApple,
    changePassword,
    deleteAccount,
  };
}
