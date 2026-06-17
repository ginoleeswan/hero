// src/components/home/HallOfInfamy.tsx — native "Public Enemies" carousel.
// Villains ranked by enemy in-degree (how many heroes line up against them).
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { PressScale } from '../ui/PressScale';
import { COLORS } from '../../constants/colors';
import type { FearedVillain } from '../../lib/db/heroes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = Math.round(SCREEN_WIDTH * 0.42);
const CARD_H = Math.round(CARD_W * 1.33);

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
    <PressScale onPress={onPress} scale={0.95} style={c.card}>
      <HeroImage
        id={villain.id}
        name={villain.name}
        imageUrl={villain.image_url}
        portraitUrl={villain.portrait_url}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(11,24,32,0.96)', 'rgba(11,24,32,0.05)', 'transparent']}
        locations={[0, 0.52, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={c.rank}>{rank}</Text>
      <View style={c.bottom}>
        <Text style={c.name} numberOfLines={1}>
          {villain.name}
        </Text>
        <Text style={c.feared}>Feared by {villain.fearedBy} heroes</Text>
      </View>
    </PressScale>
  );
}

/** Explore carousel — the villains the most heroes count as an enemy. */
export function HallOfInfamy({
  villains,
  onPress,
}: {
  villains: FearedVillain[];
  onPress: (id: string) => void;
}) {
  if (villains.length === 0) return null;
  return (
    <View style={c.section}>
      <View style={c.header}>
        <View style={c.accentBar} />
        <View style={c.headerText}>
          <Text style={c.label}>Public Enemies</Text>
          <Text style={c.title}>Most Feared</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.row}>
        {villains.map((v, i) => (
          <FearedCard key={v.id} villain={v} rank={i + 1} onPress={() => onPress(v.id)} />
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
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.navy, lineHeight: 28 },
  row: { gap: 12, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  rank: {
    position: 'absolute',
    top: 2,
    left: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 44,
    color: 'rgba(245,235,220,0.92)',
  },
  bottom: { position: 'absolute', bottom: 11, left: 12, right: 12 },
  name: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.beige },
  feared: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: '#E8543B',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
