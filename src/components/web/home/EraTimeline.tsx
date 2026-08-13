import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../../ui/Text';
import { COLORS, PAPER_TEXT, ORANGE_INK } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
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
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [t.card, hovered && (t.cardHover as object)] as object
      }
    >
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
    </Pressable>
  );
}

export function EraTimeline({ eras, onPress }: EraTimelineProps) {
  const { width } = useWindowDimensions();
  const pagePad = width < 640 ? 16 : 32;

  if (eras.length === 0) return null;

  const isMobile = width < 640;

  return (
    <View style={t.section}>
      <View style={[t.header, { paddingLeft: pagePad }] as object}>
        <View style={t.accentBar} />
        <View style={t.headerText}>
          <Text style={t.label}>Comics History</Text>
          <Text style={t.title}>Through the Ages</Text>
        </View>
      </View>

      {/* Desktop: a soft inset frame (deliberate "chapter"). Mobile: no frame so
          the hero carousels run edge-to-edge. The spine stays at both widths. */}
      <View
        style={
          isMobile
            ? [t.bodyMobile, { paddingLeft: pagePad }]
            : [t.frame, { marginHorizontal: pagePad }]
        }
      >
        <View style={t.timeline}>
          <View style={t.spine as object} pointerEvents="none" />
          {eras.map((bucket) => (
            <View key={bucket.era} style={t.eraBlock}>
              <View style={t.eraDot as object} />
              <View style={t.eraHead}>
                <Text style={t.eraName}>{bucket.era}</Text>
                <Text style={t.eraYears}>{ERA_YEARS[bucket.era] ?? ''}</Text>
              </View>
              {/* On mobile the strip bleeds left into the spine and off the right
                  edge; on desktop it's contained within the frame. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[t.heroScroll, isMobile && { marginLeft: -16 }] as object}
                contentContainerStyle={
                  [t.heroStrip, isMobile ? { paddingLeft: 16 } : { paddingRight: 4 }] as object
                }
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
    color: ORANGE_INK,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 36, color: COLORS.navy, lineHeight: 38 },

  // Desktop: soft inset that frames the timeline as one deliberate "chapter".
  frame: {
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 18,
    paddingTop: 24,
    paddingBottom: 4,
    paddingLeft: 22,
    paddingRight: 18,
  },
  // Mobile: no frame — carousels bleed off the right edge like other rows.
  bodyMobile: { paddingTop: 4 },

  // Horizontal hero strips. The marginTop/paddingTop pair carves headroom inside
  // the scroller's clipped overflow so the card hover-lift isn't cut off at top.
  heroScroll: { marginTop: -10 } as object,
  heroStrip: { gap: 14, paddingTop: 10 } as object,

  timeline: { position: 'relative', paddingLeft: 26 },
  spine: {
    position: 'absolute',
    left: 5,
    top: 8,
    bottom: 30,
    width: 2,
    backgroundColor: 'rgba(231,115,51,0.25)',
    zIndex: 2,
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
    zIndex: 3,
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
    color: PAPER_TEXT.faint,
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
    lineHeight: 16,
  },
  cardYear: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    marginTop: 1,
  },
});
