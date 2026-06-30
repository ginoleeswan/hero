import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeroImage } from '../../HeroImage';
import { COLORS } from '../../../constants/colors';
import type { Hero } from '../../../lib/db/heroes';

// Rank tint — first 3 entries get progressively warmer orange, rest stay dim
function rankColor(i: number): string {
  if (i === 0) return `rgba(231,115,51,0.70)`;
  if (i === 1) return `rgba(231,115,51,0.45)`;
  if (i === 2) return `rgba(231,115,51,0.30)`;
  return 'rgba(41,60,67,0.22)';
}

export function HallOfFame({ heroes, onPress }: { heroes: Hero[]; onPress: (id: string) => void }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const pad = width < 640 ? 16 : 32;

  if (heroes.length === 0) return null;
  const lead = heroes[0];
  // Desktop: 10 ranked entries in a 2-col spread beside the lead. Mobile: 6 stacked.
  const rest = heroes.slice(1, isDesktop ? 11 : 6);

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
        {/* Featured #1 — dominates the left column */}
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
            contentPosition={{ top: '10%', left: '50%' }}
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

        {/* Ranked list — two-column power-ranking spread that fills the width */}
        <View style={[s.list, isDesktop && (s.listGrid as object)] as object}>
          {rest.map((h, i) => (
            <Pressable
              key={h.id}
              onPress={() => onPress(String(h.id))}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [s.row, hovered && (s.rowHover as object)] as object
              }
            >
              {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
                <>
                  <Text style={[s.rank, { color: rankColor(i) }] as object}>
                    {String(i + 2).padStart(2, '0')}
                  </Text>
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
                  {/* Right-anchored: publisher at rest, swaps to an arrow on hover —
                      so the row stays justified edge-to-edge either way. */}
                  {hovered ? (
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={COLORS.orange}
                      style={s.trailIcon as object}
                    />
                  ) : (
                    !!h.publisher && (
                      <Text style={s.rowMeta as object} numberOfLines={1}>
                        {h.publisher}
                      </Text>
                    )
                  )}
                </>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const LEAD_W = 300;
// Card height = 5 row-cells, so the list bottom-aligns with the card exactly
// and each cell stays tight around the portrait (no floaty vertical air).
const LEAD_H = 360;
const THUMB = 56;

const s = StyleSheet.create({
  // browseHead ("Browse the Universe") below carries marginTop: -36, so this
  // marginBottom must be 52 + 36 = 88 to leave the same ~52px gap above THE
  // LIBRARY that the HomeRow above leaves above THE CANON. Keeps the chapter
  // breaks evenly spaced.
  section: { marginBottom: 88 },
  head: { marginBottom: 20 },
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
    fontSize: 44,
    color: COLORS.navy,
    lineHeight: 46,
  } as object,
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.55)',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 520,
  } as object,

  // minHeight pins the row to the lead card's height so the section always
  // reserves its full space — the grid list's `display: grid` height isn't
  // reliably fed back into the flex row otherwise, causing the next section
  // to overlap.
  body: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, minHeight: LEAD_H },
  bodyStack: { flexDirection: 'column', gap: 20, minHeight: 0 } as object,

  // Featured #1 — portrait-oriented card, fixed width so list gets more room
  lead: {
    width: LEAD_W,
    height: LEAD_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 200ms ease, box-shadow 200ms ease',
    boxShadow: '0 8px 32px rgba(41,60,67,0.15)',
  } as object,
  leadHover: {
    transform: [{ translateY: -4 }],
    boxShadow: '0 24px 60px rgba(41,60,67,0.25)',
  } as object,
  leadScrim: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(11,24,32,0.97) 0%, rgba(11,24,32,0.5) 45%, transparent 80%)',
  } as object,
  leadBody: { padding: 28 },
  // "01" as a monument — large, orange, unmistakable
  leadRank: {
    fontFamily: 'Flame-Regular',
    fontSize: 64,
    color: COLORS.orange,
    lineHeight: 60,
    marginBottom: 4,
  } as object,
  leadName: {
    fontFamily: 'Flame-Regular',
    fontSize: 40,
    color: COLORS.beige,
    lineHeight: 42,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  } as object,
  leadStat: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.55)',
    marginTop: 8,
  } as object,
  leadBlurb: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.72)',
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 400,
  } as object,

  // Ranked list — two columns on desktop fill the width beside the lead card
  list: { flex: 1, gap: 2 },
  listGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gridTemplateRows: 'repeat(5, 1fr)',
    gridAutoFlow: 'column',
    columnGap: 28,
    height: LEAD_H,
  } as object,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  rowHover: {
    backgroundColor: 'rgba(41,60,67,0.06)',
  } as object,
  trailIcon: { marginLeft: 'auto' } as object,

  // Big decorative rank — acts as a graphic element, not just metadata
  rank: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    width: 44,
    textAlign: 'right',
    lineHeight: 24,
    flexShrink: 0,
  } as object,

  // Circular portrait — reads as a character, not an app icon
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    borderWidth: 2,
    borderColor: 'rgba(41,60,67,0.1)',
  },
  rowName: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Flame-Regular',
    fontSize: 19,
    color: COLORS.navy,
    lineHeight: 21,
  } as object,
  rowMeta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.42)',
    marginLeft: 'auto',
    paddingLeft: 10,
    flexShrink: 0,
  } as object,
});
