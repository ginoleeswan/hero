// The home-screen entry point for the daily "Guess the Hero" game. A premium
// navy banner with a blurred "mystery" tile, the day's hook, and the player's
// live streak. Shared by native + web Explore (renders RN primitives via RNW).
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { useDailyStreak } from '../../hooks/useDailyStreak';

export function DailyChallengeBanner({
  onPress,
  style,
}: {
  onPress: () => void;
  /** Override the outer card box (web centres + constrains it to the column). */
  style?: StyleProp<ViewStyle>;
}) {
  const streak = useDailyStreak();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Play the daily Guess the Hero challenge"
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      <LinearGradient
        colors={[COLORS.navy, COLORS.deepNavy]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bg}
      >
        {/* Mystery tile — a silhouette behind a question mark, hinting at the
            blurred portrait you'll uncover. */}
        <View style={styles.tile}>
          <Ionicons name="person" size={40} color="rgba(245,235,220,0.14)" />
          <Text style={styles.tileMark}>?</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.kicker}>Daily Challenge</Text>
          <Text style={styles.title}>Guess the Hero</Text>
          {streak > 0 ? (
            <View style={styles.streakRow}>
              <Text style={styles.streakText}>🔥 {streak} day streak</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.sub}>Keep it alive</Text>
            </View>
          ) : (
            <Text style={styles.sub}>A new mystery hero every day — can you name them?</Text>
          )}
        </View>

        <View style={styles.cta}>
          <Ionicons name="play" size={18} color="#fff" style={styles.ctaIcon} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 15,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    // Soft lift off the beige sheet.
    shadowColor: COLORS.navy,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  pressed: { opacity: 0.92 },
  bg: {
    // flex:1 lets the gradient fill a stretched card (web engage row) while
    // staying content-height when the card is auto-sized (native beige sheet).
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
  },
  tile: {
    width: 60,
    height: 74,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,24,32,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.35)',
  },
  tileMark: {
    position: 'absolute',
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    color: COLORS.orange,
  },
  body: { flex: 1 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    color: COLORS.beige,
    lineHeight: 28,
    marginTop: 1,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  streakText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange },
  dot: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.4)' },
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 3,
    flexShrink: 1,
  },
  cta: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
  },
  ctaIcon: { marginLeft: 2 }, // optically centre the play triangle
});
