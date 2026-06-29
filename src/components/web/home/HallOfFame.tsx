// "Hall of Fame" — the authored treatment of Most Iconic. Instead of a flat rail
// of equal cards, it leads with a chosen #1 shown large and framed, beside a
// compact ranked list. Same data (heroes by appearance count), but it reads as a
// curated editorial moment with a point of view, not an inventory.
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { HeroImage } from '../../HeroImage';
import { COLORS } from '../../../constants/colors';
import type { Hero } from '../../../lib/db/heroes';

export function HallOfFame({ heroes, onPress }: { heroes: Hero[]; onPress: (id: string) => void }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const pad = width < 640 ? 16 : 32;

  if (heroes.length === 0) return null;
  const lead = heroes[0];
  const rest = heroes.slice(1, isDesktop ? 8 : 6);

  return (
    <View style={[s.section, { paddingHorizontal: pad }] as object}>
      <View style={s.head}>
        <Text style={s.kicker as object}>The Canon</Text>
        <Text style={s.title as object}>Hall of Fame</Text>
        <Text style={s.sub as object}>
          The characters the whole world knows — the most recognizable names across every universe.
        </Text>
      </View>

      <View style={[s.body, !isDesktop && (s.bodyStack as object)] as object}>
        {/* Featured #1 — the chosen lead, shown large. */}
        <Pressable
          onPress={() => onPress(String(lead.id))}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [s.lead, hovered && (s.leadHover as object)] as object
          }
        >
          <HeroImage
            id={String(lead.id)}
            name={lead.name}
            imageUrl={lead.image_url}
            portraitUrl={lead.portrait_url}
            contentFit="cover"
            contentPosition={{ top: '20%', left: '50%' }}
            style={StyleSheet.absoluteFill as object}
            recyclingKey={String(lead.id)}
          />
          <View style={s.leadScrim as object} />
          <View style={s.leadBody}>
            <Text style={s.leadRank as object}>01</Text>
            <Text style={s.leadName as object} numberOfLines={2}>
              {lead.name}
            </Text>
            {!!lead.publisher && <Text style={s.leadStat as object}>{lead.publisher}</Text>}
            {!!lead.summary && (
              <Text style={s.leadBlurb as object} numberOfLines={2}>
                {lead.summary}
              </Text>
            )}
          </View>
        </Pressable>

        {/* The rest of the canon — a tight ranked list, not a scroll. */}
        <View style={s.list}>
          {rest.map((h, i) => (
            <Pressable
              key={h.id}
              onPress={() => onPress(String(h.id))}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [s.row, hovered && (s.rowHover as object)] as object
              }
            >
              <Text style={s.rank as object}>{String(i + 2).padStart(2, '0')}</Text>
              <View style={s.thumb}>
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
              </View>
              <Text style={s.rowName as object} numberOfLines={1}>
                {h.name}
              </Text>
              {!!h.publisher && (
                <Text style={s.rowMeta as object} numberOfLines={1}>
                  {h.publisher}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const LEAD_H = 360;

const s = StyleSheet.create({
  section: { marginBottom: 52 },
  head: { marginBottom: 22 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 4,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 40,
    color: COLORS.navy,
    lineHeight: 42,
  } as object,
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.6)',
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 560,
  } as object,

  body: { flexDirection: 'row', alignItems: 'stretch', gap: 24 },
  bodyStack: { flexDirection: 'column' } as object,

  // Featured #1
  lead: {
    flex: 1.05,
    minWidth: 0,
    height: LEAD_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  leadHover: {
    transform: [{ translateY: -4 }],
    boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
  } as object,
  leadScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(11,24,32,0.96) 0%, rgba(11,24,32,0.55) 42%, transparent 78%)',
  } as object,
  leadBody: { padding: 24 },
  leadRank: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 2,
    marginBottom: 2,
  } as object,
  leadName: {
    fontFamily: 'Flame-Regular',
    fontSize: 38,
    color: COLORS.beige,
    lineHeight: 40,
    textShadow: '0 2px 12px rgba(0,0,0,0.8)',
  } as object,
  leadStat: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.6)',
    marginTop: 6,
  } as object,
  leadBlurb: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.78)',
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 420,
  } as object,

  // Ranked list
  list: { flex: 1, justifyContent: 'space-between' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.08)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  rowHover: { backgroundColor: 'rgba(41,60,67,0.06)' } as object,
  rank: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: 'rgba(41,60,67,0.35)',
    width: 26,
  } as object,
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  rowName: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.navy,
    lineHeight: 20,
  } as object,
  rowMeta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.4)',
  } as object,
});
