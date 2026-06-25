import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';

/**
 * Faction "set banner" for a universe browse page: a brand-coloured stage with
 * the roster's marquee hero bleeding off the right, a stat line, and the
 * universe name in the display face. Gives each universe its own identity
 * instead of the shared slim header. Web-only (RN-web style escape hatches).
 */
export function BrowseBanner({
  title,
  color,
  colorDark,
  heroImageUrl,
  total,
  leadName,
  compact,
}: {
  title: string;
  color: string;
  colorDark: string;
  heroImageUrl?: string | null;
  total: number;
  leadName?: string | null;
  /** Smaller vertical rhythm on phones. */
  compact?: boolean;
}) {
  const stat =
    total > 0
      ? `${total.toLocaleString()} ${total === 1 ? 'CHARACTER' : 'CHARACTERS'}${
          leadName ? `  ·  LED BY ${leadName.toUpperCase()}` : ''
        }`
      : '';
  return (
    <View
      style={
        [
          styles.banner,
          compact && (styles.bannerCompact as object),
          // Dark-anchored so any brand colour stays legible; the bright end is a
          // glow up-right behind the hero.
          {
            backgroundImage: `radial-gradient(120% 140% at 100% 0%, ${color} 0%, ${colorDark} 55%, ${colorDark} 100%)`,
          },
        ] as object
      }
    >
      {heroImageUrl ? (
        <Image
          source={{ uri: heroImageUrl }}
          contentFit="cover"
          contentPosition="top"
          style={styles.hero as object}
        />
      ) : null}
      {/* Scrim keeps the type crisp where it overlaps the hero. */}
      <View style={styles.scrim as object} />
      <View style={styles.content}>
        {stat ? <Text style={styles.eyebrow}>{stat}</Text> : null}
        <Text
          style={[styles.title, compact && (styles.titleCompact as object)] as object}
          numberOfLines={2}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 240,
    justifyContent: 'flex-end',
    paddingHorizontal: 32,
    paddingTop: 64,
    paddingBottom: 28,
  },
  bannerCompact: {
    minHeight: 180,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 20,
  },
  hero: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '52%',
    // Fade the portrait into the banner from the right.
    maskImage: 'linear-gradient(to left, #000 30%, transparent 92%)',
    opacity: 0.55,
  } as object,
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.35), transparent 55%)',
  } as object,
  content: {
    position: 'relative',
    maxWidth: 720,
  },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 10,
    textShadow: '0 1px 8px rgba(0,0,0,0.45)',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 64,
    lineHeight: 64,
    color: COLORS.beige,
    textShadow: '0 2px 18px rgba(0,0,0,0.5)',
  } as object,
  titleCompact: {
    fontSize: 40,
    lineHeight: 42,
  },
});
