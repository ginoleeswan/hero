// "Biggest Movers" as a momentum race: each surging hero rides an orange energy
// lane whose length tracks their week-over-week spike. A bar chart is the most
// universally legible "who's up most" visual — longer lane = bigger mover, read at
// a glance — and the gradient lanes + glowing leader keep it energetic, not a dry
// table. Lives in the dark "Right Now" band.
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeroImage } from '../../HeroImage';
import { COLORS } from '../../../constants/colors';
import type { WikiTrendingHero } from '../../../lib/db/trending';

export function TrendingMovers({
  heroes,
  onHeroPress,
}: {
  heroes: WikiTrendingHero[];
  onHeroPress: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  const pad = width < 640 ? 16 : 32;
  const nameW = width < 760 ? 92 : 150;

  if (heroes.length === 0) return null;
  const list = heroes.slice(0, width >= 760 ? 7 : 5);
  const max = Math.max(...list.map((h) => h.spikePct), 1);

  return (
    <View style={[s.section, { marginHorizontal: pad, padding: width < 640 ? 18 : 26 }] as object}>
      <View style={s.head}>
        <Text style={s.kicker as object}>This Week · On the Rise</Text>
        <Text style={s.title as object}>Biggest Movers</Text>
      </View>

      <View>
        {list.map((h, i) => {
          const lead = i === 0;
          const pct = (h.spikePct / max) * 100;
          return (
            <Pressable
              key={h.id}
              onPress={() => onHeroPress(h.id)}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [s.row, hovered && (s.rowHover as object)] as object
              }
            >
              <Text style={s.rank as object}>{i + 1}</Text>
              <View style={[s.face, lead && (s.faceLead as object)] as object}>
                <HeroImage
                  id={h.id}
                  name={h.name}
                  imageUrl={h.image_url}
                  portraitUrl={h.portrait_url}
                  grid
                  contentFit="cover"
                  contentPosition={{ top: 0, left: '50%' }}
                  style={StyleSheet.absoluteFill as object}
                  recyclingKey={h.id}
                />
              </View>
              <Text style={[s.name, { width: nameW }] as object} numberOfLines={1}>
                {h.name}
              </Text>
              <View style={s.lane as object}>
                <View
                  style={[s.fill, { width: `${pct}%` }, lead && (s.fillLead as object)] as object}
                />
              </View>
              <View style={s.spike}>
                <Ionicons name="caret-up" size={12} color={COLORS.orange} />
                <Text style={s.spikeText as object}>{h.spikePct}%</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const FACE = 40;

const s = StyleSheet.create({
  // Boxed in a lighter-navy glass panel (matches the pods / engage cards) so the
  // band alternates contained panels with bare full-width rails.
  section: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
  },
  head: { marginBottom: 16 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 2,
  } as object,
  title: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.beige, lineHeight: 28 } as object,

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 7,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  rowHover: { opacity: 0.82 } as object,
  rank: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: 'rgba(245,235,220,0.35)',
    width: 16,
    textAlign: 'center',
  } as object,
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 2,
    borderColor: 'rgba(231,115,51,0.45)',
  },
  faceLead: { borderColor: COLORS.orange, boxShadow: '0 0 18px rgba(231,115,51,0.5)' } as object,
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 17,
  } as object,
  // The race lane — fill length encodes the spike against the week's top mover.
  lane: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(245,235,220,0.07)',
    overflow: 'hidden',
    justifyContent: 'center',
  } as object,
  fill: {
    height: 12,
    borderRadius: 6,
    // Brighter at the leading edge — reads as energy/speed.
    backgroundImage: 'linear-gradient(to right, rgba(231,115,51,0.45), rgba(231,115,51,1))',
  } as object,
  fillLead: { boxShadow: '0 0 16px rgba(231,115,51,0.6)' } as object,
  spike: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 62, justifyContent: 'flex-end' },
  spikeText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange } as object,
});
