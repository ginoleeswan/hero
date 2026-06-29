import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../constants/colors';
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
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [c.card, hovered && (c.cardHover as object)] as object
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
}: {
  villains: FearedVillain[];
  flush?: boolean;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pagePad = flush ? 0 : width < 640 ? 16 : 32;
  if (villains.length === 0) return null;

  return (
    <View style={c.section}>
      <View style={[c.header, { paddingLeft: pagePad }] as object}>
        <View style={c.accentBar} />
        <View style={c.headerText}>
          <Text style={c.label}>Public Enemies</Text>
          <Text style={c.title}>Most Feared</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[c.row, { paddingHorizontal: pagePad }] as object}
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
  header: { flexDirection: 'row', alignItems: 'stretch', gap: 14, marginBottom: 22 },
  accentBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.orange, minHeight: 38 },
  headerText: { gap: 2, justifyContent: 'center' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 36, color: COLORS.navy, lineHeight: 38 },

  row: { flexDirection: 'row', gap: 16, paddingTop: 4, paddingBottom: 8 },
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
