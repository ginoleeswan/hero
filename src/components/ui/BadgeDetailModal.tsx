import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { COLORS, PAPER_TEXT, ACCENT_INK } from '../../constants/colors';
import type { Badge } from '../../lib/profile/badges';

interface Props {
  badge: Badge | null;
  onClose: () => void;
}

export function BadgeDetailModal({ badge, onClose }: Props) {
  const visible = !!badge;

  // Keep last badge during the close animation so content doesn't blank out.
  const [shown, setShown] = useState<Badge | null>(badge);
  if (badge && badge !== shown) setShown(badge);
  const b = badge ?? shown;

  const progressPct =
    b?.progress && !b.earned
      ? Math.min(100, Math.round((b.progress.current / b.progress.target) * 100))
      : null;

  return (
    <Sheet visible={visible} onClose={onClose} label="Badge detail" style={styles.body}>
      <View style={[styles.iconWrap, b?.earned ? styles.iconEarned : styles.iconLocked]}>
        <Ionicons
          name={(b?.icon ?? 'sparkles') as keyof typeof Ionicons.glyphMap}
          size={40}
          color={b?.earned ? '#fff' : COLORS.grey}
        />
      </View>

      <Text style={styles.label}>{b?.label}</Text>
      <Text style={styles.description}>{b?.description}</Text>

      {b?.earned ? (
        <View style={styles.earnedPill}>
          <Ionicons name="checkmark-circle" size={15} color={COLORS.green} />
          <Text style={styles.earnedText}>Earned</Text>
        </View>
      ) : progressPct !== null ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {Math.min(b!.progress!.current, b!.progress!.target)} / {b!.progress!.target}
          </Text>
        </View>
      ) : (
        <View style={styles.lockedPill}>
          <Ionicons name="lock-closed" size={13} color={COLORS.grey} />
          <Text style={styles.lockedText}>Locked</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={onClose}
      >
        <Text style={styles.buttonText}>Done</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, alignItems: 'center' },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  iconEarned: {
    backgroundColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  iconLocked: { backgroundColor: '#e8ddd0' },
  label: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    color: COLORS.navy,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: PAPER_TEXT.faint,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  earnedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99,169,54,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 24,
  },
  earnedText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: ACCENT_INK.green },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e8ddd0',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 24,
  },
  lockedText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: PAPER_TEXT.faint },
  progressWrap: { alignSelf: 'stretch', marginBottom: 24, gap: 8 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e8ddd0',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.orange },
  progressText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: PAPER_TEXT.faint,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontFamily: 'Nunito_700Bold', color: COLORS.beige, fontSize: 16 },
});
