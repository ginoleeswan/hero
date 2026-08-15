// src/components/web/home/PulseRail.tsx — web variant of the Pulse rail.
//
// Same data, same ranking, same badge palette as the native rail; the web variant gets a
// hover lift, a wider card, and a scroll container rather than a FlatList. Kept as
// a thin view: everything judgemental (ranking, decay, copy) lives in
// src/lib/home/pulse.ts and is shared.
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text } from '../../ui/Text';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, ELEVATION, HOVER_TRANSITION, INK_TEXT } from '../../../constants/colors';
import { brandForEvent, fitMark } from '../../../constants/eventBrands';
import type { PulseEvent, PulseKind } from '../../../lib/home/pulse';

const KIND_TINT: Record<PulseKind, string> = {
  live_event: COLORS.goldAccent,
  trailer: COLORS.orange,
  // Blue for attention — the audience moving, rather than something being
  // published. Distinct from the three "someone shipped a thing" tints.
  surge: COLORS.blue,
  issue: COLORS.green,
};

const KIND_GROUND: Record<PulseKind, string> = {
  live_event: '#3a2c08',
  trailer: '#2a1016',
  surge: '#0b2f34',
  issue: '#1e3410',
};

export interface PulseRailProps {
  events: PulseEvent[];
  /** The loudest character surging right now, for the live-event card's one line
   *  of proof. Already a prop on the band as `wikiTrending`; nothing new fetched. */
  topMover?: { name: string; spikePct: number } | null;
  onTitlePress: (titleId: string) => void;
  onIssuePress: (issueId: string) => void;
  /** A live event → its permanent page. */
  /** (series slug, live edition slug or null). The edition is what the card is
   *  actually about; the slug alone lands on the archive. */
  onEventPress?: (slug: string, editionSlug: string | null) => void;
  /** A surge → the character whose face fronts it. */
  onHeroPress?: (hero: { id: string; portrait_url?: string | null }) => void;
  /** Page gutter so the rail's first card lines up with the band's other content. */
  gutter?: number;
}

export function PulseRail({
  events,
  topMover,
  onTitlePress,
  onIssuePress,
  onHeroPress,
  onEventPress,
  gutter = 16,
}: PulseRailProps) {
  if (events.length === 0) return null;

  // Live events render their own card, and now have somewhere to go: the event
  // dossier page at /event/[slug], which outlives the rail by design.
  const open = (e: PulseEvent) => {
    if (e.kind === 'issue') onIssuePress(e.entityId);
    // A surge's entityId is the hero fronting the group, not a title.
    else if (e.kind === 'surge') onHeroPress?.({ id: e.entityId, portrait_url: e.imageUrl });
    else onTitlePress(e.entityId);
  };

  return (
    <View style={s.section as object}>
      {/* No header. The band above already says "Right Now" and describes
          itself; a second "Latest / Just Happened" repeated the same claim and
          unbalanced the top of the band. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.strip, { paddingHorizontal: gutter }] as object}
      >
        {events.map((item) => {
          const tint = KIND_TINT[item.kind];

          // A convention isn't an object you look at, so it doesn't get a poster
          // card with the poster missing. Wider, lit from its accent, and built
          // out of the data instead.
          if (item.kind === 'live_event') {
            const accent = item.accent ?? COLORS.goldAccent;
            const brand = brandForEvent(item.entityId);
            return (
              <Pressable
                key={item.eventId}
                onPress={() => onEventPress?.(item.entityId, item.editionSlug ?? null)}
                style={[live.card, { borderColor: `${accent}55` }] as object}
                accessibilityRole="button"
                accessibilityLabel={`${item.headline}, live now`}
              >
                <LinearGradient
                  colors={[`${accent}4d`, `${accent}12`, 'rgba(11,24,32,0)']}
                  locations={[0, 0.42, 1]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={live.body as object}>
                  <View style={live.statusRow as object}>
                    <View style={[live.dot, { backgroundColor: accent }] as object} />
                    <Text style={[live.status, { color: accent }] as object}>
                      {item.statusLabel ?? 'Live'}
                    </Text>
                    {!!item.dayLabel && (
                      <>
                        <Text style={live.statusSep as object}>·</Text>
                        <Text style={live.day as object}>{item.dayLabel}</Text>
                      </>
                    )}
                  </View>
                  {brand ? (
                    // The mark replaces the name rather than joining it — a
                    // wordmark logo already says the name.
                    <View style={live.markBox as object}>
                      <brand.mark
                        {...fitMark(brand, LIVE_MARK_MAX_W, LIVE_MARK_MAX_H)}
                        color={accent}
                        fill={accent}
                      />
                    </View>
                  ) : (
                    <Text style={live.name as object} numberOfLines={3}>
                      {item.headline}
                    </Text>
                  )}
                  <View style={{ flex: 1 }} />
                  {topMover ? (
                    <View>
                      <Text style={live.moverLabel as object}>Moving fastest</Text>
                      <Text style={live.moverName as object} numberOfLines={1}>
                        {topMover.name}
                      </Text>
                      <Text style={[live.moverPct, { color: accent }] as object}>
                        {`+${topMover.spikePct}% this week`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={live.moverLabel as object}>Happening now</Text>
                  )}
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={item.eventId}
              style={s.card as object}
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.badge}: ${item.headline}`}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  contentFit="cover"
                  contentPosition="center"
                  style={StyleSheet.absoluteFill}
                  transition={180}
                />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: item.accent ?? KIND_GROUND[item.kind] },
                  ]}
                />
              )}
              <LinearGradient
                colors={['rgba(11,24,32,0.05)', 'rgba(11,24,32,0.55)', 'rgba(11,24,32,0.96)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.badge, { backgroundColor: tint }] as object}>
                <Text style={s.badgeText as object}>{item.badge}</Text>
              </View>
              {!!item.mediaKey && (
                <View style={s.play as object}>
                  <Text style={s.playGlyph as object}>▶</Text>
                </View>
              )}
              <View style={s.body as object}>
                <Text style={s.headline as object} numberOfLines={2}>
                  {item.headline}
                </Text>
                <View style={s.metaRow as object}>
                  {!!item.ageLabel && <Text style={s.age as object}>{item.ageLabel}</Text>}
                  {!!item.ageLabel && !!item.subtitle && <Text style={s.sep as object}>·</Text>}
                  {!!item.subtitle && (
                    <Text style={s.meta as object} numberOfLines={item.ageLabel ? 1 : 2}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const CARD_W = 208;
const CARD_H = 286;
const LIVE_CARD_W = Math.round(CARD_W * 1.62);
/** The mark sits where the headline did: body width inside the padding, and no
 *  taller than the three lines of Flame it replaces. */
const LIVE_MARK_MAX_W = LIVE_CARD_W - 36;
const LIVE_MARK_MAX_H = 104;

// The live-event card. Wider than a poster card on purpose: a different shape
// reads as "a different kind of thing", where a same-shaped card with no image
// reads as a broken one.
const live = StyleSheet.create({
  card: {
    width: LIVE_CARD_W,
    height: CARD_H,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
    borderWidth: 1,
    boxShadow: ELEVATION.rest,
  } as object,
  body: { flex: 1, padding: 18 } as object,
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 11 } as object,
  dot: { width: 8, height: 8, borderRadius: 4 } as object,
  status: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  } as object,
  statusSep: { fontSize: 11, color: INK_TEXT.faint } as object,
  day: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.78)',
  } as object,
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    // Clamped Flame needs lineHeight >= 1.22x fontSize or descenders clip.
    lineHeight: 39,
    color: COLORS.beige,
  } as object,
  moverLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
    marginBottom: 4,
  } as object,
  moverName: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    lineHeight: 25,
    color: COLORS.beige,
  } as object,
  moverPct: { fontFamily: 'Nunito_700Bold', fontSize: 12, marginTop: 2 } as object,
  // Left-aligned so the mark shares an optical edge with the status row above
  // and the mover lines below, whatever its aspect ratio.
  markBox: { alignItems: 'flex-start', justifyContent: 'center', minHeight: 52 } as object,
});

const s = StyleSheet.create({
  section: { marginBottom: 26 } as object,
  strip: { gap: 14, paddingBottom: 6 } as object,
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    // The shared hover recipe, same as every other card on the web home.
    transition: HOVER_TRANSITION,
    boxShadow: ELEVATION.rest,
  } as object,
  badge: {
    position: 'absolute',
    top: 11,
    left: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderCurve: 'continuous',
  } as object,
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: '#fff',
  } as object,
  play: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(245,235,220,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
  } as object,
  playGlyph: { color: COLORS.deepNavy, fontSize: 15, marginLeft: 2 } as object,
  body: { padding: 13 } as object,
  headline: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    // Clamped Flame needs lineHeight >= 1.22x fontSize or descenders clip under
    // -webkit-line-clamp.
    lineHeight: 23,
    color: COLORS.beige,
    marginBottom: 6,
  } as object,
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 } as object,
  age: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    color: 'rgba(245,235,220,0.82)',
  } as object,
  sep: { fontSize: 11, color: INK_TEXT.faint } as object,
  meta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.62)',
    flexShrink: 1,
  } as object,
});
