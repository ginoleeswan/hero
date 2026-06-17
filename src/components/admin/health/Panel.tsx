// Dense data panel — the command center's standard light card. Title + optional
// hint + optional right-aligned action, then children. One source of truth for
// panel chrome so every domain stays visually in lockstep.
import { View, Text, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { COLORS } from '../../../constants/colors';
import { DENSITY } from './format';

export function Panel({
  title,
  hint,
  action,
  children,
  style,
  scroll,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  // Fill the cell and scroll the body internally (keeps the page from scrolling
  // in a no-scroll dashboard). Pass only on desktop fill layouts.
  scroll?: boolean;
}) {
  return (
    <View style={[styles.panel, scroll && styles.panelScroll, style as ViewStyle]}>
      {(title || action) && (
        <View style={styles.head}>
          <View style={styles.headText}>
            {title && <Text style={styles.title}>{title}</Text>}
            {hint && <Text style={styles.hint}>{hint}</Text>}
          </View>
          {action}
        </View>
      )}
      {scroll ? (
        <ScrollView style={styles.scrollBody} nestedScrollEnabled showsVerticalScrollIndicator>
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fffdf8',
    borderRadius: DENSITY.radius,
    padding: DENSITY.panelPad,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.07)',
    shadowColor: '#3a2a14',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  // Internal-scroll mode: clip + let the body ScrollView scroll. Height is bounded
  // by the row's `align-items: stretch`; width/grow stays the panel's own (so a
  // fixed-width panel like Coverage isn't collapsed by an imposed flex).
  panelScroll: { minHeight: 0, overflow: 'hidden' },
  scrollBody: { flex: 1, minHeight: 0 } as object,
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: DENSITY.gap,
  },
  headText: { flex: 1, gap: 1 },
  title: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.black, lineHeight: 18 },
  hint: { fontFamily: 'Nunito_400Regular', fontSize: DENSITY.hintSize, color: COLORS.grey },
});
