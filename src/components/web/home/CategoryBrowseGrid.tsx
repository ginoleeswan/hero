// The web "Browse the Universe" block — every category as an image-backed
// doorway tile in one calm responsive grid, replacing the long wall of
// near-identical category rails. Navigation wants a map, not a feed: the grid
// shows every door at once, nothing hidden behind a horizontal scroll.
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { prefetchCategory } from '../../../lib/query/prefetchBrowse';
import { HeroImage } from '../../HeroImage';
import {
  COLORS,
  ELEVATION,
  EYEBROW,
  HOVER_TRANSITION,
  pageGutter,
} from '../../../constants/colors';
import { BROWSE_PODS } from '../../home/CategoryPodGrid';
import type { BrowseCover } from '../../../lib/db/heroes';

// Publisher doorways live under /universe; every other axis under /category.
function pathFor(slug: string, kind: string): string {
  return kind === 'Publisher' ? `/universe/${slug}` : `/category/${slug}`;
}

export function CategoryBrowseGrid({
  covers,
  onNavigate,
}: {
  covers?: Record<string, BrowseCover>;
  onNavigate: (path: string) => void;
}) {
  const { width } = useWindowDimensions();
  const pad = pageGutter(width);
  const cols = width >= 1280 ? 4 : width >= 768 ? 3 : 2;
  const gap = 14;
  // Fixed tile size (not aspectRatio) — WebKit collapses aspectRatio grid cells.
  const tileW = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols);
  const tileH = Math.round(tileW * 1.12);

  return (
    <View style={[s.grid, { paddingHorizontal: pad, gap }] as object}>
      {BROWSE_PODS.map((p) => {
        const c = covers?.[p.slug];
        const coverUrl = c?.portrait_url ?? c?.image_url ?? c?.image_md_url;
        return (
          <Pressable
            key={p.slug}
            // Warm the grid on touch-down — the page paints instantly on arrival.
            onPressIn={() => prefetchCategory(p.slug as never)}
            onPress={() => onNavigate(pathFor(p.slug, p.kind))}
            accessibilityRole="link"
            accessibilityLabel={`Browse ${p.label}`}
            style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
              [
                s.tile,
                { width: tileW, height: tileH },
                (hovered || pressed) && (s.tileHover as object),
              ] as object
            }
          >
            {({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => (
              <>
                {/* Only render the cover when we actually have art — the
                    HeroImage initials fallback reads as broken on a doorway
                    tile; a clean ink tile with the label is the better empty. */}
                {!!coverUrl && (
                  <HeroImage
                    id={p.slug}
                    name={c?.name ?? p.label}
                    imageUrl={c?.image_url ?? c?.image_md_url}
                    portraitUrl={c?.portrait_url}
                    grid
                    contentFit="cover"
                    contentPosition={{ top: '32%', left: '50%' }}
                    style={StyleSheet.absoluteFill as object}
                    recyclingKey={p.slug}
                  />
                )}
                <View style={s.scrim as object} />
                <View style={s.body}>
                  <Text style={s.kind as object}>{p.kind}</Text>
                  <Text style={s.label as object} numberOfLines={2}>
                    {p.label}
                  </Text>
                </View>
                {/* Signature seam — the house orange hairline surfaces on hover. */}
                <View style={[s.seam, (hovered || pressed) && (s.seamOn as object)] as object} />
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    cursor: 'pointer',
    transition: HOVER_TRANSITION,
  } as object,
  tileHover: {
    transform: [{ translateY: -6 }],
    boxShadow: ELEVATION.hover,
  } as object,
  seam: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundImage: `linear-gradient(90deg, transparent 0%, ${COLORS.orange} 30%, ${COLORS.orange} 70%, transparent 100%)`,
    opacity: 0,
    transition: 'opacity 200ms ease',
  } as object,
  seamOn: { opacity: 1 } as object,
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(11,24,32,0.94) 0%, rgba(11,24,32,0.4) 45%, transparent 75%)',
  } as object,
  body: { padding: 14 },
  kind: {
    ...EYEBROW,
    marginBottom: 3,
  } as object,
  label: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.beige,
    lineHeight: 27,
    textShadow: '0 2px 8px rgba(0,0,0,0.9)',
  } as object,
});
