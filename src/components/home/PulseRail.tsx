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
import { View, Text, FlatList, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import type { PulseEvent, PulseKind } from '../../lib/home/pulse';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = Math.min(168, Math.round(SCREEN_WIDTH * 0.44));
const CARD_H = Math.round(CARD_W * 1.42);

/** Badge tint per kind. Orange is reserved for *now* (a drop), gold for a live
 *  event, green for print — so the reader learns the palette in one scroll. */
const KIND_TINT: Record<PulseKind, string> = {
  live_event: COLORS.goldAccent,
  trailer: COLORS.orange,
  issue: COLORS.green,
};

/** Fallback grounds when an event has no art of its own (live events don't). */
const KIND_GROUND: Record<PulseKind, string> = {
  live_event: '#3a2c08',
  trailer: '#2a1016',
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
  disabled?: boolean;
}

export function PulseRail({
  events,
  topMover,
  onTitlePress,
  onIssuePress,
  disabled = false,
}: PulseRailProps) {
  if (events.length === 0) return null;

  // Live events render their own card and are never routed here — they have no
  // destination of their own until the takeover hero exists.
  const open = (e: PulseEvent) => {
    if (e.kind === 'issue') onIssuePress(e.entityId);
    else onTitlePress(e.entityId);
  };

  return (
    <View style={s.section}>
      <View style={s.header}>
        <View style={[s.accentBar, { backgroundColor: COLORS.orange }]} />
        <View>
          <Text style={[s.label, { color: COLORS.orange }]}>Latest</Text>
          <Text style={s.title}>Just Happened</Text>
        </View>
      </View>
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
            return (
              <View
                style={[live.card, { borderColor: `${accent}55` }]}
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
                    <Text style={[live.status, { color: accent }]}>Live</Text>
                    {!!item.dayLabel && (
                      <>
                        <Text style={live.statusSep}>·</Text>
                        <Text style={live.day}>{item.dayLabel}</Text>
                      </>
                    )}
                  </View>
                  <Text style={live.name} numberOfLines={3}>
                    {item.headline}
                  </Text>
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
              </View>
            );
          }

          return (
            <Pressable
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
                    <Text style={s.meta} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

// The live-event card. Wider than a poster card on purpose: a different shape
// reads as "a different kind of thing", where a same-shaped card with no image
// reads as a broken one.
const live = StyleSheet.create({
  card: {
    width: Math.round(CARD_W * 1.62),
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
  statusSep: { fontSize: 10, color: 'rgba(245,235,220,0.35)' },
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
    color: 'rgba(245,235,220,0.45)',
    marginBottom: 3,
  },
  moverName: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    lineHeight: 20,
    color: COLORS.beige,
  },
  moverPct: { fontFamily: 'Nunito_700Bold', fontSize: 11, marginTop: 1 },
});

const s = StyleSheet.create({
  section: { marginBottom: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 11,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  accentBar: { width: 4, borderRadius: 2 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  // Flame needs lineHeight >= 1.22x fontSize; this is unclamped but kept in step
  // with the band's other shelf titles.
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },
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
  sep: { fontSize: 10, color: 'rgba(245,235,220,0.4)' },
  meta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: 'rgba(245,235,220,0.62)',
    flexShrink: 1,
  },
});
