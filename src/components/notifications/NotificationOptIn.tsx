// src/components/notifications/NotificationOptIn.tsx — the soft pre-prompt.
//
// iOS grants one system prompt per install. Raising it cold spends the only ask
// on a reader who has no reason yet to say yes, and a denial cannot be undone
// from inside the app — it needs a trip to Settings that nobody makes. So this
// sheet goes first: it explains the one thing we would send, and only a "yes"
// here raises the real prompt. A "no" costs nothing and can be asked again
// after a cool-off (see policy.ts).
//
// It appears at one moment only: straight after a first daily-game win, while
// the reader is looking at a streak that has just started. What we are offering
// is the continuation of the thing they just did.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../ui/Sheet';
import { COLORS, PAPER_TEXT } from '../../constants/colors';
import { BODY, DISPLAY, LABEL, RADIUS } from '../../design';

export function NotificationOptIn({
  visible,
  streak,
  onAllow,
  onDismiss,
}: {
  visible: boolean;
  /** The streak they just started, so the offer names a real number. */
  streak: number;
  onAllow: () => void;
  onDismiss: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onDismiss} label="Daily reminders">
      <View style={s.head}>
        <View style={s.badge}>
          <Ionicons name="flame" size={20} color={COLORS.orange} />
        </View>
        <Text style={s.title}>Keep the streak alive</Text>
      </View>

      <Text style={s.body}>
        {streak >= 2
          ? `You’re ${streak} days in. We’ll send one reminder on an evening you haven’t played yet — nothing else.`
          : 'We’ll send one reminder on an evening you haven’t played yet — nothing else.'}
      </Text>

      {/* Saying exactly what the channel is used for is the whole argument. A
          vague "stay updated" is what trains people to decline by reflex. */}
      <View style={s.points}>
        {[
          'One notification a day, at most',
          'Only when your streak is actually at risk',
          'Off again in Settings, any time',
        ].map((p) => (
          <View key={p} style={s.point}>
            <Ionicons name="checkmark" size={15} color={COLORS.orange} />
            <Text style={s.pointText}>{p}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onAllow}
        style={({ pressed }: { pressed: boolean }) => [s.primary, pressed && s.pressed] as object}
        accessibilityRole="button"
      >
        <Text style={s.primaryText}>Turn on reminders</Text>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        style={({ pressed }: { pressed: boolean }) => [s.secondary, pressed && s.pressed] as object}
        accessibilityRole="button"
      >
        <Text style={s.secondaryText}>Not now</Text>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  badge: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.14)',
  },
  title: { ...DISPLAY.sm, color: COLORS.black },
  body: { ...BODY.lg, color: PAPER_TEXT.muted, marginBottom: 16 },
  points: { gap: 9, marginBottom: 22 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pointText: { ...LABEL.regular, color: PAPER_TEXT.primary },
  primary: {
    backgroundColor: COLORS.orange,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { ...LABEL.lg, color: '#fff' },
  secondary: { paddingVertical: 13, alignItems: 'center' },
  secondaryText: { ...LABEL.md, color: PAPER_TEXT.muted },
  pressed: { opacity: 0.75 },
});
