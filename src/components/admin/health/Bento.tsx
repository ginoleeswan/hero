// Responsive bento grid for the command center. On wide screens children flow in
// rows you compose with <Bento.Row>; on narrow (<760) everything collapses to a
// single vertical stack. Gap is the shared density gap.
import { View, StyleSheet } from 'react-native';
import { type ReactNode } from 'react';
import { DENSITY } from './format';

function Grid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

function Row({ children, narrow }: { children: ReactNode; narrow: boolean }) {
  return <View style={narrow ? styles.rowNarrow : styles.row}>{children}</View>;
}

export const Bento = Object.assign(Grid, { Row });

const styles = StyleSheet.create({
  grid: { gap: DENSITY.gap, width: '100%' },
  row: { flexDirection: 'row', gap: DENSITY.gap, alignItems: 'stretch' },
  rowNarrow: { flexDirection: 'column', gap: DENSITY.gap },
});
