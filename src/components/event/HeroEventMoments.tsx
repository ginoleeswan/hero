// src/components/event/HeroEventMoments.tsx
// The weeks the world was reading about this character, on the character's page.
//
// The events archive is the most expensive data in the app — a decade of daily
// Wikipedia readership, swept one article at a time — and until now it was
// visible on exactly one surface: /event, which almost nobody reaches. This is
// the same data pointed the other way, on the page people actually open.
//
// The claim is deliberately the correlational one the edition pages settled on.
// "Read 12x more than usual during D23 2026" is true whatever caused it; "D23
// made people read about Ahsoka" is a causal claim readership cannot support,
// and it is the exact error the whole mover rewrite existed to remove. The same
// sentence has to be defensible on both pages, because it is the same number.
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PAPER_TEXT } from '../../constants/colors';
import type { HeroEventMoment } from '../../lib/db/events.heroMoments';

/** "12x" / "3.1x". Below ten keeps a decimal, where the difference between 3.1
 *  and 3 is most of the claim; above it, a decimal is false precision on a
 *  pageview ratio. Same rule as the edition masthead, so a reader who follows
 *  the link sees the number they clicked. */
const fmtSpike = (n: number) => (n >= 10 ? `${Math.round(n)}×` : `${n.toFixed(1)}×`);

const YEAR = (m: HeroEventMoment) => (m.liveFrom ? m.liveFrom.slice(0, 4) : '');

export function HeroEventMoments({
  moments,
  onPress,
}: {
  moments: HeroEventMoment[];
  onPress: (slug: string, editionSlug: string) => void;
}) {
  if (moments.length === 0) return null;

  return (
    <View style={s.list}>
      {moments.map((m) => {
        const accent = m.accent ?? COLORS.orange;
        return (
          <Pressable
            key={`${m.slug}-${m.editionSlug}`}
            style={s.row}
            onPress={() => onPress(m.slug, m.editionSlug)}
            accessibilityRole="link"
            accessibilityLabel={
              m.spike === null
                ? `${m.headline} ${YEAR(m)}`
                : `Read ${fmtSpike(m.spike)} more than usual during ${m.headline} ${YEAR(m)}`
            }
          >
            {/* The figure leads. It is the reason the row exists, and in the
                archive's own sections it is set at display scale for the same
                reason — a multiple tucked in at caption size reads as a
                footnote to the name rather than as the point. */}
            <Text style={[s.spike, { color: accent }]}>
              {m.spike === null ? '—' : fmtSpike(m.spike)}
            </Text>
            <View style={s.body}>
              <Text style={s.event} numberOfLines={1}>
                {m.headline} {YEAR(m)}
              </Text>
              <Text style={s.meta} numberOfLines={1}>
                {m.venueCity ?? 'Broadcast'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={PAPER_TEXT.faint} />
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  // Fixed width so the figures form a column and the names start on one line.
  // Ragged left edges on a list of numbers is the thing that makes a leaderboard
  // read as a paragraph.
  spike: {
    fontFamily: 'Flame-Regular',
    fontSize: 23,
    // Clamped Flame needs lineHeight >= 1.22x fontSize.
    lineHeight: 30,
    width: 74,
  },
  body: { flex: 1, minWidth: 0 },
  event: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14.5,
    lineHeight: 20,
    color: COLORS.deepNavy,
  },
  meta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: PAPER_TEXT.muted,
  },
});
