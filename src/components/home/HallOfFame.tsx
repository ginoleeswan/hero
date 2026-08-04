// Native "Hall of Fame" — the authored treatment of Most Iconic: a chosen #1 shown
// large, then a compact ranked list, instead of a flat rail. Mirrors the web
// HallOfFame. Sits on the beige content sheet.
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { HeroAvatar } from '../HeroAvatar';
import { PressScale } from '../ui/PressScale';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';

// Rank tint — top 3 get progressively warmer orange (podium), rest stay dim.
function rankColor(i: number): string {
  if (i === 0) return 'rgba(231,115,51,0.70)';
  if (i === 1) return 'rgba(231,115,51,0.45)';
  if (i === 2) return 'rgba(231,115,51,0.30)';
  return 'rgba(41,60,67,0.22)';
}

export function HallOfFame({ heroes, onPress }: { heroes: Hero[]; onPress: (id: string) => void }) {
  if (heroes.length === 0) return null;
  const lead = heroes[0];
  const rest = heroes.slice(1, 7);

  return (
    <View style={s.section}>
      <View style={s.head}>
        <Text style={s.kicker}>The Canon</Text>
        <Text style={s.title}>Hall of Fame</Text>
        <Text style={s.sub}>The characters the whole world knows.</Text>
      </View>

      <PressScale style={s.lead} scale={0.97} onPress={() => onPress(String(lead.id))}>
        <HeroImage
          id={String(lead.id)}
          name={lead.name}
          imageUrl={lead.image_url}
          portraitUrl={lead.portrait_url}
          contentFit="cover"
          contentPosition={{ top: '16%', left: '50%' }}
          style={StyleSheet.absoluteFill as object}
          recyclingKey={String(lead.id)}
        />
        <LinearGradient
          colors={['transparent', 'rgba(11,24,32,0.55)', 'rgba(11,24,32,0.96)']}
          locations={[0.3, 0.66, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.leadBody}>
          <Text style={s.leadRank}>01</Text>
          <Text style={s.leadName} numberOfLines={2}>
            {lead.name}
          </Text>
          {!!lead.publisher && <Text style={s.leadStat}>{lead.publisher}</Text>}
        </View>
      </PressScale>

      <View style={s.list}>
        {rest.map((h, i) => (
          <PressScale key={h.id} style={s.row} onPress={() => onPress(String(h.id))}>
            <Text style={[s.rank, { color: rankColor(i) }]}>{String(i + 2).padStart(2, '0')}</Text>
            <View style={[s.thumb, h.avatar_url && s.faceBare] as object}>
              {/* The pool is the top 25 by fame, which is the tier with full
                  avatar coverage — so these rows are heads, not crops. */}
              {h.avatar_url ? (
                <HeroAvatar
                  id={String(h.id)}
                  name={h.name}
                  avatarUrl={h.avatar_url}
                  size={50}
                  bare
                />
              ) : (
                <HeroImage
                  id={String(h.id)}
                  name={h.name}
                  imageUrl={h.image_url}
                  portraitUrl={h.portrait_url}
                  grid
                  contentFit="cover"
                  contentPosition={{ top: 0, left: '50%' }}
                  style={StyleSheet.absoluteFill as object}
                  recyclingKey={String(h.id)}
                />
              )}
            </View>
            <Text style={s.rowName} numberOfLines={1}>
              {h.name}
            </Text>
            {!!h.publisher && (
              <Text style={s.rowMeta} numberOfLines={1}>
                {h.publisher}
              </Text>
            )}
          </PressScale>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  head: { marginBottom: 16 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 3,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 30, color: COLORS.navy, lineHeight: 32 },
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(41,60,67,0.6)',
    lineHeight: 18,
    marginTop: 4,
  },
  lead: {
    height: 320,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  leadBody: { padding: 20 },
  // "01" as a monument — matches the web treatment
  leadRank: {
    fontFamily: 'Flame-Regular',
    fontSize: 52,
    color: COLORS.orange,
    lineHeight: 50,
    marginBottom: 2,
  },
  leadName: { fontFamily: 'Flame-Regular', fontSize: 32, color: COLORS.beige, lineHeight: 40 },
  leadStat: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.6)',
    marginTop: 6,
  },
  list: { marginTop: 8 },
  // No dividers — whitespace separates the rows (matches web)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  rank: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    width: 30,
    textAlign: 'right',
  },
  // Circular portrait — reads as a character, not an app icon (matches web)
  // A cut-out head needs neither fill nor ring, and HeroAvatar renders a sized
  // image rather than an absolute fill — so the slot has to centre it itself.
  faceBare: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as object,
  thumb: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 2,
    borderColor: 'rgba(41,60,67,0.1)',
  },
  rowName: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    color: COLORS.navy,
    lineHeight: 21,
  },
  rowMeta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.4)',
  },
});
