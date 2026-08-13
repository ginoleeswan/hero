// src/components/home/HallOfInfamy.tsx — native "Public Enemies" carousel.
// Villains ranked by enemy in-degree (how many heroes line up against them).
//
// Renders on two canvases: Explore's beige paper and the Arena's navy stage.
// Its heading was written for paper only (navy title, ORANGE_INK eyebrow — both
// chosen to be dark ENOUGH), so on the Arena it came out dark-on-dark and the
// section header was effectively invisible. `tone` picks the pair; the cards
// themselves are dark art either way and never needed it.
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { PressScale } from '../ui/PressScale';
import { COLORS, ORANGE_INK } from '../../constants/colors';
import { SECTION } from '../../constants/arenaType';
import type { FearedVillain } from '../../lib/db/heroes';
import { railCardWidth } from '../../constants/layout';

/**
 * The card's size, live.
 *
 * Was computed once from Dimensions.get('window') at import — correct on a
 * phone, frozen at launch orientation on an iPad. Above the tablet threshold
 * it becomes a fixed 210pt rather than 42% of the window, so a wide
 * screen shows more cards instead of enormous ones.
 */
function useCardSize() {
  const { width } = useWindowDimensions();
  const w = railCardWidth(width, 0.42, 210);
  return { width: w, height: Math.round(w * 1.33) };
}

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
    <PressScale onPress={onPress} scale={0.95} style={[c.card, useCardSize()]}>
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

/**
 * The villains the most heroes count as an enemy.
 *
 * The same rail reads as two different things depending on where it sits. On
 * Explore it is a browse rail and the cards open the character page, which is
 * what a browse surface promises. On the Arena — a tab whose entire job is
 * starting fights — that promise is wrong, so `eyebrow` and the caller's
 * `onPress` retarget it at the opponent picker: tap a villain, pick who fights
 * them. Same content, and on each canvas it does what its neighbours do.
 */
export function HallOfInfamy({
  villains,
  onPress,
  tone = 'paper',
  eyebrow = 'Public Enemies',
}: {
  villains: FearedVillain[];
  onPress: (id: string, name: string) => void;
  /** 'ink' for dark backgrounds (the Arena stage). */
  tone?: 'paper' | 'ink';
  /** Names what tapping a card DOES here — it differs by surface. */
  eyebrow?: string;
}) {
  if (villains.length === 0) return null;
  const ink = tone === 'ink';
  return (
    <View style={c.section}>
      <View style={c.header}>
        <View style={c.accentBar} />
        <View style={c.headerText}>
          <Text style={[c.label, ink && c.labelInk]}>{eyebrow}</Text>
          <Text style={[c.title, ink && c.titleInk]}>Most Feared</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.row}>
        {villains.map((v, i) => (
          <FearedCard key={v.id} villain={v} rank={i + 1} onPress={() => onPress(v.id, v.name)} />
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
  labelInk: { color: COLORS.goldAccent },
  title: { ...SECTION, color: COLORS.navy },
  titleInk: { color: COLORS.beige },
  row: { gap: 12, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
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
