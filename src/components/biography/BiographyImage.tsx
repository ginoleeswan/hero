import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { CustomBlockRenderer } from 'react-native-render-html';
import { Skeleton } from '../ui/Skeleton';

// A biography runs to ~240 images on Spider-Man. The box below is reserved
// before any of them are fetched, so the document's height is final the moment
// it mounts.
const DEFAULT_RATIO = 0.72; // height / width — comic panels sit around 4:3–3:2.
const RADIUS = 8;

interface Props {
  uri: string;
  /** Column width the prose is laid out in. */
  contentWidth: number;
  /**
   * Intrinsic width from the `srcset` descriptor (`… 185w`), when ComicVine
   * bothered to give one. Used only to avoid blowing a small image up past its
   * own resolution.
   */
  intrinsicWidth?: number;
}

/**
 * One image inside biography prose, with its space reserved up front.
 *
 * The default `img` renderer in react-native-render-html has to *measure*
 * before it can lay out, and ComicVine's markup carries no width/height — only
 * a `srcset` descriptor. So every image cost a round trip before it could take
 * up space, and the document reflowed as each one landed: on a long biography
 * that is a continuous stream of layout shifts under the reader's thumb, which
 * is what "choppy" actually was.
 *
 * Here the box is fixed from the start and never changes, so nothing below an
 * image ever moves. The trade is that the box is a guess: `contentFit="contain"`
 * shows the whole image inside it, letterboxing rather than cropping when the
 * real aspect ratio differs. A stable page is worth more than a perfectly
 * fitted one — and deliberately, the box is NOT resized on load, because a
 * "correction" after paint is exactly the reflow this exists to remove.
 */
export function BiographyImage({ uri, contentWidth, intrinsicWidth }: Props) {
  const [loaded, setLoaded] = useState(false);

  const width = Math.min(
    contentWidth,
    intrinsicWidth && intrinsicWidth > 0 ? intrinsicWidth : contentWidth,
  );
  const height = Math.round(width * DEFAULT_RATIO);

  return (
    <View style={[styles.frame, { width, height }]}>
      {/* Sits underneath rather than swapping out, so there is no unmount and
          no second layout pass — the image simply fades in over it. */}
      {!loaded ? (
        <View style={StyleSheet.absoluteFill}>
          <Skeleton width="100%" height={height} borderRadius={RADIUS} />
        </View>
      ) : null}
      <Image
        source={{ uri }}
        style={styles.image}
        contentFit="contain"
        // Low priority: prose is the point, and the reader is almost certainly
        // reading text above whatever is still fetching.
        priority="low"
        transition={180}
        cachePolicy="memory-disk"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    marginVertical: 16,
    borderRadius: RADIUS,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  image: { width: '100%', height: '100%' },
});

/**
 * Factory rather than a bare renderer: the renderer needs the prose column
 * width, which is a screen concern (`useWindowDimensions`), and RNRH gives
 * custom renderers no way to receive it other than closure.
 */
export function makeBiographyImageRenderer(contentWidth: number): CustomBlockRenderer {
  const Renderer: CustomBlockRenderer = ({ tnode }) => {
    const src = tnode.attributes.src;
    if (!src) return null;

    // `srcset="…jpg 185w"` — take the first descriptor as the intrinsic width.
    const srcset = tnode.attributes.srcset;
    const match = srcset?.match(/\s(\d+)w/);
    const intrinsicWidth = match ? Number(match[1]) : undefined;

    return <BiographyImage uri={src} contentWidth={contentWidth} intrinsicWidth={intrinsicWidth} />;
  };
  return Renderer;
}
