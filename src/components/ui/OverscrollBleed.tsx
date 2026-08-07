// src/components/ui/OverscrollBleed.tsx
// Paints the rubber-band gap above a ScrollView's first child.
//
// Any screen that opens on a dark band inside a ScrollView over the beige root
// has the same flaw: pull down at the top and the bounce reveals a beige strip
// above the band — the ScrollView's own canvas showing through. Killing the
// bounce would fix it at the cost of the platform feel, so instead the first
// child gets this absolutely-positioned slab hanging 600px above the content,
// in the band's own colour. The overscroll then shows more of the band, which
// is what the gesture visually promises.
//
// Drop it INSIDE the ScrollView as a sibling rendered before (or inside) the
// top band; it takes no layout space and no touches.
import { View, StyleSheet } from 'react-native';

export function OverscrollBleed({ color }: { color: string }) {
  return <View pointerEvents="none" style={[styles.bleed, { backgroundColor: color }]} />;
}

// 600 comfortably exceeds any physically reachable rubber-band distance.
const styles = StyleSheet.create({
  bleed: { position: 'absolute', top: -600, left: 0, right: 0, height: 600 },
});
