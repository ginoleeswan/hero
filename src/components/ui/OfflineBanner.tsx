import { useEffect, useState } from 'react';
import { Animated, Text, View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useIsOffline } from '../../hooks/useIsOffline';

/**
 * A quiet, persistent "you're offline" pill.
 *
 * Deliberately not a Toast: a toast says "something just happened" and leaves,
 * whereas this is a *state* the user stays in, and it must stay on screen for
 * as long as it is true. It shares the Toast's shape and shadow so it reads as
 * the same family rather than a new piece of chrome.
 *
 * It says nothing about what to do, because there is nothing to do — the data
 * layer resumes on its own the moment signal returns (`appOnline.ts`). Telling
 * someone with no signal to "check your connection" is noise.
 */
export function OfflineBanner() {
  const offline = useIsOffline();
  const [opacity] = useState(() => new Animated.Value(0));
  // Kept mounted through the fade-out so the exit animation can play; unmounting
  // on `offline` alone would make it vanish instantly.
  const [mounted, setMounted] = useState(offline);

  useEffect(() => {
    if (offline) setMounted(true);
    const animation = Animated.timing(opacity, {
      toValue: offline ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !offline) setMounted(false);
    });
    return () => animation.stop();
  }, [offline, opacity]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pill, { opacity }, Platform.OS === 'web' ? (styles.pillWeb as object) : null]}
      accessibilityRole="alert"
      accessibilityLabel="You are offline"
    >
      <View style={styles.row}>
        <Ionicons name="cloud-offline-outline" size={15} color={COLORS.beige} />
        <Text style={styles.text}>You&rsquo;re offline</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    // Fixed offset rather than safe-area insets: this mounts as a sibling of
    // the router, outside expo-router's SafeAreaProvider, so useSafeAreaInsets
    // has no context to read. 96 clears the tab bar, where Toast's 40 would
    // sit behind it.
    bottom: 96,
    alignSelf: 'center',
    backgroundColor: COLORS.navy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  pillWeb: {
    zIndex: 9999,
  } as object,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.beige,
  },
});
