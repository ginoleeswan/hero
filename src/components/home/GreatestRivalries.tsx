// src/components/home/GreatestRivalries.tsx — native "Settle the Debate" carousel.
// Each card is a split-portrait matchup that taps straight into the compare arena.
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { VsBadge } from '../compare/VsBadge';
import { PressScale } from '../ui/PressScale';
import { COLORS, ORANGE_INK } from '../../constants/colors';
import type { Rivalry } from '../../lib/db/heroes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = Math.min(296, Math.round(SCREEN_WIDTH * 0.78));
const CARD_H = Math.round(CARD_W * 0.57);

function RivalryCard({ r, onPress }: { r: Rivalry; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} scale={0.96} style={c.card}>
      <HeroImage
        id={r.a.id}
        name={r.a.name}
        imageUrl={r.a.image_url}
        portraitUrl={r.a.portrait_url}
        style={c.faceA}
        contentFit="cover"
        contentPosition="top"
      />
      <HeroImage
        id={r.b.id}
        name={r.b.name}
        imageUrl={r.b.image_url}
        portraitUrl={r.b.portrait_url}
        style={c.faceB}
        contentFit="cover"
        contentPosition="top"
      />
      {/* Soft dark seam so the two portraits read as one matchup. */}
      <LinearGradient
        colors={['transparent', 'rgba(11,24,32,0.55)', 'transparent']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={c.seam}
      />
      <LinearGradient
        colors={['transparent', 'rgba(11,24,32,0.95)']}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={c.vsWrap}>
        <VsBadge size={40} variant="solid" />
      </View>
      {r.crossUniverse ? (
        <View style={c.dreamTag}>
          <Text style={c.dreamText}>Dream Match</Text>
        </View>
      ) : null}
      <View style={c.names}>
        <Text style={c.name} numberOfLines={1}>
          {r.a.name}
        </Text>
        <Text style={[c.name, c.nameRight]} numberOfLines={1}>
          {r.b.name}
        </Text>
      </View>
    </PressScale>
  );
}

/** Explore carousel of iconic rivalries — each card taps into the matchup arena. */
export function GreatestRivalries({
  rivalries,
  onOpen,
}: {
  rivalries: Rivalry[];
  onOpen: (path: string) => void;
}) {
  if (rivalries.length === 0) return null;
  return (
    <View style={c.section}>
      <View style={c.header}>
        <View style={c.accentBar} />
        <View style={c.headerText}>
          <Text style={c.label}>Settle the Debate</Text>
          <Text style={c.title}>Greatest Rivalries</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.row}>
        {rivalries.map((r) => (
          <RivalryCard
            key={`${r.a.id}-${r.b.id}`}
            r={r}
            onPress={() => onOpen(`/compare/${r.a.id}/${r.b.id}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const c = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 16 },
  header: {
    paddingHorizontal: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 11,
  },
  accentBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.orange },
  headerText: { gap: 2, justifyContent: 'center' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: ORANGE_INK,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.navy, lineHeight: 28 },
  row: { gap: 12, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  faceA: { position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' },
  faceB: { position: 'absolute', top: 0, right: 0, width: '50%', height: '100%' },
  seam: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 60, marginLeft: -30 },
  vsWrap: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20 },
  dreamTag: {
    position: 'absolute',
    top: 9,
    alignSelf: 'center',
    backgroundColor: 'rgba(206,155,51,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  dreamText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: '#1b1206',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  names: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  name: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
  },
  nameRight: { textAlign: 'right' },
});
