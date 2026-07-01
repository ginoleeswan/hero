import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { CARD_SHADOW, ELEVATION, pageGutter } from '../../../constants/colors';
import { FEATURED_PUBLISHERS } from '../../../constants/publishers';
import { BrandLogoView } from '../../PublisherBadge';

// Logo height inside a pod; width follows each mark's aspect ratio.
const LOGO_H = 44;

/**
 * One pod per featured publisher, each showing the brand logo (or its name
 * wordmark when we have no logo art) and linking to that publisher's hero
 * list. Single 4-up row on desktop, 2×2 grid below.
 *
 * `surface` picks the material: `ink` (glass pods on the dark stage) or
 * `paper` (white cards on the beige Library canvas). On paper, white-tinted
 * silhouette logos are repainted in their brand colour so they don't vanish.
 */
export function PublisherPods({
  onNavigate,
  surface = 'ink',
}: {
  onNavigate: (path: string) => void;
  surface?: 'ink' | 'paper';
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const onPaper = surface === 'paper';

  return (
    <View
      style={
        [
          s.row,
          !isDesktop && (s.rowWrap as object),
          { paddingHorizontal: pageGutter(width) },
        ] as object
      }
    >
      {FEATURED_PUBLISHERS.map((p) => {
        const logoWidth =
          p.logo && p.badgeSize ? LOGO_H * (p.badgeSize.width / p.badgeSize.height) : 0;
        const tint = onPaper && p.logoTint?.toUpperCase() === '#FFFFFF' ? p.color : p.logoTint;
        return (
          <Pressable
            key={p.slug}
            onPress={() => onNavigate(`/universe/${p.slug}`)}
            accessibilityRole="link"
            accessibilityLabel={`Browse ${p.name} heroes`}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [
                s.pod,
                onPaper && (s.podPaper as object),
                isDesktop ? s.podFlex : s.podHalfWidth,
                hovered && ((onPaper ? s.podPaperHover : s.podHover) as object),
              ] as object
            }
          >
            {p.logo && p.badgeSize ? (
              <BrandLogoView logo={p.logo} width={logoWidth} height={LOGO_H} tint={tint} />
            ) : (
              <Text style={[s.wordmark, { color: p.color }]} numberOfLines={1}>
                {p.name}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 4,
  },
  rowWrap: { flexWrap: 'wrap' } as object,
  pod: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 18,
    cursor: 'pointer',
    transition: 'background-color 150ms ease, transform 150ms ease, box-shadow 150ms ease',
  } as object,
  podPaper: {
    backgroundColor: '#fffdf9',
    borderColor: 'rgba(41,60,67,0.12)',
    boxShadow: CARD_SHADOW,
  } as object,
  podFlex: { flex: 1 },
  podHalfWidth: { width: '48%' } as object,
  podHover: { backgroundColor: 'rgba(255,255,255,0.09)' } as object,
  podPaperHover: {
    transform: [{ translateY: -3 }],
    boxShadow: ELEVATION.hover,
  } as object,
  wordmark: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    letterSpacing: 0.5,
  },
});
