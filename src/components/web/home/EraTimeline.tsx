import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { heroImageSource } from '../../../constants/heroImages';
import type { EraBucket, EraHero } from '../../../lib/db/heroes';

interface EraTimelineProps {
  eras: EraBucket[];
  onPress: (id: string) => void;
}

const ERA_YEARS: Record<string, string> = {
  'Golden Age': '1938 – 1955',
  'Silver Age': '1956 – 1969',
  'Bronze Age': '1970 – 1984',
  'Modern Age': '1985 – Today',
};

function EraCard({ hero, onPress }: { hero: EraHero; onPress: () => void }) {
  const source = heroImageSource(hero.id, hero.image_url, hero.portrait_url);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [t.card, hovered && (t.cardHover as object)] as object
      }
    >
      <View style={t.cardImgWrap}>
        <Image
          source={source}
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill}
          cachePolicy="memory-disk"
          recyclingKey={hero.id}
          transition={200}
        />
      </View>
      <Text style={t.cardName} numberOfLines={1}>
        {hero.name}
      </Text>
      <Text style={t.cardYear}>{hero.year}</Text>
    </Pressable>
  );
}

export function EraTimeline({ eras, onPress }: EraTimelineProps) {
  const { width } = useWindowDimensions();
  const pagePad = width < 640 ? 16 : 32;

  if (eras.length === 0) return null;

  return (
    <View style={[t.section, { paddingHorizontal: pagePad }] as object}>
      <View style={t.header}>
        <View style={t.accentBar} />
        <View style={t.headerText}>
          <Text style={t.label}>Comics History</Text>
          <Text style={t.title}>Through the Ages</Text>
        </View>
      </View>

      <View style={t.frame}>
        <View style={t.timeline}>
          <View style={t.spine as object} pointerEvents="none" />
          {eras.map((bucket) => (
          <View key={bucket.era} style={t.eraBlock}>
            <View style={t.eraDot as object} />
            <View style={t.eraHead}>
              <Text style={t.eraName}>{bucket.era}</Text>
              <Text style={t.eraYears}>{ERA_YEARS[bucket.era] ?? ''}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 14 }}
            >
              {bucket.heroes.map((h) => (
                <EraCard key={h.id} hero={h} onPress={() => onPress(h.id)} />
              ))}
            </ScrollView>
          </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const t = StyleSheet.create({
  section: { marginBottom: 52 },
  header: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
    marginBottom: 24,
  },
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

  // Soft inset that frames the timeline as one deliberate "chapter" rather than
  // a stack of loose rows — makes its distinct (vertical) grammar feel intended.
  frame: {
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 18,
    paddingTop: 24,
    paddingBottom: 4,
    paddingLeft: 22,
    paddingRight: 18,
  },

  timeline: { position: 'relative', paddingLeft: 26 },
  spine: {
    position: 'absolute',
    left: 5,
    top: 8,
    bottom: 30,
    width: 2,
    backgroundColor: 'rgba(231,115,51,0.25)',
  } as object,
  eraBlock: { position: 'relative', marginBottom: 30 },
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
  } as object,
  eraHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 14 },
  eraName: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
  },
  eraYears: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(41,60,67,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  card: {
    width: 96,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'transform 200ms ease',
  } as object,
  cardHover: { transform: [{ translateY: -6 }] } as object,
  cardImgWrap: {
    width: 96,
    height: 128,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    marginBottom: 7,
  },
  cardName: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    color: COLORS.navy,
    lineHeight: 15,
  },
  cardYear: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(41,60,67,0.5)',
    marginTop: 1,
  },
});
