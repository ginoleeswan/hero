import { type ReactNode, type ComponentProps } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, EYEBROW, INK_TEXT } from '../../../constants/colors';

interface Props {
  /** Small orange glyph beside the kicker (icon font, never emoji). */
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** The eyebrow line above the title — the row's category voice. */
  kicker: string;
  title: string;
  blurb?: string;
  /** Desktop: lay the cards out as a wrapping grid instead of a scroll rail. */
  wrap?: boolean;
  children: ReactNode;
}

/** A labeled row of matchup cards, headed with the app's chapter grammar
 *  (kicker + Flame title + blurb). On mobile it's a horizontal scroll rail; on
 *  desktop the cards wrap into a grid so the full width is used. The caller
 *  decides whether to render it at all (an empty row is simply omitted). */
export function MatchupRow({ icon, kicker, title, blurb, wrap, children }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={s.kickerRow}>
          <MaterialCommunityIcons name={icon} size={13} color={COLORS.orange} />
          <Text style={s.kicker as object}>{kicker}</Text>
        </View>
        <Text style={s.title}>{title}</Text>
        {blurb ? <Text style={s.blurb as object}>{blurb}</Text> : null}
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
  wrap: { gap: 14 },
  head: { gap: 2 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  kicker: { ...EYEBROW } as object,
  title: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.beige, lineHeight: 30 },
  blurb: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: INK_TEXT.faint,
    marginTop: 2,
  } as object,
  row: { flexDirection: 'row', gap: 14, paddingVertical: 2, paddingRight: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, rowGap: 26 },
});
