import { useEffect, useState } from 'react';
import { Animated, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useOtaUpdate } from '../../hooks/useOtaUpdate';

/**
 * "New version ready — Restart", offered rather than imposed.
 *
 * Sits in the same family as OfflineBanner (same shape, shadow and placement)
 * but is tappable, and uses the accent colour because unlike being offline this
 * is something the user can act on. It never dismisses itself: a staged update
 * stays staged, so the offer stays true until taken.
 */
export function UpdateReadyPill() {
  const { ready, applying, apply } = useOtaUpdate();
  const [opacity] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(ready);

  useEffect(() => {
    if (ready) setMounted(true);
    const animation = Animated.timing(opacity, {
      toValue: ready ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !ready) setMounted(false);
    });
    return () => animation.stop();
  }, [ready, opacity]);

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <Pressable
        onPress={apply}
        disabled={applying}
        accessibilityRole="button"
        accessibilityLabel="A new version is ready. Restart to use it."
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        {applying ? (
          <ActivityIndicator size="small" color={COLORS.deepNavy} />
        ) : (
          <Ionicons name="arrow-down-circle-outline" size={16} color={COLORS.deepNavy} />
        )}
        <Text style={styles.text}>{applying ? 'Restarting' : 'New version — restart'}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // Matches OfflineBanner. The two are mutually exclusive in practice — an
    // update can't finish downloading while offline — so they never stack.
    bottom: 96,
    alignSelf: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.goldAccent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.deepNavy,
  },
});
