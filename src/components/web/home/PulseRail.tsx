// src/components/web/home/PulseRail.tsx — web variant of the Pulse rail.
//
// Same data, same ranking, same badge palette as the native rail; the web variant gets a
// hover lift, a wider card, and a scroll container rather than a FlatList. Kept as
// a thin view: everything judgemental (ranking, decay, copy) lives in
// src/lib/home/pulse.ts and is shared.
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, ELEVATION, HOVER_TRANSITION } from '../../../constants/colors';
import type { PulseEvent, PulseKind } from '../../../lib/home/pulse';

const KIND_TINT: Record<PulseKind, string> = {
  live_event: COLORS.goldAccent,
  trailer: COLORS.orange,
  issue: COLORS.green,
};

const KIND_GROUND: Record<PulseKind, string> = {
  live_event: '#3a2c08',
  trailer: '#2a1016',
  issue: '#1e3410',
};

export interface PulseRailProps {
  events: PulseEvent[];
  onTitlePress: (titleId: string) => void;
  onIssuePress: (issueId: string) => void;
  /** Page gutter so the rail's first card lines up with the band's other content. */
  gutter?: number;
}

export function PulseRail({ events, onTitlePress, onIssuePress, gutter = 16 }: PulseRailProps) {
  if (events.length === 0) return null;

  const open = (e: PulseEvent) => {
    if (e.kind === 'issue') onIssuePress(e.entityId);
    else if (e.kind === 'trailer') onTitlePress(e.entityId);
  };

  return (
    <View style={s.section as object}>
      <View style={[s.header, { paddingHorizontal: gutter }] as object}>
        <View style={[s.accentBar, { backgroundColor: COLORS.orange }] as object} />
        <View>
          <Text style={[s.label, { color: COLORS.orange }] as object}>Latest</Text>
          <Text style={s.title as object}>Just Happened</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.strip, { paddingHorizontal: gutter }] as object}
      >
        {events.map((item) => {
          const tint = KIND_TINT[item.kind];
          const tappable = item.kind !== 'live_event';
          return (
            <Pressable
              key={item.eventId}
              style={s.card as object}
              onPress={() => open(item)}
              disabled={!tappable}
              accessibilityRole={tappable ? 'button' : undefined}
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
                <Text
                  style={[s.badgeText, item.kind === 'live_event' && s.badgeTextDark] as object}
                >
                  {item.badge}
                </Text>
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
                    <Text style={s.meta as object} numberOfLines={1}>
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

const s = StyleSheet.create({
  section: { marginBottom: 26 } as object,
  header: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    marginBottom: 14,
  } as object,
  accentBar: { width: 4, borderRadius: 2 } as object,
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    color: COLORS.beige,
    lineHeight: 37,
  } as object,
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
  badgeTextDark: { color: COLORS.deepNavy } as object,
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
  sep: { fontSize: 11, color: 'rgba(245,235,220,0.4)' } as object,
  meta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.62)',
    flexShrink: 1,
  } as object,
});
