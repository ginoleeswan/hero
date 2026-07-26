import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../constants/colors';
import {
  heroAvatarSource,
  heroCameoSource,
  heroInitials,
  monogramColor,
} from '../constants/heroImages';

interface HeroAvatarProps {
  id: string | number;
  name: string;
  /** heroes.avatar_url — the flat icon mark. Only famous heroes have one. */
  avatarUrl?: string | null;
  /** Portrait/comic image used when there's no avatar yet. */
  fallbackUrl?: string | null;
  /** Rendered edge length in points. */
  size: number;
  /** Corner radius; defaults to a squircle-ish quarter of the size. */
  radius?: number;
  /**
   * Drop the pale chip and let the cut-out head sit directly on whatever is
   * behind it — the head itself becomes the node. Only safe where the art reads
   * against the surface; the chip exists for slots where it wouldn't.
   */
  bare?: boolean;
}

/**
 * The small hero mark used in dense, node-sized slots — family-tree nodes, graph
 * nodes, chips — where a cropped comic cover is unreadable mush at 30pt.
 *
 * Three tiers, in order: the flat icon avatar, then the portrait cover-crop that
 * these slots used before, then the initials monogram. Avatars only exist for the
 * most famous heroes, so the fallbacks are the common path, not an edge case.
 *
 * Avatars are transparent PNGs, so this always paints a light chip behind them —
 * they're drawn for a pale ground, and without it they'd pick up whatever surface
 * they land on (the tree's black hero anchor, a gold badge) and lose their edges.
 * `contain` matters too: the art already carries its own margin, and cropping it
 * would clip the silhouette.
 */
export function HeroAvatar({
  id,
  name,
  avatarUrl,
  fallbackUrl,
  size,
  radius,
  bare = false,
}: HeroAvatarProps) {
  const box = {
    width: size,
    height: size,
    borderRadius: radius ?? Math.round(size / 4),
  };

  const avatar = heroAvatarSource(avatarUrl, Math.max(96, Math.round(size * 3)));
  if (avatar) {
    const image = (
      <Image
        source={avatar}
        style={bare ? { width: size, height: size } : styles.fill}
        contentFit="contain"
        transition={150}
      />
    );
    return bare ? image : <View style={[box, styles.chip]}>{image}</View>;
  }

  if (fallbackUrl) {
    return (
      <Image
        source={heroCameoSource(fallbackUrl, size)}
        style={box}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View style={[box, styles.mono, { backgroundColor: monogramColor(id) }]}>
      <Text style={[styles.monoText, { fontSize: Math.round(size * 0.4) }]} numberOfLines={1}>
        {heroInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: COLORS.beige,
    overflow: 'hidden',
  },
  fill: { width: '100%', height: '100%' },
  mono: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  monoText: {
    fontFamily: 'Flame-Regular',
    color: 'white',
    includeFontPadding: false,
    textAlign: 'center',
  },
});
