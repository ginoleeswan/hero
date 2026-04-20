import { Modal, View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import type { FirstIssue } from '../types';
import { COLORS } from '../constants/colors';

interface Props {
  firstIssue: FirstIssue;
  onClose: () => void;
}

function Chip({ label, amber }: { label: string; amber?: boolean }) {
  return (
    <View style={[styles.chip, amber && styles.chipAmber]}>
      <Text style={[styles.chipText, amber && styles.chipTextAmber]}>{label}</Text>
    </View>
  );
}

function ChipGroup({ title, items, amber }: { title: string; items: string[]; amber?: boolean }) {
  if (!items.length) return null;
  return (
    <View style={styles.chipGroup}>
      <Text style={styles.chipGroupLabel}>{title}</Text>
      <View style={styles.chipRow}>
        {items.map((name, i) => (
          <Chip key={i} label={name} amber={amber} />
        ))}
      </View>
    </View>
  );
}

function IssueContent({ firstIssue }: { firstIssue: FirstIssue }) {
  const date = firstIssue.storeDate ?? firstIssue.coverDate;
  const year = date ? date.slice(0, 4) : null;
  const subtitle = [
    firstIssue.issueNumber ? `Issue #${firstIssue.issueNumber}` : null,
    year,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.content}>
      {firstIssue.imageUrl ? (
        <Image
          source={{ uri: firstIssue.imageUrl }}
          style={styles.cover}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      ) : null}

      <View style={styles.meta}>
        <Text style={styles.label}>First Appearance</Text>
        {firstIssue.seriesName ? (
          <Text style={styles.seriesName}>{firstIssue.seriesName}</Text>
        ) : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {firstIssue.name ? <Text style={styles.issueName}>{firstIssue.name}</Text> : null}
        {firstIssue.deck ? <Text style={styles.deck}>{firstIssue.deck}</Text> : null}

        <ChipGroup title="Creators" items={firstIssue.personCredits ?? []} />
        <ChipGroup title="Also debuted" items={firstIssue.debutCharacters ?? []} amber />
      </View>
    </View>
  );
}

export function FirstIssueModal({ firstIssue, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 700;

  return (
    <Modal
      visible
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, isDesktop && styles.sheetDesktop]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Drag handle — native only */}
          {Platform.OS !== 'web' ? <View style={styles.handle} /> : null}

          {/* Close button — web only */}
          {Platform.OS === 'web' ? (
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          ) : null}

          {isDesktop ? (
            /* Desktop web: side by side */
            <View style={styles.desktopRow}>
              {firstIssue.imageUrl ? (
                <Image
                  source={{ uri: firstIssue.imageUrl }}
                  style={styles.coverDesktop}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : null}
              <ScrollView style={styles.desktopInfo} showsVerticalScrollIndicator={false}>
                <IssueContentDesktop firstIssue={firstIssue} />
              </ScrollView>
            </View>
          ) : (
            /* Mobile (native + mobile web): scrollable stacked */
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <IssueContent firstIssue={firstIssue} />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function IssueContentDesktop({ firstIssue }: { firstIssue: FirstIssue }) {
  const date = firstIssue.storeDate ?? firstIssue.coverDate;
  const year = date ? date.slice(0, 4) : null;
  const subtitle = [
    firstIssue.issueNumber ? `Issue #${firstIssue.issueNumber}` : null,
    year,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View>
      <Text style={styles.label}>First Appearance</Text>
      {firstIssue.seriesName ? (
        <Text style={styles.seriesName}>{firstIssue.seriesName}</Text>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {firstIssue.name ? <Text style={styles.issueName}>{firstIssue.name}</Text> : null}
      {firstIssue.deck ? <Text style={styles.deck}>{firstIssue.deck}</Text> : null}
      <ChipGroup title="Creators" items={firstIssue.personCredits ?? []} />
      <ChipGroup title="Also debuted" items={firstIssue.debutCharacters ?? []} amber />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    overflow: 'hidden',
  },
  sheetDesktop: {
    width: 520,
    maxHeight: '85%',
    borderRadius: 16,
    marginBottom: 0,
    alignSelf: 'center',
    paddingTop: 16,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.navy + '30',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.navy + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
  },

  // Mobile stacked
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  content: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 4 },
  cover: {
    width: 130,
    height: 188,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  meta: { width: '100%' },

  // Desktop side by side
  desktopRow: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  coverDesktop: {
    width: 110,
    height: 159,
    borderRadius: 8,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  desktopInfo: { flex: 1 },

  // Text
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 6,
  },
  seriesName: {
    fontFamily: 'Flame-Bold',
    fontSize: 17,
    color: COLORS.navy,
    marginBottom: 3,
  },
  subtitle: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.grey,
    marginBottom: 4,
  },
  issueName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    marginBottom: 8,
  },
  deck: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy + 'aa',
    lineHeight: 20,
    marginBottom: 14,
  },

  // Chips
  chipGroup: { marginBottom: 12 },
  chipGroupLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: COLORS.navy + '18',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipAmber: { backgroundColor: COLORS.yellow + '22' },
  chipText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
  },
  chipTextAmber: { color: COLORS.gold },
});
