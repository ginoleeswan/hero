import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { getProfile, upsertProfile } from '../lib/db/profiles';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // Sync Google profile on web OAuth redirect (and any platform on first sign-in)
      if (event === 'SIGNED_IN' && session?.user) {
        const provider = session.user.app_metadata?.provider;
        if (provider === 'google') {
          syncGoogleProfile(session.user);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  };

  const syncGoogleProfile = async (user: User) => {
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
  };

  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      return { error };
    }

    try {
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

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ error: Error | null }> => {
    // Re-authenticate first to ensure the session is fresh
    const email = (await supabase.auth.getUser()).data.user?.email ?? '';
    const { error: reAuthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reAuthError) return { error: reAuthError };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  const deleteAccount = async (): Promise<{ error: Error | null }> => {
    const { data: { session } } = await supabase.auth.getSession();
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

  return { user, session, loading, signIn, signUp, signOut, resetPassword, signInWithGoogle, changePassword, deleteAccount };
}
