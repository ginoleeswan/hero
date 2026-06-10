import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Nunito_400Regular, Nunito_700Bold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../src/hooks/useAuth';
import { LogoLoader } from '../src/components/ui/LogoLoader';
import { TopBar, TOPBAR_HEIGHT } from '../src/components/web/TopBar';
import { SearchProvider } from '../src/contexts/SearchContext';
import { queryClient } from '../src/lib/query/queryClient';
import { COLORS } from '../src/constants/colors';

function WebAuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const [settled, setSettled] = useState(false);

  const segs = segments as string[];
  const inAuthGroup = segs[0] === '(auth)';

  useEffect(() => {
    if (loading) return;
    const isRoot = segs.length === 0;

    if (user && (inAuthGroup || isRoot)) {
      router.replace('/explore');
    } else {
      setSettled(true);
    }
  }, [user, loading, segs, inAuthGroup, router]);

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

  if (loading || !settled) return <LogoLoader />;

  const isRoot = segs.length === 0;
  const showNav = !inAuthGroup && !isRoot;
  // Every top-level page lets its dark header bleed up under the floating nav for
  // one seamless surface (each provides its own top clearance below).
  const bleedBehindNav =
    segs.includes('explore') ||
    segs.includes('character') ||
    segs.includes('compare') ||
    segs.includes('search') ||
    segs.includes('category') ||
    segs.includes('biography');

  return (
    <SearchProvider>
      <View style={styles.root}>
        {showNav && <TopBar />}
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
        {/* Safe-area top cover (glow technique): a frosted strip exactly the
            height of the iOS status-bar inset, pinned above everything. Content
            scrolls edge-to-edge behind it; the status-bar zone reads as one clean
            frosted strip instead of a bare band. env() → 0 where no safe area. */}
        <View pointerEvents="none" style={styles.statusBarCover} />
      </View>
    </SearchProvider>
  );
}

export default function WebRootLayout() {
  // Expo's single web output ignores app/+html.tsx, so paint the document
  // background deep-navy at runtime — otherwise the white default shows through
  // wherever the app root doesn't fully cover (top strip, overscroll).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = '#0b1820';
    document.body.style.backgroundColor = '#0b1820';
    // iOS Safari 16+ ignores maximum-scale=1 in the viewport meta tag and still
    // auto-zooms when a focused input has font-size < 16 px.  Enforce the 16 px
    // floor globally so every text field — search bars, auth forms, filters — is
    // immune to the zoom, while still letting larger inherited sizes win.
    const noZoomStyle = document.createElement('style');
    noZoomStyle.textContent = 'input,textarea,select{font-size:max(16px,1em)!important}';
    document.head.appendChild(noZoomStyle);
    return () => noZoomStyle.remove();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    'FlameSans-Regular': require('../assets/fonts/FlameSans-Regular.ttf'),
    'Flame-Regular': require('../assets/fonts/Flame-Regular.ttf'),
    'Flame-Bold': require('../assets/fonts/Flame-Bold.ttf'),
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_900Black,
    Righteous_400Regular,
  });

  if (!fontsLoaded && !fontError) return <LogoLoader />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <WebAuthGate />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Deep navy app backdrop — this is what shows behind the transparent floating
  // header and on overscroll. Every screen paints its own canvas on top of it.
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  content: { flex: 1 },
  statusBarCover: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 'env(safe-area-inset-top)',
    backgroundColor: 'rgba(11,24,32,0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    zIndex: 9999,
  } as object,
});
