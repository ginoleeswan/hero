import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import type { TodaysMatchup as Matchup } from '../../../lib/matchup';

interface TodaysMatchupProps {
  matchup: Matchup;
  onOpen: (path: string) => void;
}

function Fighter({
  hero,
  side,
  size = PORTRAIT,
}: {
  hero: Matchup['heroA'];
  side: 'a' | 'b';
  size?: number;
}) {
  return (
    <View
      style={[m.portrait, { width: size, height: size }, side === 'b' && (m.portraitB as object)] as object}
    >
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
  );
}

export function TodaysMatchup({ matchup, onOpen }: TodaysMatchupProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { heroA, heroB, winsA, winsB } = matchup;
  const lead = winsA === winsB ? 'Evenly matched' : `${winsA > winsB ? heroA.name : heroB.name} leads`;

  // ── Mobile: a centred "fight poster" — face-off portraits on top, then the
  // verdict. Same content + tokens as the desktop card, reflowed vertically. ──
  if (!isDesktop) {
    return (
      <Pressable
        onPress={() => onOpen(`/compare/${heroA.id}/${heroB.id}`)}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [m.card, m.cardMobile, hovered && (m.cardHover as object)] as object
        }
      >
        <Text style={[m.eyebrow, m.textCenter] as object}>⚔ Today's Battle</Text>
        <View style={m.fightersMobile}>
          <Fighter hero={heroA} side="a" size={92} />
          <View style={m.vsBadge as object}>
            <Text style={m.vsText}>VS</Text>
          </View>
          <Fighter hero={heroB} side="b" size={92} />
        </View>
        <Text style={[m.title, m.textCenter] as object} numberOfLines={1}>
          {heroA.name} vs {heroB.name}
        </Text>
        <Text style={[m.verdict, m.textCenter] as object} numberOfLines={3}>
          “{matchup.verdict}”
        </Text>
        <View style={m.footerMobile}>
          <Text style={m.lead}>{lead}</Text>
          <Text style={m.link}>See full breakdown →</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onOpen(`/compare/${heroA.id}/${heroB.id}`)}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [m.card, m.cardDesktop, hovered && (m.cardHover as object)] as object
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
  cardDesktop: { marginHorizontal: 32 } as object,
  cardMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 22,
    marginHorizontal: 16,
  } as object,
  cardHover: { backgroundColor: 'rgba(255,255,255,0.08)' } as object,

  fighters: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  fightersMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  } as object,
  textCenter: { textAlign: 'center', marginBottom: 0 } as object,
  footerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 4,
  } as object,
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
