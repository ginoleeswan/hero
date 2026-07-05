// Dense data panel — the command center's standard light card. Title + optional
// hint + optional right-aligned action, then children. One source of truth for
// panel chrome so every domain stays visually in lockstep.
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { type ReactNode } from 'react';
import { COLORS } from '../../../constants/colors';
import { DENSITY } from './format';

export function Panel({
  title,
  hint,
  action,
  children,
  style,
  fill,
  scroll,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  // Height-filling dashboard cell: stretch to the row's height and clip, so the
  // body can scroll internally instead of growing the page. The single source of
  // truth for the desktop "divide the viewport" layout.
  fill?: boolean;
  // Whether the body is an internally-scrolling ScrollView. Defaults to `fill`
  // (a fill cell scrolls its overflow). Pass `scroll={false}` when the child owns
  // its own scroller (e.g. a styled, self-scrolling list box).
  scroll?: boolean;
}) {
  const scrolls = scroll ?? fill;
  // Mobile: drop the descriptive hint paragraph to reclaim 2–3 lines per panel —
  // the ⓘ tooltip (where present) still carries it. Desktop keeps the hint.
  const { width } = useWindowDimensions();
  const narrow = width < 760;
  return (
    <View
      style={[
        styles.panel,
        narrow && styles.panelNarrow,
        fill && styles.fill,
        style as ViewStyle,
        // Mobile stacks panels vertically, so any `flex`/`flex:1.5` a domain passes
        // (for desktop side-by-side width ratios) must be neutralised — otherwise a
        // flex-basis:0% panel gets sized by flex instead of its content and a tall
        // list spills under the bottom padding. Applied AFTER `style` so it wins.
        narrow && !fill && styles.panelStack,
      ]}
    >
      {(title || action) && (
        <View style={styles.head}>
          <View style={styles.headText}>
            {title && <Text style={styles.title}>{title}</Text>}
            {hint && !narrow && <Text style={styles.hint}>{hint}</Text>}
          </View>
          {action}
        </View>
      )}
      {scrolls ? (
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
  // Independently-tunable mobile card padding (wires DENSITY.panelPadNarrow so the
  // token isn't dead — more generous than the dense desktop pad).
  panelNarrow: { padding: DENSITY.panelPadNarrow },
  // Mobile: size to content, ignoring desktop flex ratios (see call site).
  panelStack: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  // Fill mode: stretch into the row's height (align-items: stretch) and clip, so
  // the body ScrollView can bound itself and scroll instead of growing the page.
  // A caller may override `flex` (e.g. flex: 1.5) via `style`; minHeight/overflow
  // stay from here.
  fill: { flex: 1, minHeight: 0, overflow: 'hidden' },
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
