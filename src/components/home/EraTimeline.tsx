// src/components/home/EraTimeline.tsx — native "Comics History" timeline.
// Heroes bucketed by comic age, hung off an orange spine (Golden → Modern).
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { HeroImage } from '../HeroImage';
import { PressScale } from '../ui/PressScale';
import { COLORS, PAPER_TEXT } from '../../constants/colors';
import type { EraBucket, EraHero } from '../../lib/db/heroes';

const ERA_YEARS: Record<string, string> = {
  'Golden Age': '1938 – 1955',
  'Silver Age': '1956 – 1969',
  'Bronze Age': '1970 – 1984',
  'Modern Age': '1985 – Today',
};

function EraCard({ hero, onPress }: { hero: EraHero; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} scale={0.94} style={t.card}>
      <View style={t.cardImgWrap}>
        <HeroImage
          id={hero.id}
          name={hero.name}
          imageUrl={hero.image_url}
          portraitUrl={hero.portrait_url}
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill}
          recyclingKey={hero.id}
        />
      </View>
      <Text style={t.cardName} numberOfLines={1}>
        {hero.name}
      </Text>
      <Text style={t.cardYear}>{hero.year}</Text>
    </PressScale>
  );
}

export function EraTimeline({
  eras,
  onPress,
}: {
  eras: EraBucket[];
  onPress: (id: string) => void;
}) {
  if (eras.length === 0) return null;
  return (
    <View style={t.section}>
      <View style={t.header}>
        <View style={t.accentBar} />
        <View style={t.headerText}>
          <Text style={t.label}>Comics History</Text>
          <Text style={t.title}>Through the Ages</Text>
        </View>
      </View>

      <View style={t.timeline}>
        <View style={t.spine} pointerEvents="none" />
        {eras.map((bucket) => (
          <View key={bucket.era} style={t.eraBlock}>
            <View style={t.eraDot} />
            <View style={t.eraHead}>
              <Text style={t.eraName}>{bucket.era}</Text>
              <Text style={t.eraYears}>{ERA_YEARS[bucket.era] ?? ''}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={t.heroScroll}
              contentContainerStyle={t.heroStrip}
            >
              {bucket.heroes.map((h) => (
                <EraCard key={h.id} hero={h} onPress={() => onPress(h.id)} />
              ))}
            </ScrollView>
          </View>
        ))}
      </View>
    </View>
  );
}

const t = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 16 },
  header: {
    paddingHorizontal: 15,
    marginBottom: 16,
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

  timeline: { position: 'relative', paddingLeft: 41 },
  spine: {
    position: 'absolute',
    left: 20,
    top: 8,
    bottom: 24,
    width: 2,
    backgroundColor: 'rgba(231,115,51,0.25)',
  },
  eraBlock: { position: 'relative', marginBottom: 26 },
  eraDot: {
    position: 'absolute',
    left: -26,
    top: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.orange,
    borderWidth: 3,
    borderColor: COLORS.beige,
  },
  eraHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  eraName: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.navy },
  eraYears: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: PAPER_TEXT.faint,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroScroll: { marginLeft: -41 },
  heroStrip: { gap: 12, paddingLeft: 41, paddingRight: 15 },
  card: { width: 88 },
  cardImgWrap: {
    width: 88,
    height: 118,
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    marginBottom: 6,
  },
  cardName: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy, lineHeight: 16 },
  cardYear: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    marginTop: 1,
  },
});
