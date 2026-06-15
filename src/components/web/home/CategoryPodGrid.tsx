// src/components/web/home/CategoryPodGrid.tsx — the calm "Browse" block for web.
// One responsive grid of category doorways replaces a dozen look-alike carousels.
import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { BROWSE_PODS } from '../../home/CategoryPodGrid';

export function CategoryPodGrid({ onPress }: { onPress: (slug: string) => void }) {
  const { width } = useWindowDimensions();
  const pagePad = width < 640 ? 16 : 32;
  return (
    <View style={[g.grid, { marginHorizontal: pagePad }] as object}>
      {BROWSE_PODS.map((p) => (
        <Pressable
          key={p.slug}
          onPress={() => onPress(p.slug)}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [g.pod, hovered && (g.podHover as object)] as object
          }
        >
          <View style={g.accent as object} />
          <Text style={g.label as object} numberOfLines={1}>
            {p.label}
          </Text>
          <Text style={g.chevron as object}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const g = StyleSheet.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
  } as object,
  pod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 18,
    backgroundColor: '#fffdf8',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
    cursor: 'pointer',
    transition: 'transform 160ms ease, box-shadow 160ms ease',
  } as object,
  podHover: {
    transform: [{ translateY: -2 }],
    boxShadow: '0 10px 28px rgba(58,42,20,0.1)',
  } as object,
  accent: { width: 4, height: 28, borderRadius: 2, backgroundColor: COLORS.orange } as object,
  label: { flex: 1, fontFamily: 'Flame-Regular', fontSize: 19, color: COLORS.navy } as object,
  chevron: { fontFamily: 'Flame-Regular', fontSize: 24, color: 'rgba(41,60,67,0.35)' } as object,
});
