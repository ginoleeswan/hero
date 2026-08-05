import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Stack,
  useRouter,
  useSegments,
  useGlobalSearchParams,
  type ErrorBoundaryProps,
  ThemeProvider,
  DarkTheme,
} from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';
import { useAuth } from '../src/hooks/useAuth';
import { usePresenceHeartbeat } from '../src/hooks/usePresenceHeartbeat';
import { BootStage } from '../src/components/ui/BootStage';
import AnalyticsProvider from '../src/components/Analytics';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/lib/query/queryClient';
import { startAppFocusTracking } from '../src/lib/query/appFocus';
import { startAppOnlineTracking } from '../src/lib/query/appOnline';
import { OfflineBanner } from '../src/components/ui/OfflineBanner';
import { postAuthTarget } from '../src/lib/loginRedirect';
import { COLORS, INK_TEXT } from '../src/constants/colors';
import { initSentry, captureException } from '../src/lib/sentry';

// Start crash reporting as early as possible (module scope, before any render).
// No-op without EXPO_PUBLIC_SENTRY_DSN. init() also installs the native
// ErrorUtils handler that reports fatal JS errors for free.
initSentry();

if (Platform.OS !== 'web') {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  // Only configure when a client ID is actually available. Passing undefined
  // makes the native module fall back to looking up GoogleService-Info.plist,
  // which (when absent) throws an uncaught "failed to determine clientID" error.
  if (iosClientId || webClientId) {
    try {
      // Lazy require: the native module isn't present on web, so it can't be a
      // static top-level import.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      GoogleSignin.configure({ iosClientId, webClientId });
    } catch {
      // Native module unavailable (Expo Go) — Google Sign-In disabled
    }
  }
}

SplashScreen.preventAutoHideAsync();

// Expo Router renders this in place of the tree if a render throws, instead of a
// blank white screen — a graceful, on-brand recovery surface. Mirrors the web
// ErrorBoundary (app/_layout.web.tsx) visually. Reports via Sentry: the
// self-hosted client_errors feed is web-only (recordClientError no-ops on
// native), so native crashes only reach Sentry.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureException(error, { boundary: 'root-native' });
  }, [error]);

  return (
    <View style={eb.root}>
      <Text style={eb.title}>Something went wrong</Text>
      <Text style={eb.body}>
        An unexpected error interrupted the page. You can try again — if it keeps happening, reload
        the app.
      </Text>
      {__DEV__ ? <Text style={eb.detail}>{error.message}</Text> : null}
      <Pressable onPress={retry} style={eb.btn}>
        <Text style={eb.btnText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const eb = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1820',
    padding: 28,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 28, color: COLORS.beige, textAlign: 'center' },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(245,235,220,0.7)',
    textAlign: 'center',
    maxWidth: 420,
    marginTop: 10,
  },
  detail: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: INK_TEXT.faint,
    textAlign: 'center',
    marginTop: 14,
  },
  btn: {
    marginTop: 24,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  btnText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff' },
});

// Dark navigation theme — required for correct iOS 26 chrome (Expo native-tabs
// docs): without it the liquid-glass tab bar and headers resolve against the
// LIGHT default theme, flashing white and rendering the bar's material in the
// wrong tone over our dark canvas. Screens all paint their own backgrounds, so
// this only governs system chrome and transition fill.
const APP_DARK_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.orange,
    background: COLORS.deepNavy,
    card: COLORS.deepNavy,
  },
};

// Drives the presence heartbeat app-wide (no-op when logged out). Rendered as a
// sibling of the router so it lives for the whole session without re-mounting.
function PresenceHeartbeat() {
  usePresenceHeartbeat();
  return null;
}

// Tells React Query when the app is foregrounded, so `refetchOnWindowFocus`
// means something on native. Mounted beside the router for the same reason as
// the heartbeat: one subscription for the whole session.
function QueryFocusBridge() {
  useEffect(() => startAppFocusTracking(), []);
  return null;
}

// The connectivity half of the same idea: without it React Query assumes it is
// permanently online, so a phone that loses signal spends the timeout plus two
// retries on every query before admitting anything is wrong.
function QueryOnlineBridge() {
  useEffect(() => startAppOnlineTracking(), []);
  return null;
}

function AuthGate({ fontsReady }: { fontsReady: boolean }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Global (not local) — AuthGate is not the route component, so it reads the
  // login screen's ?returnTo from the app-wide param bag.
  const { returnTo } = useGlobalSearchParams<{ returnTo?: string | string[] }>();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    // On web, root is the landing page — always accessible. On native (incl. Expo Go),
    // authenticated users must be bounced out of "/" since there's no landing page there.
    const atRoot = Platform.OS !== 'web' && (segments.length as number) === 0;

    if (user && (inAuthGroup || atRoot)) {
      // Honor a sanitized returnTo so signing in returns the user to the page
      // they were acting on. The gate MUST own this: it's a second redirect
      // that would otherwise clobber any post-login navigation to /explore.
      router.replace(postAuthTarget(returnTo));
    } else {
      // Auth gate resolved (no redirect needed) — reveal the app. Driven by
      // async session + route segments, so it belongs in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled(true);
    }
  }, [user, loading, segments, router, returnTo]);

  // Single boot gate: one BootStage spans the whole cold start (fonts + auth)
  // so the logo choreography runs continuously instead of restarting at the
  // fonts→auth handoff. (During fonts the native splash is still up over it.)
  // The router mounts only once boot resolves; BootStage then plays its
  // opening reveal over it instead of hard-cutting from loader to app.
  const booting = !fontsReady || loading || !settled;

  return (
    <BootStage booting={booting}>
      {booting ? null : (
        <ThemeProvider value={APP_DARK_THEME}>
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      )}
    </BootStage>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'FlameSans-Regular': require('../assets/fonts/FlameSans-Regular.ttf'),
    'Flame-Regular': require('../assets/fonts/Flame-Regular.ttf'),
    'Flame-Bold': require('../assets/fonts/Flame-Bold.ttf'),
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    Righteous_400Regular,
  });

  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  // No early return for fonts — mount the provider tree immediately and let the
  // single boot gate inside AuthGate own the loading screen for both fonts and
  // auth. One persistent LogoLoader, no remount/animation restart.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AnalyticsProvider />
        <PresenceHeartbeat />
        <QueryFocusBridge />
        <QueryOnlineBridge />
        <AuthGate fontsReady={fontsReady} />
        <OfflineBanner />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
