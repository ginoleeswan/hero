// src/components/character/QuickFacts.tsx — the character page's fact grid.
//
// This is web's desktop "QUICK FACTS" card, which native has only ever had as a
// collapsed `Dossier` bar you have to tap to open. On a phone that trade is
// right: the facts are secondary and the fold is precious. On a tablet there is
// a whole side column sitting empty beside the art, and a bar that says
// "Appearance, affiliations, relatives & more" is a worse use of it than the
// facts themselves.
//
// Web reference: `app/character/[id].web.tsx`, `sideCol`.
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { PaperCard } from '../ui/PaperCard';
import { COLORS, PAPER_TEXT } from '../../constants/colors';
import { TRACKING } from '../../constants/tokens';
import { factsFor, hasEnoughFacts } from './factsGrid';
import type { CharacterData } from '../../types';

export function QuickFacts({
  data,
  includeFirstAppearance,
  accent,
}: {
  data: CharacterData;
  includeFirstAppearance: boolean;
  accent?: string;
}) {
  const facts = factsFor(data, includeFirstAppearance);
  if (!hasEnoughFacts(facts)) return null;

  return (
    <PaperCard accent={accent}>
      <Text style={s.title}>Quick Facts</Text>
      <View style={s.grid}>
        {facts.map((f) => (
          <View key={f.key} style={[s.tile, f.wide ? s.tileWide : s.tileHalf]}>
            <Text style={s.label}>{f.label}</Text>
            <Text style={s.value}>{f.value}</Text>
          </View>
        ))}
      </View>
    </PaperCard>
  );
}

const s = StyleSheet.create({
  title: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: TRACKING.widest,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
    marginBottom: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    backgroundColor: 'rgba(41,60,67,0.04)',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  // Two-up, computed from the gap rather than a percentage, so a tile never
  // wraps a pixel early on a fractional column width.
  tileHalf: { flexGrow: 1, flexBasis: '47%', minWidth: 0 },
  tileWide: { flexGrow: 1, flexBasis: '100%' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: TRACKING.wider,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
  },
  value: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy, lineHeight: 18 },
});
