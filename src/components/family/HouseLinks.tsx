// src/components/family/HouseLinks.tsx
// The way out of a character's family section and into the whole house.
//
// A character page shows one person's relatives; the house page shows the
// dynasty they sit in and can answer how they relate to anyone else in it.
// Someone reading a family section is already asking that question, so this is
// where the link belongs.
//
// Three shapes, because the same link has to sit in three kinds of container:
//   HouseInlineLink — beside a card's section title, at eyebrow scale.
//   HouseFooterLink — a full-width row closing a section that has no header room.
//   HouseLinks      — the standalone pill, for native, where there is no card
//                     for it to fall outside of.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';
import { PressScale } from '../ui/PressScale';
import type { HeroHouse } from '../../hooks/useHeroHouses';

/** Land on the house page with this character already picked out of the line. */
function houseHref(slug: string, heroId: string | null): `/house/${string}` {
  return `/house/${slug}${heroId ? `?focus=${encodeURIComponent(heroId)}` : ''}`;
}

/**
 * The house named beside a section title.
 *
 * Sized and spaced to read as a continuation of the eyebrow — "FAMILY ·
 * House Targaryen" is one phrase, and the second half of it happens to be a
 * door. The tint belongs to the sigil dot rather than the text: house colours
 * run from pale gold to near-black, and a label has to stay legible in all of
 * them.
 */
export function HouseInlineLink({
  houses,
  heroId,
}: {
  houses: HeroHouse[];
  heroId: string | null;
}) {
  if (houses.length === 0) return null;
  return (
    <View style={styles.inlineRow}>
      {houses.map((house) => (
        <InlineHouse key={house.slug} house={house} heroId={heroId} />
      ))}
    </View>
  );
}

function InlineHouse({ house, heroId }: { house: HeroHouse; heroId: string | null }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`See the ${house.name} family tree`}
      style={({ pressed }) => [styles.inline, pressed && styles.pressed]}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(houseHref(house.slug, heroId));
      }}
    >
      <View
        style={[styles.dot, { backgroundColor: house.sigil_tint ?? COLORS.orange }] as object}
      />
      <Text style={[styles.inlineText, hovered && styles.inlineTextHover] as object}>
        {house.name}
      </Text>
      <Ionicons name="chevron-forward" size={11} color={hovered ? COLORS.navy : '#b3a791'} />
    </Pressable>
  );
}

/**
 * The house as a closing row.
 *
 * Where the header is a single narrow line — the mobile family section — the
 * link can't share it, so it becomes the section's last line instead: a rule,
 * then a full-width row with a real touch target.
 */
export function HouseFooterLink({
  houses,
  heroId,
}: {
  houses: HeroHouse[];
  heroId: string | null;
}) {
  const router = useRouter();
  if (houses.length === 0) return null;
  return (
    <View style={styles.footer}>
      {houses.map((house) => (
        <PressScale
          key={house.slug}
          scale={0.97}
          accessibilityRole="link"
          accessibilityLabel={`See the ${house.name} family tree`}
          style={styles.footerRow}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(houseHref(house.slug, heroId));
          }}
        >
          <View
            style={[styles.dot, { backgroundColor: house.sigil_tint ?? COLORS.orange }] as object}
          />
          <Text style={styles.footerText}>{house.name}</Text>
          <View style={styles.spacer} />
          <Text style={styles.footerHint}>Full dynasty</Text>
          <Ionicons name="chevron-forward" size={14} color="#b3a791" />
        </PressScale>
      ))}
    </View>
  );
}

export function HouseLinks({ houses, heroId }: { houses: HeroHouse[]; heroId: string | null }) {
  const router = useRouter();
  if (houses.length === 0) return null;

  return (
    <View style={styles.row}>
      {houses.map((house) => (
        <Pressable
          key={house.slug}
          accessibilityRole="link"
          accessibilityLabel={`See the ${house.name} family tree`}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
            [styles.link, hovered && styles.linkHover, pressed && styles.pressed] as object
          }
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(houseHref(house.slug, heroId));
          }}
        >
          <View
            style={[styles.dot, { backgroundColor: house.sigil_tint ?? COLORS.orange }] as object}
          />
          <Text style={styles.text}>{house.name}</Text>
          <Ionicons name="chevron-forward" size={13} color={COLORS.navy} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e7dcc9',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  linkHover: { borderColor: '#cdbfa6' },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  text: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },

  // ── Inline, beside a section title ──────────────────────────────────────────
  inlineRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineText: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: '#7d8b93',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  inlineTextHover: { color: COLORS.navy },

  // ── Footer row, closing a section ───────────────────────────────────────────
  // Tinted rather than a flat beige: this rule has to read on the card's white
  // AND on the page's beige, where #ede5da all but disappears.
  footer: { borderTopWidth: 1, borderTopColor: 'rgba(41,60,67,0.12)', marginTop: 16 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 46 },
  footerText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.black,
  },
  spacer: { flex: 1 },
  footerHint: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#b3a791',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
