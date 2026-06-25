import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { BrandLogoView } from '../../PublisherBadge';
import type { BrandLogo } from '../../../constants/publishers';

/**
 * Editorial "set banner" for a universe browse page: a brand-coloured stage
 * (colour glow → near-black) with a faded roster montage on the right, and a
 * masthead block on the left — the universe LOGO big as the headline, a hairline
 * rule, then the stat line as a caption. Falls back to the name in the display
 * face when there's no logo. Web-only (RN-web style escape hatches).
 */
export function BrowseBanner({
  title,
  color,
  colorDark,
  total,
  leadName,
  logo,
  badgeSize,
  logoTint,
  heroImageUrls,
  compact,
}: {
  title: string;
  color: string;
  colorDark: string;
  total: number;
  leadName?: string | null;
  logo?: BrandLogo;
  badgeSize?: { width: number; height: number };
  logoTint?: string;
  /** Top roster portraits, shown as a faded montage filling the right side. */
  heroImageUrls?: string[];
  compact?: boolean;
}) {
  const stat =
    total > 0
      ? `${total.toLocaleString()} ${total === 1 ? 'CHARACTER' : 'CHARACTERS'}${
          leadName ? `  ·  LED BY ${leadName.toUpperCase()}` : ''
        }`
      : '';

  // Logo as the editorial centerpiece — sized big by height, capped on width so
  // wide wordmarks (Nintendo) and square marks (DC) both read large.
  let logoNode: React.ReactNode = null;
  if (logo && badgeSize) {
    const aspect = badgeSize.width / badgeSize.height;
    const maxW = compact ? 250 : 440;
    let h = compact ? 62 : 122;
    let w = h * aspect;
    if (w > maxW) {
      w = maxW;
      h = w / aspect;
    }
    logoNode = <BrandLogoView logo={logo} width={w} height={h} tint={logoTint} />;
  }

  return (
    <View
      style={
        [
          styles.banner,
          compact && (styles.bannerCompact as object),
          {
            backgroundImage: `radial-gradient(125% 140% at 92% 4%, ${color} 0%, ${colorDark} 42%, #0b0d12 100%)`,
          },
        ] as object
      }
    >
      {/* Faded roster montage filling the right — previews who's inside without
          one hard crop. Sits under the gradient-tinted scrim + the content. */}
      {heroImageUrls && heroImageUrls.length > 0 ? (
        <View
          style={[
            styles.montage,
            { maskImage: 'linear-gradient(to left, #000 30%, transparent 100%)' } as object,
          ]}
          pointerEvents="none"
        >
          {heroImageUrls.slice(0, 6).map((uri, i) => (
            <Image
              key={`${uri}-${i}`}
              source={{ uri }}
              contentFit="cover"
              contentPosition="top"
              style={styles.montageTile}
            />
          ))}
        </View>
      ) : null}
      {/* Brand-tinted scrim over the montage so the colour and type stay strong. */}
      <View
        style={
          [
            styles.montageScrim,
            {
              backgroundImage: `linear-gradient(90deg, ${colorDark} 6%, transparent 58%), radial-gradient(120% 120% at 90% 4%, ${color}55 0%, transparent 55%)`,
            },
          ] as object
        }
        pointerEvents="none"
      />
      <View style={styles.content}>
        {logoNode ?? (
          <Text
            style={[styles.title, compact && (styles.titleCompact as object)] as object}
            numberOfLines={2}
          >
            {title}
          </Text>
        )}
        {stat ? (
          <>
            <View style={styles.rule} />
            <Text style={styles.caption}>{stat}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 300,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 84,
    paddingBottom: 40,
  },
  bannerCompact: {
    minHeight: 210,
    paddingHorizontal: 16,
    paddingTop: 58,
    paddingBottom: 26,
  },
  // Faded portrait montage occupying the right; fades into the gradient at left.
  montage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '62%' as unknown as number,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    opacity: 0.5,
  },
  montageTile: {
    height: '100%' as unknown as number,
    aspectRatio: 0.75,
    marginLeft: -28,
    borderRadius: 4,
  },
  montageScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: { position: 'relative', maxWidth: 820, alignItems: 'flex-start' },
  // Hairline under the logo — an editorial divider into the caption.
  rule: {
    width: 64,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(245,235,220,0.4)',
    marginTop: 24,
    marginBottom: 14,
  },
  caption: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    textShadow: '0 1px 8px rgba(0,0,0,0.5)',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 72,
    lineHeight: 72,
    color: COLORS.beige,
    textShadow: '0 2px 18px rgba(0,0,0,0.5)',
  } as object,
  titleCompact: { fontSize: 42, lineHeight: 44 },
});
