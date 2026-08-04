import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  Stack,
  useRouter,
  useSegments,
  usePathname,
  useGlobalSearchParams,
  type ErrorBoundaryProps,
} from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import {
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../src/hooks/useAuth';
import { usePresenceHeartbeat } from '../src/hooks/usePresenceHeartbeat';
import { LogoLoader } from '../src/components/ui/LogoLoader';
import { TopBar, TOPBAR_HEIGHT } from '../src/components/web/TopBar';
import { SearchProvider } from '../src/contexts/SearchContext';
import { WebChromeProvider, AdaptiveStatusBarCover } from '../src/contexts/WebChromeContext';
import { CommandAlertsProvider } from '../src/contexts/CommandAlertsContext';
import { queryClient } from '../src/lib/query/queryClient';
import { COLORS, INK_TEXT } from '../src/constants/colors';
import { postAuthTarget } from '../src/lib/loginRedirect';
import AnalyticsProvider from '../src/components/Analytics';
import { recordClientError, installGlobalErrorCapture } from '../src/lib/db/clientErrors';
import { initSentry } from '../src/lib/sentry';

// Start crash reporting as early as possible (module scope, before any render).
// No-op without EXPO_PUBLIC_SENTRY_DSN.
initSentry();

// Expo Router renders this in place of the tree if a render throws, instead of a
// blank white screen — a graceful, on-brand recovery surface for production.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // Log the render crash to the self-hosted error feed (admin-read-only) before
  // showing the recovery surface.
  useEffect(() => {
    recordClientError('boundary', error.message, { stack: error.stack });
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
    height: '100%',
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

// Drives the presence heartbeat app-wide (no-op when logged out). Rendered as a
// sibling of the router so it lives for the whole session without re-mounting.
function PresenceHeartbeat() {
  usePresenceHeartbeat();
  return null;
}

function WebAuthGate({ fontsReady }: { fontsReady: boolean }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const { returnTo } = useGlobalSearchParams<{ returnTo?: string | string[] }>();
  const [settled, setSettled] = useState(false);

  const segs = segments as string[];
  const inAuthGroup = segs[0] === '(auth)';

  useEffect(() => {
    if (loading) return;
    const isRoot = segs.length === 0;

    if (user && (inAuthGroup || isRoot)) {
      // Honor a sanitized returnTo (the login screen's ?returnTo). The gate owns
      // this redirect — it would otherwise race/clobber any post-login nav. This
      // is also the ONLY post-OAuth redirect on web (OAuth full-page-returns to
      // the login URL, which now carries returnTo).
      router.replace(postAuthTarget(returnTo));
    } else {
      // Auth gate resolved (no redirect needed) — reveal the app. Driven by
      // async session + route segments, so it belongs in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled(true);
    }
  }, [user, loading, segs, inAuthGroup, router, returnTo]);

  // Native document scroll for every route: content bleeds edge-to-edge under the
  // iOS Safari toolbar and the toolbar can collapse (it only minimizes on
  // *document* scroll, not on a nested RNW ScrollView), and short screens can
  // still scroll when the toolbar/keyboard eats vertical space. Owning this here
  // means a new screen gets correct scrolling without remembering to opt in;
  // screens only declare their canvas colour via useWebCanvas.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.setProperty('overflow', 'visible', 'important');
  }, []);

  // Document scroll keeps the window offset across navigation (unlike a per-screen
  // ScrollView that always mounts at the top), so reset to the top on every route
  // change — otherwise a new screen can open part-scrolled.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  // Single boot gate: one LogoLoader instance spans the whole cold start (fonts
  // + auth), so the logo's draw-in animation runs continuously instead of
  // restarting at a fonts→auth handoff between two separate loaders.
  if (!fontsReady || loading || !settled) return <LogoLoader />;

  const isRoot = segs.length === 0;
  const showNav = !inAuthGroup && !isRoot;
  // Every content route lets its dark header bleed up under the floating nav for
  // one seamless surface (the top-scrim falls over the page's own hero), each
  // providing its own top clearance below. This is the DEFAULT — a new page gets
  // the scrim for free. Opt a route OUT here only if its top isn't a dark hero.
  const NO_BLEED_SEGMENTS: string[] = [];
  const bleedBehindNav = showNav && !segs.some((s) => NO_BLEED_SEGMENTS.includes(s));

  return (
    <SearchProvider>
      <WebChromeProvider>
        <View style={styles.root}>
          {/* Full nav on content routes; a logo-only bar on auth (mobile) so the
              brand sits in the same place app-wide. Hidden only on the bare root. */}
          {!isRoot && <TopBar logoOnly={inAuthGroup} />}
          <View
            style={
              [
                styles.content,
                showNav &&
                  !bleedBehindNav && {
                    paddingTop: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top))`,
                  },
              ] as object
            }
          >
            <Stack screenOptions={{ headerShown: false }} />
          </View>
          {/* Opaque strip over the iOS status-bar inset, painted the current
              chrome colour so it fuses seamlessly with the system status bar and
              tracks it dark→light as the page scrolls. */}
          <AdaptiveStatusBarCover />
        </View>
      </WebChromeProvider>
    </SearchProvider>
  );
}

export default function WebRootLayout() {
  // app/+html.tsx paints the document navy at build time (output: 'static'
  // renders it); this runtime repaint is belt-and-suspenders for any path that
  // bypasses the static shell — otherwise the white default shows through
  // wherever the app root doesn't fully cover (top strip, overscroll).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = '#0b1820';
    document.body.style.backgroundColor = '#0b1820';
    // The iOS Safari status-bar tint (theme-color meta) is owned by
    // WebChromeProvider, which tracks it to the page's current top colour.
    // iOS Safari 16+ ignores maximum-scale=1 in the viewport meta tag and still
    // auto-zooms when a focused input has font-size < 16 px.  Enforce the 16 px
    // floor globally so every text field — search bars, auth forms, filters — is
    // immune to the zoom, while still letting larger inherited sizes win.
    const noZoomStyle = document.createElement('style');
    noZoomStyle.textContent = 'input,textarea,select{font-size:max(16px,1em)!important}';
    document.head.appendChild(noZoomStyle);

    // Capture uncaught errors + rejected promises that never reach a React
    // ErrorBoundary, into the self-hosted error feed.
    const removeErrorCapture = installGlobalErrorCapture();

    return () => {
      noZoomStyle.remove();
      removeErrorCapture();
    };
  }, []);

  // Fonts load in two passes so the cold-start boot gate opens sooner WITHOUT any
  // flash of fallback text on visible content:
  //   • Critical (blocking) — every font used above the fold on the boot screen
  //     and first content paint: the brand Flame faces + the two common Nunito
  //     weights. The gate below waits on these, so visible text is never unstyled.
  //   • Deferred (non-blocking) — the heavy display weights + Righteous, used
  //     ONLY on detail pages, filter controls, the footer and admin — never above
  //     the fold on entry. Loading them in a second, un-awaited pass keeps ~300 KB
  //     of font bytes off the critical path (it matters on cellular); they resolve
  //     long before a visitor reaches a surface that uses them, so no swap shows.
  const [fontsLoaded, fontError] = useFonts({
    'FlameSans-Regular': require('../assets/fonts/FlameSans-Regular.ttf'),
    'Flame-Regular': require('../assets/fonts/Flame-Regular.ttf'),
    'Flame-Bold': require('../assets/fonts/Flame-Bold.ttf'),
    Nunito_400Regular,
    Nunito_700Bold,
  });
  // Deliberately not awaited by the boot gate — see note above.
  useFonts({
    Nunito_800ExtraBold,
    Nunito_900Black,
    Righteous_400Regular,
  });

  const fontsReady = fontsLoaded || !!fontError;

  // No early return for fonts — mount the provider tree immediately and let the
  // single boot gate inside WebAuthGate own the loading screen for both fonts and
  // auth. One persistent LogoLoader, no remount/animation restart.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AnalyticsProvider />
        <PresenceHeartbeat />
        <CommandAlertsProvider>
          <WebAuthGate fontsReady={fontsReady} />
        </CommandAlertsProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Deep navy app backdrop — this is what shows behind the transparent floating
  // header and on overscroll. Every screen paints its own canvas on top of it.
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  content: { flex: 1 },
});
