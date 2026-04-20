import { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableWithoutFeedback,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import type { FirstIssue } from '../types';
import { COLORS } from '../constants/colors';

const DARK_BG = '#1B2A30';

interface Props {
  firstIssue: FirstIssue;
  onClose: () => void;
}

function Chip({ label, amber, dark }: { label: string; amber?: boolean; dark?: boolean }) {
  return (
    <View style={[styles.chip, amber ? styles.chipAmber : dark ? styles.chipDark : null]}>
      <Text style={[styles.chipText, amber ? styles.chipTextAmber : dark ? styles.chipTextDark : null]}>
        {label}
      </Text>
    </View>
  );
}

function ChipGroup({
  title,
  items,
  amber,
  dark,
}: {
  title: string;
  items: string[];
  amber?: boolean;
  dark?: boolean;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.chipGroup}>
      <Text style={[styles.chipGroupLabel, dark && styles.chipGroupLabelDark]}>{title}</Text>
      <View style={styles.chipRow}>
        {items.map((name, i) => (
          <Chip key={i} label={name} amber={amber} dark={dark} />
        ))}
      </View>
    </View>
  );
}

function IssueInfo({ firstIssue, dark = false }: { firstIssue: FirstIssue; dark?: boolean }) {
  const date = firstIssue.storeDate ?? firstIssue.coverDate;
  const year = date ? date.slice(0, 4) : null;
  const subtitle = [
    firstIssue.issueNumber ? `Issue #${firstIssue.issueNumber}` : null,
    year,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <>
      <Text style={styles.label}>First Appearance</Text>
      {firstIssue.seriesName ? (
        <Text style={[styles.seriesName, dark && styles.seriesNameDark]}>
          {firstIssue.seriesName}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={[styles.subtitle, dark && styles.subtitleDark]}>{subtitle}</Text>
      ) : null}
      {firstIssue.name ? (
        <Text style={[styles.issueName, dark && styles.issueNameDark]}>
          {firstIssue.name.split(';')[0].trim()}
        </Text>
      ) : null}
      {firstIssue.deck ? (
        <Text style={[styles.deck, dark && styles.deckDark]}>{firstIssue.deck}</Text>
      ) : null}
      <ChipGroup title="Creators" items={firstIssue.personCredits ?? []} dark={dark} />
      <ChipGroup title="Also debuted" items={firstIssue.debutCharacters ?? []} amber dark={dark} />
    </>
  );
}

export function FirstIssueModal({ firstIssue, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 700;

  const sheetY = useRef(new Animated.Value(900)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 28,
          stiffness: 280,
          mass: 0.9,
        }),
      ]).start();
    }
  }, []);

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 900, duration: 230, useNativeDriver: true }),
      ]).start(() => onClose());
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'none'}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {isDesktop ? (
        /* ── Desktop: two-column cinematic dialog ── */
        <Pressable style={styles.backdropDesktop} onPress={handleClose}>
          <Pressable style={styles.dialogDesktop} onPress={(e) => e.stopPropagation()}>
            {/* Close */}
            <Pressable style={styles.closeBtnDesktop} onPress={handleClose} hitSlop={10}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>

            {/* Left: full-bleed cover panel */}
            <View style={styles.desktopCoverPanel}>
              {firstIssue.imageUrl ? (
                <Image
                  source={{ uri: firstIssue.imageUrl }}
                  style={styles.coverDesktop}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : null}
            </View>

            {/* Right: info scroll */}
            <ScrollView
              style={styles.desktopScroll}
              contentContainerStyle={styles.desktopScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <IssueInfo firstIssue={firstIssue} dark={false} />
            </ScrollView>
          </Pressable>
        </Pressable>
      ) : (
        /* ── Native: cinematic dark bottom sheet ── */
        <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]}>
          {/* Tap-to-close zone above the sheet */}
          <TouchableWithoutFeedback onPress={handleClose}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
            {/* Drag handle */}
            <View style={styles.handle} />

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Cover */}
              {firstIssue.imageUrl ? (
                <View style={styles.coverWrap}>
                  <Image
                    source={{ uri: firstIssue.imageUrl }}
                    style={styles.cover}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                </View>
              ) : null}

              {/* Orange accent pip */}
              <View style={styles.accentLine} />

              {/* Info */}
              <View style={styles.mobileInfo}>
                <IssueInfo firstIssue={firstIssue} dark />
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  /* ── Backdrop ── */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  backdropDesktop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Native sheet ── */
  sheet: {
    width: '100%',
    height: '86%',
    backgroundColor: DARK_BG,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  handle: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(245,235,220,0.22)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 44 },

  coverWrap: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 6,
  },
  cover: {
    width: 152,
    height: 220,
    borderRadius: 10,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
  },

  accentLine: {
    width: 44,
    height: 2.5,
    backgroundColor: COLORS.orange,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 20,
  },

  mobileInfo: {
    paddingHorizontal: 26,
    paddingBottom: 8,
  },

  /* ── Desktop dialog ── */
  dialogDesktop: {
    width: 700,
    maxHeight: '84%',
    flexDirection: 'row',
    borderRadius: 18,
    overflow: 'hidden',
    alignSelf: 'center',
    ...Platform.select({
      web: { boxShadow: '0 28px 72px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.3)' } as object,
    }),
  },

  desktopCoverPanel: {
    width: 230,
    backgroundColor: DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 28,
    flexShrink: 0,
  },
  coverDesktop: {
    width: 166,
    height: 240,
    borderRadius: 8,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    ...Platform.select({
      web: { boxShadow: '0 12px 40px rgba(231,115,51,0.45)' } as object,
    }),
  },

  desktopScroll: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  desktopScrollContent: {
    paddingTop: 38,
    paddingBottom: 38,
    paddingHorizontal: 34,
  },

  /* Desktop close button */
  closeBtnDesktop: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(41,60,67,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
  },

  /* ── Shared text (light — desktop) ── */
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 10,
  },
  seriesName: {
    fontFamily: 'Flame-Bold',
    fontSize: 23,
    color: COLORS.navy,
    marginBottom: 5,
    lineHeight: 29,
  },
  subtitle: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.grey,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  issueName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy + 'BB',
    marginBottom: 14,
    lineHeight: 20,
  },
  deck: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy + '88',
    lineHeight: 22,
    marginBottom: 22,
  },

  /* Dark overrides (native) */
  seriesNameDark: { color: COLORS.beige },
  subtitleDark: { color: 'rgba(245,235,220,0.48)' },
  issueNameDark: { color: 'rgba(245,235,220,0.72)' },
  deckDark: { color: 'rgba(245,235,220,0.48)' },

  /* ── Chips ── */
  chipGroup: { marginBottom: 16 },
  chipGroupLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 8,
  },
  chipGroupLabelDark: { color: 'rgba(245,235,220,0.38)' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },

  chip: {
    backgroundColor: COLORS.navy + '14',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.navy + '22',
  },
  chipDark: {
    backgroundColor: 'rgba(245,235,220,0.09)',
    borderColor: 'rgba(245,235,220,0.14)',
  },
  chipAmber: {
    backgroundColor: COLORS.orange + '20',
    borderColor: COLORS.orange + '44',
  },
  chipText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
  },
  chipTextDark: { color: 'rgba(245,235,220,0.78)' },
  chipTextAmber: { color: COLORS.orange },
});
