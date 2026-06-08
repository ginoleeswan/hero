import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { PublisherCounts } from '../../../lib/db/heroes';

interface StatPodsProps {
  heroCount: number | null;
  publisherCounts: PublisherCounts | null;
  strongestHero: { id: number; name: string; strength: number | null } | null;
  smartestHero: { id: number; name: string; intelligence: number | null } | null;
  fastestHero: { id: number; name: string; speed: number | null } | null;
  onNavigate: (path: string) => void;
}

export function StatPods({
  heroCount,
  publisherCounts,
  strongestHero,
  smartestHero,
  fastestHero,
  onNavigate,
}: StatPodsProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 640;

  const pods = [
    {
      eyebrow: 'Encyclopedia',
      value: heroCount != null ? heroCount.toLocaleString() : '—',
      subline: publisherCounts
        ? `${publisherCounts.marvel.toLocaleString()} Marvel · ${publisherCounts.dc.toLocaleString()} DC`
        : 'Loading…',
      onPress: () => onNavigate('/search'),
    },
    {
      eyebrow: 'Strongest',
      value: strongestHero?.name ?? '—',
      subline: strongestHero?.strength != null ? `Strength: ${strongestHero.strength}` : '',
      onPress: () => strongestHero && onNavigate(`/character/${strongestHero.id}`),
    },
    {
      eyebrow: 'Brightest Mind',
      value: smartestHero?.name ?? '—',
      subline: smartestHero?.intelligence != null ? `Intelligence: ${smartestHero.intelligence}` : '',
      onPress: () => smartestHero && onNavigate(`/character/${smartestHero.id}`),
    },
    {
      eyebrow: 'Fastest',
      value: fastestHero?.name ?? '—',
      subline: fastestHero?.speed != null ? `Speed: ${fastestHero.speed}` : '',
      onPress: () => fastestHero && onNavigate(`/character/${fastestHero.id}`),
    },
  ];

  return (
    <View
      style={[
        s.row,
        !isDesktop && (s.rowWrap as object),
        { paddingHorizontal: width < 640 ? 16 : 32 },
      ] as object}
    >
      {pods.map((pod, i) => (
        <Pressable
          key={i}
          onPress={pod.onPress}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [
              s.pod,
              isDesktop ? s.podFlex : isTablet ? s.podHalfWidth : s.podFullWidth,
              hovered && (s.podHover as object),
            ] as object
          }
        >
          <Text style={s.eyebrow as object}>{pod.eyebrow}</Text>
          <Text style={s.value} numberOfLines={1}>
            {pod.value}
          </Text>
          <Text style={s.subline as object} numberOfLines={1}>
            {pod.subline}
          </Text>
        </Pressable>
      ))}
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
  podFullWidth: { width: '100%' } as object,
  podHover: { backgroundColor: 'rgba(255,255,255,0.09)' } as object,
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.35)',
    marginBottom: 8,
  } as object,
  value: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    marginBottom: 4,
  },
  subline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: 'rgba(245,235,220,0.45)',
  } as object,
});
