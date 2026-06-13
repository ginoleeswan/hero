import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { FEATURED_PUBLISHERS } from '../../../constants/publishers';

// Logo height inside a pod; width follows each mark's aspect ratio.
const LOGO_H = 44;

/**
 * The row beneath the spotlight: one pod per featured publisher, each showing
 * the brand logo (or its name wordmark when we have no logo art) and linking to
 * that publisher's hero list. Mirrors the old StatPods layout — single 4-up row
 * on desktop, 2×2 grid below — so the page rhythm is unchanged.
 */
export function PublisherPods({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  return (
    <View
      style={
        [
          s.row,
          !isDesktop && (s.rowWrap as object),
          { paddingHorizontal: width < 640 ? 16 : 32 },
        ] as object
      }
    >
      {FEATURED_PUBLISHERS.map((p) => {
        const logoWidth =
          p.logo && p.badgeSize ? LOGO_H * (p.badgeSize.width / p.badgeSize.height) : 0;
        return (
          <Pressable
            key={p.slug}
            onPress={() => onNavigate(`/category/${p.slug}`)}
            accessibilityRole="link"
            accessibilityLabel={`Browse ${p.name} heroes`}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [
                s.pod,
                isDesktop ? s.podFlex : s.podHalfWidth,
                hovered && (s.podHover as object),
              ] as object
            }
          >
            {p.logo && p.badgeSize ? (
              <Image
                source={p.logo}
                style={{ width: logoWidth, height: LOGO_H }}
                contentFit="contain"
              />
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
    transition: 'background-color 150ms ease',
  } as object,
  podFlex: { flex: 1 },
  podHalfWidth: { width: '48%' } as object,
  podHover: { backgroundColor: 'rgba(255,255,255,0.09)' } as object,
  wordmark: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    letterSpacing: 0.5,
  },
});
