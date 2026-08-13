import { type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../ui/Text';
import { COLORS, PAPER_TEXT } from '../../constants/colors';

/**
 * A grounding surface for a profile section. Sections used to float as bare
 * headings on the beige canvas, which read as "detached"; wrapping each one in a
 * soft paper panel with an accent-marked title gives the page structure and lets
 * the content sit on something. The title uses the accent rule + Flame display
 * grammar shared with the elevated fandom sections.
 */
export function SectionShell({
  title,
  count,
  headerRight,
  children,
  padded = true,
  style,
}: {
  title: string;
  /** Optional count shown after the title (e.g. earned/total or item count). */
  count?: string;
  /** Optional node pinned to the right of the header (e.g. a toggle). */
  headerRight?: ReactNode;
  children: ReactNode;
  /** When false, children get no inner horizontal padding (edge-to-edge grids). */
  padded?: boolean;
  /** Outer style override — e.g. a horizontal gutter on mobile. */
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.shell, style]}>
      <View style={styles.header}>
        <View style={styles.accent} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {count != null && <Text style={styles.count}>{count}</Text>}
        {headerRight != null && <View style={styles.headerRight}>{headerRight}</View>}
      </View>
      <View style={padded ? styles.body : undefined}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 22,
    paddingBottom: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
    // Soft warm-dark lift so panels rise off the beige (deep-navy tint, never black).
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  accent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
    marginRight: 10,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    lineHeight: 28, // ≥ 1.22× fontSize for Flame descenders
    color: COLORS.navy,
    flexShrink: 1,
  },
  count: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: PAPER_TEXT.faint,
    marginLeft: 10,
  },
  headerRight: { marginLeft: 'auto' },
  body: { paddingHorizontal: 24 },
});
