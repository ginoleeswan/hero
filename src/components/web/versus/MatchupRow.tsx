import { type ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

interface Props {
  label: string;
  blurb?: string;
  /** Desktop: lay the cards out as a wrapping grid instead of a scroll rail. */
  wrap?: boolean;
  children: ReactNode;
}

/** A labeled row of matchup cards. On mobile it's a horizontal scroll rail; on
 *  desktop the cards wrap into a grid so the full width is used. The caller
 *  decides whether to render it at all (an empty row is simply omitted). */
export function MatchupRow({ label, blurb, wrap, children }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.label}>{label}</Text>
        {blurb ? <Text style={s.blurb}>{blurb}</Text> : null}
      </View>
      {wrap ? (
        <View style={s.grid}>{children}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
          {children}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  label: { fontFamily: 'Flame-Regular', fontSize: 19, color: COLORS.beige },
  blurb: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: 'rgba(245,235,220,0.5)' },
  row: { flexDirection: 'row', gap: 14, paddingVertical: 2, paddingRight: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, rowGap: 26 },
});
