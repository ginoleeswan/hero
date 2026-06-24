import { type ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

interface Props {
  label: string;
  blurb?: string;
  children: ReactNode;
}

/** A labeled horizontal-scroll row of matchup cards. The caller decides whether
 *  to render it at all (a row with no matchups is simply omitted). */
export function MatchupRow({ label, blurb, children }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.label}>{label}</Text>
        {blurb ? <Text style={s.blurb}>{blurb}</Text> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {children}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  label: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.beige },
  blurb: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: 'rgba(245,235,220,0.5)' },
  row: { flexDirection: 'row', gap: 14, paddingVertical: 2, paddingRight: 8 },
});
