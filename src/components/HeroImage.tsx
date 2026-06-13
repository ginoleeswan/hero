import { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Image, ImageContentFit, ImageContentPosition, ImageStyle } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import {
  heroGridImageSource,
  heroImageSource,
  heroInitials,
  monogramColor,
} from '../constants/heroImages';

interface HeroImageProps {
  id: string | number;
  name: string;
  imageUrl?: string | null;
  portraitUrl?: string | null;
  imageMdUrl?: string | null;
  /** Use the grid (smaller) source chain instead of the full-res detail chain. */
  grid?: boolean;
  /** Same style you'd give the underlying expo-image; fills the card box. */
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  contentPosition?: ImageContentPosition;
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  recyclingKey?: string | null;
  transition?: number | null;
  /** Fires when the portrait loads, or immediately when the monogram is shown. */
  onLoad?: () => void;
}

/**
 * Drop-in replacement for the `<Image>` used across hero cards, banners and
 * rails. Renders the portrait when one exists; otherwise (or if the remote
 * image fails to load) fills the same box with a deterministic monogram — the
 * hero's initials over a stable, id-derived colour plus a faint glyph.
 *
 * It replaces only the image element, so each call site keeps its own
 * surrounding gradient/name/badge layout untouched.
 */
export function HeroImage({
  id,
  name,
  imageUrl,
  portraitUrl,
  imageMdUrl,
  grid = false,
  style,
  contentFit = 'cover',
  contentPosition = 'center',
  cachePolicy = 'memory-disk',
  recyclingKey,
  transition,
  onLoad,
}: HeroImageProps) {
  const [errored, setErrored] = useState(false);

  const source = grid
    ? heroGridImageSource(id, imageUrl, portraitUrl, imageMdUrl)
    : heroImageSource(id, imageUrl, portraitUrl);

  const showMonogram = !source.uri || errored;

  if (showMonogram) {
    return <HeroMonogram seed={id} name={name} style={style} onLoad={onLoad} />;
  }

  return (
    <Image
      source={source}
      contentFit={contentFit}
      contentPosition={contentPosition}
      style={style}
      cachePolicy={cachePolicy}
      recyclingKey={recyclingKey ?? String(id)}
      transition={transition ?? 200}
      onLoad={onLoad}
      onError={() => setErrored(true)}
    />
  );
}

/**
 * The fallback portrait itself — initials over a deterministic colour plus a
 * faint glyph. Exported for source-based consumers (e.g. the compare arena)
 * that hold a resolved image source rather than the hero's id/urls; pass a
 * stable `seed` (id when available, otherwise the name) for the colour.
 */
export function HeroMonogram({
  seed,
  name,
  style,
  onLoad,
}: {
  seed: string | number;
  name: string;
  style?: StyleProp<ImageStyle>;
  onLoad?: () => void;
}) {
  const [size, setSize] = useState(0);

  useEffect(() => {
    onLoad?.();
    // Only fire once on mount; the monogram has nothing async to load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(Math.min(width, height));
  };

  const background = monogramColor(seed);
  const initialsSize = size > 0 ? Math.round(size * 0.4) : 0;
  const glyphSize = size > 0 ? Math.round(size * 0.55) : 0;

  return (
    <View
      onLayout={onLayout}
      style={[style as StyleProp<ViewStyle>, styles.monogram, { backgroundColor: background }]}
    >
      {glyphSize > 0 ? (
        <Ionicons
          name="person"
          size={glyphSize}
          color={COLORS.beige}
          style={styles.glyph}
        />
      ) : null}
      {initialsSize > 0 ? (
        <Text style={[styles.initials, { fontSize: initialsSize }]} numberOfLines={1}>
          {heroInitials(name)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  monogram: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glyph: {
    position: 'absolute',
    opacity: 0.12,
  },
  initials: {
    fontFamily: 'Flame-Regular',
    color: COLORS.beige,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
