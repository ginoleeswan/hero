// src/components/web/home/ArrivalLead.tsx
// The character the visitor was just watching, at the top of the feed.
//
// Measured 2026-08-16: 2,464 of 2,466 TikTok arrivals landed on `/` or
// `/explore`, and left at 1.1 pages per session. Visitors who reach a character
// page read 4.3 of them. Social captions now deep-link to their subject, which
// handles the common case — but a link is not a guarantee. In-app browsers and
// shorteners rewrite paths, and a viewer may tap the profile-bio link instead of
// the caption. Every one of those still lands on the feed.
//
// `utm_content` survives all of it, because a query parameter is carried along
// where a path is not. So the feed reads it and leads with the subject.
//
// Deliberately NOT a "you came from a video about X" banner. Naming the
// referrer back at someone reads as surveillance for no benefit — the visitor
// knows what they just watched. It reads as a normal first card that happens to
// be the right one, and it says why it can be trusted ("the character from that
// clip") only through the label, not through what we know about them.
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../../constants/colors';
import type { Hero } from '../../../types';

export function ArrivalLead({ hero, onPress }: { hero: Hero; onPress: (id: string) => void }) {
  const art = hero.portrait_url ?? hero.image_url ?? null;

  return (
    <Pressable
      style={s.wrap as object}
      onPress={() => onPress(hero.id)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${hero.name}`}
    >
      {!!art && <Image source={{ uri: art }} style={s.art} contentFit="cover" transition={160} />}
      <View style={s.body}>
        <Text style={s.kicker}>Pick up where you left off</Text>
        <Text style={s.name} numberOfLines={1}>
          {hero.name}
        </Text>
        {!!hero.summary && (
          <Text style={s.summary} numberOfLines={2}>
            {hero.summary}
          </Text>
        )}
        <View style={s.cta}>
          <Text style={s.ctaText}>Open the file</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.orange} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 14,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(245,235,220,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
    marginBottom: 22,
  } as object,
  art: { width: 76, height: 76, borderRadius: 999, backgroundColor: 'rgba(11,24,32,0.5)' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  // Flame needs lineHeight >= 1.22x fontSize.
  name: { fontFamily: 'Flame-Regular', fontSize: 23, lineHeight: 30, color: COLORS.beige },
  summary: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: INK_TEXT.faint,
  },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  ctaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.orange,
  },
});
