// Responsive bento grid for the command center. On wide screens children flow in
// rows you compose with <Bento.Row>; on narrow (<760) everything collapses to a
// single vertical stack. Gap is the shared density gap.
import { View, StyleSheet } from 'react-native';
import { type ReactNode } from 'react';
import { DENSITY } from './format';

function Grid({ children, fill }: { children: ReactNode; fill?: boolean }) {
  return <View style={[styles.grid, fill && styles.fill]}>{children}</View>;
}

function Row({ children, narrow, fill }: { children: ReactNode; narrow: boolean; fill?: boolean }) {
  return (
    <View style={[narrow ? styles.rowNarrow : styles.row, fill && !narrow && styles.fill]}>
      {children}
    </View>
  );
}

export const Bento = Object.assign(Grid, { Row });

const styles = StyleSheet.create({
  grid: { gap: DENSITY.gap, width: '100%' },
  row: { flexDirection: 'row', gap: DENSITY.gap, alignItems: 'stretch' },
  rowNarrow: { flexDirection: 'column', gap: DENSITY.gap },
  // Height-filling dashboard mode: rows divide the available height; panels stretch.
  fill: { flex: 1, minHeight: 0 },
});
