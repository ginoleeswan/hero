// The sponsor slot — the ONLY promo unit the app is allowed to render, built to
// the tasteful-sponsorship playbook (docs/superpowers/specs/
// 2026-07-16-monetization-options.md §C):
//   * max ONE per page — enforce at the call site; this file is the only unit.
//   * native feed-card grammar (beige-canvas card, eyebrow label), never
//     sticky/interstitial/autoplay.
//   * BANNED placements: character-page top viewport, the dailies/games, the
//     compare arena.
//   * supporters see none — their Ko-fi support already bought that.
//   * house content today (honest "From Mythique" eyebrow); a paid sponsor one
//     day just swaps the creative source + eyebrow to "Sponsor".
// Impressions + clicks flow to Vercel custom events, so the slot earns real
// CTR data long before any sponsor conversation happens.
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PAPER_TEXT, ORANGE_INK } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { promoForDay } from '../lib/sponsor/houseAds';
import { openKofi } from '../lib/support/kofi';
import { track } from '../lib/analytics';

export function SponsorSlot({ placement }: { placement: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const promo = promoForDay();
  const seen = useRef(false);

  const suppressed = !!profile?.is_supporter;

  useEffect(() => {
    if (suppressed || seen.current) return;
    seen.current = true;
    track('sponsor_impression', { promo: promo.id, placement });
  }, [suppressed, promo.id, placement]);

  // Supporters browse promo-free — the quiet perk of the tier.
  if (suppressed) return null;

  const open = () => {
    track('sponsor_click', { promo: promo.id, placement });
    if (promo.target === 'kofi') openKofi();
    else router.push(promo.target as Href);
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${promo.title} — ${promo.cta}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={promo.icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={COLORS.orange}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>{promo.eyebrow}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {promo.title}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {promo.sub}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{promo.cta}</Text>
        <Ionicons name="chevron-forward" size={13} color={COLORS.orange} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fffdf8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(231,115,51,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 1 },
  eyebrow: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
  },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: COLORS.navy },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: PAPER_TEXT.faint, lineHeight: 17 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ctaText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: ORANGE_INK },
});
