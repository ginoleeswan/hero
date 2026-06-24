// src/components/PublisherBadge.tsx
// The publisher mark shown over a hero's card art: a brand logo on a faint
// frosted chip, or a text pill for publishers we don't have a logo for. Every
// card overlay (native search, web featured) renders through this so a hero
// brands identically everywhere. Branding is resolved via the publisher
// registry — see constants/publishers.ts.
import { View, Text, StyleSheet, Pressable, type StyleProp, type TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { brandForPublisher, publisherHref } from '../constants/publishers';

/**
 * The brand logo on a frosted chip, laid out inline (not absolutely
 * positioned) so it can stand in for a text label — e.g. the publisher eyebrow
 * above a hero's name on the detail page. Renders nothing when the publisher
 * has no logo, so callers fall back to their own text treatment. `height` sets
 * the logo size; width follows the art's aspect ratio.
 */
export function PublisherLogoChip({
  publisher,
  height = 16,
}: {
  publisher: string | null | undefined;
  height?: number;
}) {
  const brand = brandForPublisher(publisher);
  if (!brand?.logo || !brand.badgeSize) return null;
  const width = height * (brand.badgeSize.width / brand.badgeSize.height);
  return (
    <View style={styles.inlineLogo}>
      <Image
        source={brand.logo}
        style={[{ width, height }, styles.logoShadow]}
        contentFit="contain"
      />
    </View>
  );
}

/**
 * The publisher eyebrow above a hero's name on the detail page, as a doorway
 * into the universe: a logo chip (when we have one) or the plain name, wrapped
 * in a link to that universe's browse route. Falls back to non-tappable text
 * for category buckets (which aren't browsable universes). Shared by the native
 * and web character views so the two can't drift.
 */
export function UniverseEyebrow({
  publisher,
  logoHeight = 16,
  textStyle,
}: {
  publisher: string | null | undefined;
  logoHeight?: number;
  textStyle?: StyleProp<TextStyle>;
}) {
  const router = useRouter();
  const brand = brandForPublisher(publisher);

  const inner =
    brand?.logo && brand.badgeSize ? (
      <PublisherLogoChip publisher={publisher} height={logoHeight} />
    ) : publisher ? (
      <Text style={textStyle} numberOfLines={1}>
        {publisher}
      </Text>
    ) : null;

  if (!inner) return null;

  const href = publisherHref(publisher);
  if (!href) return inner;

  return (
    <Pressable
      onPress={() => router.push(href as Href)}
      accessibilityRole="link"
      accessibilityLabel={`Browse the ${publisher} universe`}
      style={({ pressed }) => (pressed ? styles.eyebrowPressed : undefined)}
    >
      {inner}
    </Pressable>
  );
}

export function PublisherBadge({ publisher }: { publisher: string | null | undefined }) {
  const brand = brandForPublisher(publisher);

  if (brand?.logo && brand.badgeSize) {
    return (
      <View style={styles.badge}>
        <Image
          source={brand.logo}
          style={{ width: brand.badgeSize.width, height: brand.badgeSize.height }}
          contentFit="contain"
        />
      </View>
    );
  }

  if (publisher) {
    return (
      <View style={styles.pill}>
        <Text style={styles.pillText} numberOfLines={1}>
          {publisher}
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  // Logos float on a faint frosted chip so they read on light artwork too.
  badge: {
    position: 'absolute',
    top: 9,
    left: 9,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(18,24,28,0.42)',
  },
  // Inline, flat logo for use in text-flow (e.g. the detail eyebrow) — no
  // backing chip, just the bare mark sitting where the label would.
  inlineLogo: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  // Subtle press feedback for the tappable universe eyebrow.
  eyebrowPressed: {
    opacity: 0.6,
  },
  // Soft drop-shadow keeps the flat logo legible over busy/dark artwork. The
  // `filter` form follows the logo silhouette (so transparent marks like the DC
  // circle don't get a rectangular halo) on web and the new architecture.
  logoShadow: {
    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.55))',
  } as object,
  pill: {
    position: 'absolute',
    top: 9,
    left: 9,
    backgroundColor: 'rgba(18,24,28,0.5)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
