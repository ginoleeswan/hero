import { useRef, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import type { Badge } from '../../lib/profile/badges';

const isWeb = Platform.OS === 'web';

interface Props {
  badge: Badge | null;
  onClose: () => void;
}

export function BadgeDetailModal({ badge, onClose }: Props) {
  const visible = !!badge;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isWeb) return;
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
  }, [visible, slideAnim]);

  // Keep last badge during the close animation so content doesn't blank out.
  const shown = useRef<Badge | null>(badge);
  if (badge) shown.current = badge;
  const b = badge ?? shown.current;

  const progressPct =
    b?.progress && !b.earned
      ? Math.min(100, Math.round((b.progress.current / b.progress.target) * 100))
      : null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={isWeb ? styles.overlayWeb : styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            isWeb ? (styles.dialog as object) : styles.sheet,
            !isWeb && {
              transform: [
                { translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) },
              ],
            },
          ]}
        >
          {!isWeb && <View style={styles.handle} />}

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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayWeb: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: COLORS.beige,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingBottom: 28,
    paddingTop: 28,
    width: 360,
    maxWidth: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(41,60,67,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
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
    color: COLORS.grey,
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
  earnedText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.green },
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
  lockedText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.grey },
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
    color: COLORS.grey,
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
