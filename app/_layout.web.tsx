import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Nunito_400Regular, Nunito_700Bold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';
import { useAuth } from '../src/hooks/useAuth';
import { LogoLoader } from '../src/components/ui/LogoLoader';
import { TopNav } from '../src/components/web/TopNav';
import { SearchProvider } from '../src/contexts/SearchContext';
import { COLORS } from '../src/constants/colors';

function WebAuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (loading) return;
    const segs = segments as string[];
    const inAuthGroup = segs[0] === '(auth)';
    const isRoot = segs.length === 0;

    if (user && (inAuthGroup || isRoot)) {
      router.replace('/(tabs)');
    } else if (!user && !inAuthGroup && !isRoot) {
      router.replace('/(auth)/login');
    } else {
      // Already on the correct screen — no redirect needed
      setSettled(true);
    }
  }, [user, loading, segments, router]);

  if (loading || !settled) return <LogoLoader />;

  const segs = segments as string[];
  const inAuthGroup = segs[0] === '(auth)';
  const isRoot = segs.length === 0;

  return (
    <SearchProvider>
      <View style={styles.root}>
        {!inAuthGroup && !isRoot && <TopNav />}
        <View style={styles.content}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </SearchProvider>
  );
}

export default function WebRootLayout() {
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
    <>
      <StatusBar style="dark" />
      <WebAuthGate />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  content: { flex: 1 },
});
