import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, ORANGE_INK } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import { VsBadge } from '../../compare/VsBadge';
import type { Rivalry } from '../../../lib/db/heroes';

const CARD_W = 296;
const CARD_H = 168;

function RivalryCard({ r, onPress }: { r: Rivalry; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [c.card, hovered && (c.cardHover as object)] as object
      }
    >
      <HeroImage
        id={r.a.id}
        name={r.a.name}
        imageUrl={r.a.image_url}
        portraitUrl={r.a.portrait_url}
        style={c.faceA as object}
        contentFit="cover"
        contentPosition="top"
        transition={180}
      />
      <HeroImage
        id={r.b.id}
        name={r.b.name}
        imageUrl={r.b.image_url}
        portraitUrl={r.b.portrait_url}
        style={c.faceB as object}
        contentFit="cover"
        contentPosition="top"
        transition={180}
      />
      <View style={c.seam as object} />
      <View style={c.overlay as object} />
      <View style={c.vsWrap as object}>
        <VsBadge size={42} variant="solid" />
      </View>
      {r.crossUniverse ? (
        <View style={c.dreamTag as object}>
          <Text style={c.dreamText as object}>Dream Match</Text>
        </View>
      ) : null}
      <View style={c.names as object}>
        <Text style={c.name as object} numberOfLines={1}>
          {r.a.name}
        </Text>
        <Text style={[c.name, { textAlign: 'right' }] as object} numberOfLines={1}>
          {r.b.name}
        </Text>
      </View>
    </Pressable>
  );
}

/** Explore carousel of iconic rivalries — each card taps straight into the arena. */
export function GreatestRivalries({ rivalries }: { rivalries: Rivalry[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pagePad = width < 640 ? 16 : 32;
  if (rivalries.length === 0) return null;

  return (
    <View style={c.section}>
      <View style={[c.header, { paddingLeft: pagePad }] as object}>
        <View style={c.accentBar} />
        <View style={c.headerText}>
          <Text style={c.label}>Settle the Debate</Text>
          <Text style={c.title}>Greatest Rivalries</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[c.row, { paddingHorizontal: pagePad }] as object}
      >
        {rivalries.map((r) => (
          <RivalryCard
            key={`${r.a.id}-${r.b.id}`}
            r={r}
            onPress={() =>
              router.push(`/compare/${r.a.id}/${r.b.id}` as Parameters<typeof router.push>[0])
            }
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
    color: ORANGE_INK,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 36, color: COLORS.navy, lineHeight: 38 },

  row: { flexDirection: 'row', gap: 16, paddingTop: 4, paddingBottom: 8 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
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
  faceA: { position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' } as object,
  faceB: { position: 'absolute', top: 0, right: 0, width: '50%', height: '100%' } as object,
  // Soft dark seam down the centre so the two portraits read as one matchup.
  seam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 60,
    marginLeft: -30,
    backgroundImage:
      'linear-gradient(to right, transparent 0%, rgba(11,24,32,0.55) 50%, transparent 100%)',
  } as object,
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    backgroundImage: 'linear-gradient(to top, rgba(11,24,32,0.95) 0%, transparent 100%)',
  } as object,
  vsWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -21,
    marginTop: -28,
  } as object,
  dreamTag: {
    position: 'absolute',
    top: 9,
    alignSelf: 'center',
    backgroundColor: 'rgba(206,155,51,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  } as object,
  dreamText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: '#1b1206',
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as object,
  names: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  } as object,
  name: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
  } as object,
});
