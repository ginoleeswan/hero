import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { BrandLogoView } from '../../PublisherBadge';
import type { BrandLogo } from '../../../constants/publishers';

/**
 * Faction "set banner" for a universe browse page: a brand-coloured stage
 * (colour glow → near-black, so any logo reads on the dark side) with the
 * universe LOGO as the headline and a stat line. Falls back to the name in the
 * display face when there's no logo. Web-only (RN-web style escape hatches).
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
  compact?: boolean;
}) {
  const stat =
    total > 0
      ? `${total.toLocaleString()} ${total === 1 ? 'CHARACTER' : 'CHARACTERS'}${
          leadName ? `  ·  LED BY ${leadName.toUpperCase()}` : ''
        }`
      : '';

  // Logo sized to a comfortable cap; the dark left side guarantees contrast.
  let logoNode: React.ReactNode = null;
  if (logo && badgeSize) {
    const aspect = badgeSize.width / badgeSize.height;
    const maxW = compact ? 230 : 380;
    let h = compact ? 42 : 68;
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
            backgroundImage: `radial-gradient(125% 135% at 90% 6%, ${color} 0%, ${colorDark} 40%, #0b0d12 100%)`,
          },
        ] as object
      }
    >
      <View style={styles.content}>
        {stat ? <Text style={styles.eyebrow}>{stat}</Text> : null}
        {logoNode ?? (
          <Text
            style={[styles.title, compact && (styles.titleCompact as object)] as object}
            numberOfLines={2}
          >
            {title}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 230,
    justifyContent: 'flex-end',
    paddingHorizontal: 32,
    paddingTop: 64,
    paddingBottom: 30,
  },
  bannerCompact: {
    minHeight: 170,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 22,
  },
  content: { position: 'relative', maxWidth: 760, alignItems: 'flex-start' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 14,
    textShadow: '0 1px 8px rgba(0,0,0,0.5)',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 64,
    lineHeight: 64,
    color: COLORS.beige,
    textShadow: '0 2px 18px rgba(0,0,0,0.5)',
  } as object,
  titleCompact: { fontSize: 40, lineHeight: 42 },
});
