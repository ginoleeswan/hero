import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
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
      await GoogleSignin.hasPlayServices();
      const { data: googleData } = await GoogleSignin.signIn();
      const idToken = googleData?.idToken;
      if (!idToken) return { error: new Error('No ID token returned from Google') };

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (!error && data.user) await syncGoogleProfile(data.user);
      return { error };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Google sign-in failed') };
    }
  };

  return { user, session, loading, signIn, signUp, signOut, resetPassword, signInWithGoogle };
}
