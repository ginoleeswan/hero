import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { heroImageSource } from '../../../constants/heroImages';
import type { TodaysMatchup as Matchup } from '../../../lib/matchup';

interface TodaysMatchupProps {
  matchup: Matchup;
  onOpen: (path: string) => void;
}

function Fighter({ hero, side }: { hero: Matchup['heroA']; side: 'a' | 'b' }) {
  const source = heroImageSource(hero.id, hero.image_url, hero.portrait_url);
  return (
    <View style={[m.portrait, side === 'b' && (m.portraitB as object)] as object}>
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
  );
}

export function TodaysMatchup({ matchup, onOpen }: TodaysMatchupProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { heroA, heroB, winsA, winsB } = matchup;
  const lead = winsA === winsB ? 'Evenly matched' : `${winsA > winsB ? heroA.name : heroB.name} leads`;

  return (
    <Pressable
      onPress={() => onOpen(`/compare/${heroA.id}/${heroB.id}`)}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [m.card, !isDesktop && (m.cardStack as object), hovered && (m.cardHover as object)] as object
      }
    >
      <View style={m.fighters}>
        <Fighter hero={heroA} side="a" />
        <View style={m.vsBadge as object}>
          <Text style={m.vsText}>VS</Text>
        </View>
        <Fighter hero={heroB} side="b" />
      </View>

      <View style={m.info}>
        <Text style={m.eyebrow as object}>⚔ Today's Battle</Text>
        <Text style={m.title} numberOfLines={1}>
          {heroA.name} vs {heroB.name}
        </Text>
        <Text style={m.verdict} numberOfLines={2}>
          “{matchup.verdict}”
        </Text>
        <View style={m.footer}>
          <Text style={m.lead}>{lead}</Text>
          <Text style={m.link}>See full breakdown →</Text>
        </View>
      </View>
    </Pressable>
  );
}

const PORTRAIT = 76;

const m = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
    cursor: 'pointer',
    transition: 'background-color 150ms ease, transform 150ms ease',
  } as object,
  cardStack: { flexDirection: 'column', alignItems: 'flex-start', gap: 16 } as object,
  cardHover: { backgroundColor: 'rgba(255,255,255,0.08)' } as object,

  fighters: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  portrait: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 2,
    borderColor: 'rgba(11,24,32,0.9)',
  } as object,
  portraitB: { marginLeft: -16 } as object,
  vsBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginHorizontal: -12,
    zIndex: 2,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0b1820',
  } as object,
  vsText: {
    fontFamily: 'Flame-Regular',
    fontSize: 12,
    color: '#fff',
  },

  info: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 5,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.beige,
    lineHeight: 25,
    marginBottom: 6,
  },
  verdict: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(245,235,220,0.7)',
    lineHeight: 19,
    marginBottom: 10,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  lead: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.45)',
  } as object,
  link: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 0.3,
  },
});
