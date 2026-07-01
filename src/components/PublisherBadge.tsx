// src/components/PublisherBadge.tsx
// The publisher mark shown over a hero's card art: a brand logo on a faint
// frosted chip, or a text pill for publishers we don't have a logo for. Every
// card overlay (native search, web featured) renders through this so a hero
// brands identically everywhere. Branding is resolved via the publisher
// registry — see constants/publishers.ts.
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import {
  brandForPublisher,
  publisherHref,
  franchiseHref,
  type BrandLogo,
} from '../constants/publishers';

/**
 * Render a brand logo at a fixed box. A logo is either an SVG component (via
 * react-native-svg-transformer — a function) or a raster image source (PNG via
 * require). Branch on which it is so both work on native and web.
 */
export function BrandLogoView({
  logo,
  width,
  height,
  shadow,
  tint,
}: {
  logo: BrandLogo;
  width: number;
  height: number;
  shadow?: boolean;
  /** Paint a single-colour silhouette logo this ink (SVG only). Unset → the
   *  logo keeps its own colours. */
  tint?: string;
}) {
  if (typeof logo === 'function') {
    const Logo = logo;
    // `fill` covers fill-less silhouettes (Nintendo/Disney); `color` covers the
    // currentColor ones (Image/Shueisha). Both no-op when tint is undefined.
    return (
      <Logo
        width={width}
        height={height}
        fill={tint}
        color={tint}
        style={(shadow ? styles.logoShadow : undefined) as StyleProp<ViewStyle>}
      />
    );
  }
  return (
    <Image
      source={logo}
      style={shadow ? [{ width, height }, styles.logoShadow] : { width, height }}
      contentFit="contain"
      tintColor={tint}
    />
  );
}

/**
 * The brand logo for the character-page eyebrow — laid out inline (not
 * absolutely positioned) so it stands in for a text label above the hero's
 * name. CHIPLESS by design: the bare (tinted) mark sits on the header gradient
 * with a soft drop-shadow for legibility. `height` is the base size; a brand's
 * `eyebrowScale` enlarges marks that read small (e.g. the Star Wars wordmark).
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
  const aspect = brand.badgeSize.width / brand.badgeSize.height;
  // Balance visual weight across mixed logo shapes: square emblems (DC,
  // NetherRealm) get a lift so they don't read tiny next to long wordmarks.
  // An explicit `eyebrowScale` overrides the heuristic (e.g. Star Wars).
  const scale = brand.eyebrowScale ?? (aspect < 1.6 ? 1.45 : aspect < 2.4 ? 1.2 : 1);
  const h = height * scale;
  const width = h * aspect;
  return (
    <View style={styles.inlineLogo}>
      <BrandLogoView logo={brand.logo} width={width} height={h} shadow tint={brand.logoTint} />
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
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

export function UniverseEyebrow({
  publisher,
  franchise,
  logoHeight = 18,
  textStyle,
}: {
  publisher: string | null | undefined;
  /** Sub-group within the universe (e.g. "Final Fantasy" under "Square Enix").
   *  When present and distinct from the publisher, renders a two-tier breadcrumb. */
  franchise?: string | null | undefined;
  logoHeight?: number;
  textStyle?: StyleProp<TextStyle>;
}) {
  const router = useRouter();
  const brand = brandForPublisher(publisher);

  const universeInner =
    brand?.logo && brand.badgeSize ? (
      <PublisherLogoChip publisher={publisher} height={logoHeight} />
    ) : publisher ? (
      <Text style={textStyle} numberOfLines={1}>
        {publisher}
      </Text>
    ) : null;

  if (!universeInner) return null;

  const uHref = publisherHref(publisher);
  const universeNode = uHref ? (
    <Pressable
      onPress={() => router.push(uHref as Href)}
      accessibilityRole="link"
      accessibilityLabel={`Browse the ${publisher} universe`}
      style={({ pressed }) => (pressed ? styles.eyebrowPressed : undefined)}
    >
      {universeInner}
    </Pressable>
  ) : (
    universeInner
  );

  // Collapse the second tier when there's no franchise, or it just repeats the
  // universe (e.g. Pokémon/Pokémon) — then the eyebrow is universe-only as before.
  const fHref = franchiseHref(franchise);
  const showFranchise = !!franchise && !!fHref && norm(franchise) !== norm(publisher);
  if (!showFranchise) return universeNode;

  return (
    <View style={styles.eyebrowRow}>
      {universeNode}
      <Text style={[textStyle, styles.eyebrowSep]}>›</Text>
      <Pressable
        onPress={() => router.push(fHref as Href)}
        accessibilityRole="link"
        accessibilityLabel={`Browse the ${franchise} franchise`}
        style={({ pressed }) => (pressed ? styles.eyebrowPressed : undefined)}
      >
        <Text style={textStyle} numberOfLines={1}>
          {franchise}
        </Text>
      </Pressable>
    </View>
  );
}

export function PublisherBadge({ publisher }: { publisher: string | null | undefined }) {
  const brand = brandForPublisher(publisher);

  if (brand?.logo && brand.badgeSize) {
    return (
      <View style={[styles.badge, brand.logoOnLight && styles.badgeLight]}>
        <BrandLogoView
          logo={brand.logo}
          width={brand.badgeSize.width}
          height={brand.badgeSize.height}
          tint={brand.logoTint}
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
  // Light backing for logos that read best on white (e.g. Nintendo red).
  badgeLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  // Chipless inline logo for the detail eyebrow — the bare mark over the header
  // gradient (drop-shadow on the logo itself keeps it legible).
  inlineLogo: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  // Subtle press feedback for the tappable universe eyebrow.
  eyebrowPressed: {
    opacity: 0.6,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrowSep: {
    opacity: 0.5,
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
