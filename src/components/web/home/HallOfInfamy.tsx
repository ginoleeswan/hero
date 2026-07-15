import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, EYEBROW, INK_TEXT } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import type { FearedVillain } from '../../../lib/db/heroes';

const CARD_W = 176;
const CARD_H = 234;

function FearedCard({
  villain,
  rank,
  onPress,
}: {
  villain: FearedVillain;
  rank: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
        [c.card, (hovered || pressed) && (c.cardHover as object)] as object
      }
    >
      <HeroImage
        id={villain.id}
        name={villain.name}
        imageUrl={villain.image_url}
        portraitUrl={villain.portrait_url}
        contentFit="cover"
        contentPosition="top"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
        transition={180}
      />
      <View style={c.overlay as object} />
      <Text style={c.rank as object}>{rank}</Text>
      <View style={c.bottom}>
        <Text style={c.name as object} numberOfLines={1}>
          {villain.name}
        </Text>
        <Text style={c.feared as object}>Feared by {villain.fearedBy} heroes</Text>
      </View>
    </Pressable>
  );
}

/**
 * Carousel — the villains the most heroes line up against (enemy in-degree).
 * `flush` drops the self-managed page gutter when the host already pads the
 * column (e.g. the Versus feed, whose rows sit flush in a maxWidth container).
 */
export function HallOfInfamy({
  villains,
  flush = false,
  bleed = 0,
}: {
  villains: FearedVillain[];
  flush?: boolean;
  /** Host column padding to bleed past (mobile rail edge-to-edge). */
  bleed?: number;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pagePad = flush ? 0 : width < 640 ? 16 : 32;
  if (villains.length === 0) return null;

  return (
    <View style={c.section}>
      {/* Chapter head — same grammar as the Arena's discovery rows (this
          section lives on the ink Versus feed). */}
      <View style={[c.header, { paddingLeft: pagePad }] as object}>
        <View style={c.kickerRow}>
          <MaterialCommunityIcons name="skull-outline" size={13} color={COLORS.orange} />
          <Text style={c.label as object}>Public Enemies</Text>
        </View>
        <Text style={c.title}>Most Feared</Text>
        <Text style={c.blurb as object}>
          The villains the most heroes line up against — ranked by enemies made.
        </Text>
      </View>
      <ScrollView
        style={
          bleed
            ? ({ marginHorizontal: -bleed, marginBottom: -28 } as object)
            : ({ marginBottom: -28 } as object)
        }
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[c.row, { paddingHorizontal: pagePad + bleed }] as object}
      >
        {villains.map((v, i) => (
          <FearedCard
            key={v.id}
            villain={v}
            rank={i + 1}
            onPress={() => router.push(`/character/${v.id}` as Parameters<typeof router.push>[0])}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const c = StyleSheet.create({
  section: { marginBottom: 52 },
  header: { gap: 2, marginBottom: 16 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  label: { ...EYEBROW } as object,
  title: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.beige, lineHeight: 30 },
  blurb: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: INK_TEXT.faint,
    marginTop: 2,
  } as object,

  // paddingBottom carves headroom inside the scroller's clipped overflow so the
  // card drop-shadow isn't cut flat; the ScrollView's negative marginBottom
  // gives the space back to the layout.
  row: { flexDirection: 'row', gap: 16, paddingTop: 4, paddingBottom: 36 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  cardHover: {
    transform: [{ translateY: -5 }],
    boxShadow: '0 18px 44px rgba(0,0,0,0.34)',
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(11,24,32,0.96) 0%, rgba(11,24,32,0.05) 52%, transparent 100%)',
  } as object,
  rank: {
    position: 'absolute',
    top: 4,
    left: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 46,
    color: 'rgba(245,235,220,0.92)',
    textShadow: '0 2px 10px rgba(0,0,0,0.6)',
  } as object,
  bottom: { position: 'absolute', bottom: 11, left: 12, right: 12 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    lineHeight: 20, // ≥1.22× Flame floor
    color: COLORS.beige,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
  } as object,
  feared: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: '#E8543B',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 2,
  } as object,
});
