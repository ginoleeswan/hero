// Responsive card grid — fills the available width with as many equal columns
// as fit at the given minimum card width, collapsing to one column on narrow.
// The command center's answer to "a collection of cards" (posts, reports,
// campaigns) so scroll lanes use the whole desktop width instead of one column.
// Web-only screen: CSS grid (auto-fill/minmax) does the column math natively —
// the house pattern (see web/home/CategoryPodGrid, web/search/SearchBrowse).
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { DENSITY } from '../format';

export function CardGrid({
  children,
  min = 340,
  style,
}: {
  children: ReactNode;
  /** Minimum card width before a new column wraps in. */
  min?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <View
      style={[
        styles.grid,
        { gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` },
        style,
      ] as object}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    display: 'grid',
    gap: DENSITY.gap,
    width: '100%',
  } as object,
});
