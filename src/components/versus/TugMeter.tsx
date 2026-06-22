import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props { splitA: number; splitB: number; labelA: string; labelB: string; }

/** The tug-of-war meter — a single bar split toward the stronger team. */
export function TugMeter({ splitA, splitB, labelA, labelB }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.cap}>
        <Text style={[styles.capTxt, { color: COLORS.red }]}>{labelA}</Text>
        <Text style={[styles.capTxt, { color: COLORS.blue }]}>{labelB}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fillA, { width: `${splitA}%` }]} />
        <Text style={[styles.pct, styles.pctL]}>{splitA}%</Text>
        <Text style={[styles.pct, styles.pctR]}>{splitB}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  cap: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  capTxt: { fontFamily: 'Nunito_700Bold', fontSize: 12, letterSpacing: 0.6 },
  track: {
    height: 28, borderRadius: 14, backgroundColor: COLORS.blue, overflow: 'hidden',
    justifyContent: 'center',
  },
  fillA: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.red },
  pct: { position: 'absolute', fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  pctL: { left: 10 },
  pctR: { right: 10 },
});
