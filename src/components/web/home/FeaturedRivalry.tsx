// The curated lead for the "Beyond the Page" chapter — one rivalry shown large as
// a face-off banner (the app's versus identity, full-scale) so the editorial
// chapter opens with a moment instead of a plain header. Taps straight into the
// arena; the rivalries rail below carries the rest.
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, ELEVATION, HOVER_TRANSITION, pageGutter } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import { VsBadge } from '../../compare/VsBadge';
import type { Rivalry } from '../../../lib/db/heroes';

export function FeaturedRivalry({ rivalry }: { rivalry: Rivalry }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pagePad = pageGutter(width);
  const h = width < 760 ? 260 : 360;
  const { a, b } = rivalry;

  return (
    <View style={{ paddingHorizontal: pagePad, marginBottom: 52 } as object}>
      <Pressable
        onPress={() => router.push(`/compare/${a.id}/${b.id}` as Parameters<typeof router.push>[0])}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [s.card, { height: h }, hovered && (s.cardHover as object)] as object
        }
      >
        {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
          <>
            {/* Diagonal panel split — the comic slash. Faces zoom slowly on
                hover (cinematic, not springy). */}
            <HeroImage
              id={a.id}
              name={a.name}
              imageUrl={a.image_url}
              portraitUrl={a.portrait_url}
              contentFit="cover"
              // Short, wide containers crop a horizontal slice — anchor down the
              // image so the face rides up into frame instead of the top of the head.
              contentPosition={{ top: '32%', left: '50%' }}
              style={[s.faceA, hovered && (s.faceZoom as object)] as object}
            />
            <HeroImage
              id={b.id}
              name={b.name}
              imageUrl={b.image_url}
              portraitUrl={b.portrait_url}
              contentFit="cover"
              // Short, wide containers crop a horizontal slice — anchor down the
              // image so the face rides up into frame instead of the top of the head.
              contentPosition={{ top: '32%', left: '50%' }}
              style={[s.faceB, hovered && (s.faceZoomB as object)] as object}
            />
            <View style={s.seam as object} />
            <View style={s.slash as object} />
            <View style={s.scrim as object} />

            <Text style={s.kicker as object}>
              {rivalry.crossUniverse ? 'Dream Match' : 'Settle the Debate'}
            </Text>

            <View style={s.center as object}>
              <VsBadge size={width < 760 ? 52 : 68} variant="solid" />
              <View style={[s.cta, hovered && (s.ctaHover as object)] as object}>
                <Text style={s.ctaText as object}>Open the Arena →</Text>
              </View>
            </View>

            <View style={s.names as object}>
              <Text style={s.name as object} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={[s.name, { textAlign: 'right' }] as object} numberOfLines={1}>
                {b.name}
              </Text>
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: HOVER_TRANSITION,
  } as object,
  cardHover: {
    transform: [{ translateY: -4 }],
    boxShadow: ELEVATION.lifted,
  } as object,
  faceA: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
    height: '100%',
    transition: 'transform 900ms cubic-bezier(0.16, 1, 0.3, 1)',
  } as object,
  // Mirror the right fighter so the two face inward, toward the VS (same
  // convention as the matchup card).
  faceB: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '50%',
    height: '100%',
    transform: [{ scaleX: -1 }],
    transition: 'transform 900ms cubic-bezier(0.16, 1, 0.3, 1)',
  } as object,
  // Slow cinematic push-in on hover. Face B's zoom must restate the mirror —
  // transform arrays replace, they don't merge.
  faceZoom: { transform: [{ scale: 1.05 }] } as object,
  faceZoomB: { transform: [{ scaleX: -1 }, { scale: 1.05 }] } as object,
  // Skewed seam band — wide enough to swallow the straight joint underneath,
  // so the visible divide reads as a diagonal comic-panel slash.
  seam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 150,
    marginLeft: -75,
    transform: [{ skewX: '-7deg' }],
    backgroundImage:
      'linear-gradient(to right, transparent 0%, rgba(11,24,32,0.7) 50%, transparent 100%)',
  } as object,
  // The slash itself — a warm hairline riding the diagonal seam.
  slash: {
    position: 'absolute',
    top: -12,
    bottom: -12,
    left: '50%',
    width: 3,
    marginLeft: -1,
    transform: [{ skewX: '-7deg' }],
    backgroundImage: `linear-gradient(to bottom, transparent 0%, ${COLORS.orange}AA 25%, ${COLORS.orange}AA 75%, transparent 100%)`,
  } as object,
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
    backgroundImage: 'linear-gradient(to top, rgba(11,24,32,0.95) 0%, transparent 100%)',
  } as object,
  // Pinned over unpredictable cover art (bright yellows included) — the plate
  // + shadow keep it legible on anything.
  kicker: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: COLORS.beige,
    backgroundColor: 'rgba(11,24,32,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
  } as object,
  center: {
    position: 'absolute',
    top: 0,
    bottom: 44,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  } as object,
  cta: {
    backgroundColor: COLORS.orange,
    borderRadius: 24,
    paddingVertical: 9,
    paddingHorizontal: 20,
    transition: 'transform 200ms ease',
  } as object,
  ctaHover: { transform: [{ scale: 1.06 }] } as object,
  ctaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  } as object,
  names: {
    position: 'absolute',
    bottom: 18,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  } as object,
  name: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: COLORS.beige,
    lineHeight: 35,
    textShadow: '0 2px 10px rgba(0,0,0,0.9)',
  } as object,
});
