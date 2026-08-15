// src/components/home/PulseRail.tsx — the Pulse: one rail of timestamped events,
// newest-and-loudest first, sitting at the top of the Right Now band.
//
// Sibling of ComicCoverRail and TitlePosterRail, but where those rails each show
// one *category*, this one shows mixed *events* — a trailer that dropped this
// morning next to a convention that's running next to a comic that hit shelves.
// The colour-coded badge carries the kind so the rail reads at a glance, and the
// relative timestamp is what makes it feel current rather than merely accurate.
//
// Ranking, decay and every string live in src/lib/home/pulse.ts. This is a view.
import { View, FlatList, StyleSheet, Dimensions } from 'react-native';
import { Text } from '../ui/Text';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PressScale } from '../ui/PressScale';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { brandForEvent, fitMark } from '../../constants/eventBrands';
import type { PulseEvent, PulseKind } from '../../lib/home/pulse';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = Math.min(168, Math.round(SCREEN_WIDTH * 0.44));
const CARD_H = Math.round(CARD_W * 1.42);

/** Badge tint per kind. Orange is reserved for *now* (a drop), gold for a live
 *  event, green for print — so the reader learns the palette in one scroll. */
const KIND_TINT: Record<PulseKind, string> = {
  live_event: COLORS.goldAccent,
  trailer: COLORS.orange,
  // Blue for attention — the audience moving, rather than something being
  // published. Distinct from the three "someone shipped a thing" tints.
  surge: COLORS.blue,
  issue: COLORS.green,
};

/** Fallback grounds when an event has no art of its own (live events don't). */
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
  /** A trailer or title card → the title page. */
  onTitlePress: (titleId: string) => void;
  /** A comic → the issue page. */
  onIssuePress: (issueId: string) => void;
  /** A live event → its permanent page. */
  onEventPress?: (slug: string) => void;
  /** A surge → the character whose face fronts it. */
  onHeroPress?: (hero: { id: string; portrait_url?: string | null }) => void;
  disabled?: boolean;
}

export function PulseRail({
  events,
  topMover,
  onTitlePress,
  onIssuePress,
  onHeroPress,
  onEventPress,
  disabled = false,
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
    <View style={s.section}>
      {/* No header. The band above already says "Right Now" and describes
          itself; a second "Latest / Just Happened" repeated the same claim and
          pushed the cards below the fold on a phone. */}
      <FlatList
        horizontal
        data={events}
        keyExtractor={(e) => e.eventId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
        removeClippedSubviews
        initialNumToRender={4}
        renderItem={({ item }) => {
          const tint = KIND_TINT[item.kind];

          // A convention isn't an object you look at, so it doesn't get a poster
          // card with the poster missing. Wider, lit from the accent, and built
          // out of the data instead: a day counter that advances, the name given
          // room, and the loudest character it's moving.
          if (item.kind === 'live_event') {
            const accent = item.accent ?? COLORS.goldAccent;
            const brand = brandForEvent(item.entityId);
            return (
              <PressScale
                onPress={() => onEventPress?.(item.entityId)}
                style={[live.card, { borderColor: `${accent}55` }]}
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
                <View style={live.body}>
                  <View style={live.statusRow}>
                    <View style={[live.dot, { backgroundColor: accent }]} />
                    <Text style={[live.status, { color: accent }]}>
                      {item.statusLabel ?? 'Live'}
                    </Text>
                    {!!item.dayLabel && (
                      <>
                        <Text style={live.statusSep}>·</Text>
                        <Text style={live.day}>{item.dayLabel}</Text>
                      </>
                    )}
                  </View>
                  {brand ? (
                    // The mark replaces the name rather than joining it — a
                    // wordmark logo already says the name, and showing both
                    // reads as a mistake.
                    <View style={live.markBox}>
                      <brand.mark
                        {...fitMark(brand, LIVE_MARK_MAX_W, LIVE_MARK_MAX_H)}
                        color={accent}
                        fill={accent}
                      />
                    </View>
                  ) : (
                    <Text style={live.name} numberOfLines={3}>
                      {item.headline}
                    </Text>
                  )}
                  <View style={{ flex: 1 }} />
                  {topMover ? (
                    <View>
                      <Text style={live.moverLabel}>Moving fastest</Text>
                      <Text style={live.moverName} numberOfLines={1}>
                        {topMover.name}
                      </Text>
                      <Text style={[live.moverPct, { color: accent }]}>
                        {`+${topMover.spikePct}% this week`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={live.moverLabel}>Happening now</Text>
                  )}
                </View>
              </PressScale>
            );
          }

          return (
            <PressScale
              style={s.card}
              onPress={() => open(item)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${item.badge}: ${item.headline}`}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  contentFit="cover"
                  contentPosition="center"
                  style={StyleSheet.absoluteFill}
                  recyclingKey={item.eventId}
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
              <View style={[s.badge, { backgroundColor: tint }]}>
                <Text style={s.badgeText}>{item.badge}</Text>
              </View>
              {!!item.mediaKey && (
                <View style={s.play}>
                  <Text style={s.playGlyph}>▶</Text>
                </View>
              )}
              <View style={s.body}>
                <Text style={s.headline} numberOfLines={2}>
                  {item.headline}
                </Text>
                <View style={s.metaRow}>
                  {/* A live event says "on now" through its badge; repeating an age
                      here would just be noise. */}
                  {!!item.ageLabel && <Text style={s.age}>{item.ageLabel}</Text>}
                  {!!item.ageLabel && !!item.subtitle && <Text style={s.sep}>·</Text>}
                  {!!item.subtitle && (
                    <Text style={s.meta} numberOfLines={item.ageLabel ? 1 : 2}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>
              </View>
            </PressScale>
          );
        }}
      />
    </View>
  );
}

// The live-event card. Wider than a poster card on purpose: a different shape
// reads as "a different kind of thing", where a same-shaped card with no image
// reads as a broken one.
const LIVE_CARD_W = Math.round(CARD_W * 1.62);
/** The mark sits where the headline did: full body width inside the padding,
 *  and no taller than the three lines of Flame it replaces. */
const LIVE_MARK_MAX_W = LIVE_CARD_W - 26;
const LIVE_MARK_MAX_H = 92;

const live = StyleSheet.create({
  card: {
    width: LIVE_CARD_W,
    height: CARD_H,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
    borderWidth: 1,
  },
  body: { flex: 1, padding: 13 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  status: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  statusSep: { fontSize: 10, color: INK_TEXT.faint },
  day: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.78)',
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 25,
    // Clamped Flame needs lineHeight >= 1.22x fontSize or descenders clip.
    lineHeight: 31,
    color: COLORS.beige,
  },
  moverLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
    marginBottom: 3,
  },
  moverName: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    lineHeight: 20,
    color: COLORS.beige,
  },
  moverPct: { fontFamily: 'Nunito_700Bold', fontSize: 11, marginTop: 1 },
  // Left-aligned so the mark sits on the same optical edge as the status row
  // above and the mover lines below, whatever its aspect ratio.
  markBox: { alignItems: 'flex-start', justifyContent: 'center', minHeight: 44 },
});

const s = StyleSheet.create({
  section: { marginBottom: 20 },
  strip: { gap: 10, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  badge: {
    position: 'absolute',
    top: 9,
    left: 9,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#fff',
  },
  play: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(245,235,220,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { color: COLORS.deepNavy, fontSize: 13, marginLeft: 2 },
  body: { padding: 10 },
  headline: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    // Clamped Flame text needs lineHeight >= 1.22x fontSize or descenders clip.
    lineHeight: 19,
    color: COLORS.beige,
    marginBottom: 5,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  age: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    color: 'rgba(245,235,220,0.82)',
  },
  sep: { fontSize: 10, color: INK_TEXT.faint },
  meta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: 'rgba(245,235,220,0.62)',
    flexShrink: 1,
  },
});
