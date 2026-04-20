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

function IssueInfo({ firstIssue }: { firstIssue: FirstIssue }) {
  const date = firstIssue.storeDate ?? firstIssue.coverDate;
  const year = date ? date.slice(0, 4) : null;
  const subtitle = [
    firstIssue.issueNumber ? `Issue #${firstIssue.issueNumber}` : null,
    year,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Text style={styles.label}>First Appearance</Text>
      {firstIssue.seriesName ? (
        <Text style={styles.seriesName}>{firstIssue.seriesName}</Text>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {firstIssue.name ? <Text style={styles.issueName}>{firstIssue.name}</Text> : null}
      {firstIssue.deck ? <Text style={styles.deck}>{firstIssue.deck}</Text> : null}
      <ChipGroup title="Creators" items={firstIssue.personCredits ?? []} />
      <ChipGroup title="Also debuted" items={firstIssue.debutCharacters ?? []} amber />
    </>
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
      <Pressable style={[styles.backdrop, isDesktop && styles.backdropDesktop]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, isDesktop && styles.sheetDesktop]}
          onPress={(e) => e.stopPropagation()}
        >
          {isDesktop ? (
            /* Desktop: navy cover panel left, scrollable info right */
            <>
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
              <View style={styles.desktopRow}>
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
                <ScrollView
                  style={styles.desktopInfo}
                  contentContainerStyle={styles.desktopInfoContent}
                  showsVerticalScrollIndicator={false}
                >
                  <IssueInfo firstIssue={firstIssue} />
                </ScrollView>
              </View>
            </>
          ) : (
            /* Mobile (native + mobile web): drag handle, scrollable stacked */
            <>
              {Platform.OS !== 'web' ? <View style={styles.handle} /> : null}
              {Platform.OS === 'web' ? (
                <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </Pressable>
              ) : null}
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.mobileContent}>
                  {firstIssue.imageUrl ? (
                    <Image
                      source={{ uri: firstIssue.imageUrl }}
                      style={styles.cover}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  ) : null}
                  <View style={styles.mobileMeta}>
                    <IssueInfo firstIssue={firstIssue} />
                  </View>
                </View>
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdropDesktop: {
    justifyContent: 'center',
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
    width: 620,
    maxHeight: '82%',
    borderRadius: 16,
    paddingTop: 0,
    alignSelf: 'center',
    overflow: 'hidden',
    // Web shadow
    ...Platform.select({
      web: {
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
      } as object,
    }),
  },

  // Desktop layout
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 320,
  },
  desktopCoverPanel: {
    width: 200,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    flexShrink: 0,
  },
  coverDesktop: {
    width: 140,
    height: 203,
    borderRadius: 6,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      } as object,
    }),
  },
  desktopInfo: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  desktopInfoContent: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 28,
  },

  // Mobile stacked
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.navy + '30',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  mobileContent: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 4 },
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
  mobileMeta: { width: '100%' },

  // Close button
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.navy + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
  },

  // Text
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 8,
  },
  seriesName: {
    fontFamily: 'Flame-Bold',
    fontSize: 20,
    color: COLORS.navy,
    marginBottom: 4,
    lineHeight: 26,
  },
  subtitle: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.grey,
    marginBottom: 6,
  },
  issueName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    marginBottom: 10,
  },
  deck: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy + '99',
    lineHeight: 21,
    marginBottom: 18,
  },

  // Chips
  chipGroup: { marginBottom: 14 },
  chipGroupLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 7,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: COLORS.navy + '15',
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
