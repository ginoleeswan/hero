import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { BrandLogoView } from '../../PublisherBadge';
import type { BrandLogo } from '../../../constants/publishers';
import { TOPBAR_HEIGHT } from '../TopBar';

/**
 * Editorial "set banner" for a universe browse page. A brand-coloured stage
 * (colour glow → near-black) with a faded roster montage on the right and a
 * masthead block — the universe LOGO big, a hairline rule, then the stat line.
 * When `sticky`, it pins to the top and `collapsed` (driven by scroll) shrinks
 * it to a compact bar that lives above the grid/filters. Web-only.
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
  sticky,
  collapsed,
}: {
  title: string;
  color: string;
  colorDark: string;
  total: number;
  leadName?: string | null;
  logo?: BrandLogo;
  badgeSize?: { width: number; height: number };
  logoTint?: string;
  heroImageUrls?: string[];
  compact?: boolean;
  sticky?: boolean;
  collapsed?: boolean;
}) {
  const stat =
    total > 0
      ? `${total.toLocaleString()} ${total === 1 ? 'CHARACTER' : 'CHARACTERS'}${
          leadName ? `  ·  LED BY ${leadName.toUpperCase()}` : ''
        }`
      : '';

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

  const expandedMin = compact ? 210 : 300;

  return (
    <View
      style={
        [
          styles.banner,
          {
            minHeight: collapsed ? COLLAPSED_H : expandedMin,
            paddingBottom: collapsed ? 14 : compact ? 26 : 40,
            paddingHorizontal: compact ? 16 : 32,
            paddingTop: compact ? 58 : 84,
            backgroundImage: `radial-gradient(125% 140% at 92% 4%, ${color} 0%, ${colorDark} 42%, #0b0d12 100%)`,
          },
          sticky && (styles.sticky as object),
          styles.transition as object,
        ] as object
      }
    >
      {/* Faded roster montage filling the right; fades out as the banner collapses. */}
      {heroImageUrls && heroImageUrls.length > 0 ? (
        <View
          style={
            [
              styles.montage,
              styles.transition as object,
              {
                opacity: collapsed ? 0 : 0.5,
                maskImage: 'linear-gradient(to left, #000 30%, transparent 100%)',
              },
            ] as object
          }
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
        {/* Headline (logo or name) scales down, anchored bottom-left, on collapse. */}
        <View
          style={
            [
              styles.transition as object,
              {
                transform: [{ scale: collapsed ? 0.42 : 1 }],
                transformOrigin: 'left bottom',
              },
            ] as object
          }
        >
          {logoNode ?? (
            <Text
              style={[styles.title, compact && (styles.titleCompact as object)] as object}
              numberOfLines={2}
            >
              {title}
            </Text>
          )}
        </View>
        {stat ? (
          <View
            style={
              [
                styles.meta,
                styles.transition as object,
                { opacity: collapsed ? 0 : 1, maxHeight: collapsed ? 0 : 80 },
              ] as object
            }
          >
            <View style={styles.rule} />
            <Text style={styles.caption}>{stat}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Compact height must keep the (scaled) logo below the floating top bar.
const COLLAPSED_H = TOPBAR_HEIGHT + 64;

const styles = StyleSheet.create({
  banner: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  sticky: { position: 'sticky', top: 0, zIndex: 30 } as object,
  transition: {
    transition:
      'min-height 320ms ease, padding-bottom 320ms ease, opacity 240ms ease, max-height 320ms ease, transform 320ms ease',
  } as object,
  montage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '62%' as unknown as number,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  montageTile: {
    height: '100%' as unknown as number,
    aspectRatio: 0.75,
    marginLeft: -28,
    borderRadius: 4,
  },
  montageScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  content: { position: 'relative', maxWidth: 820, alignItems: 'flex-start' },
  meta: { alignItems: 'flex-start', overflow: 'hidden' },
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
