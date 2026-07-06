import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { INK_TEXT } from '../../constants/colors';
import { SocialWebGraph } from './SocialWebGraph';
import { layoutNeighborhood } from '../../lib/graph/forceLayout';
import type { Neighborhood } from '../../lib/db/heroes/neighborhood';

const GRAPH = 720; // fixed logical canvas the graph lays out within

// Gestured, zoomable, focus-aware viewport around the constellation renderer.
// Pan + pinch (+ wheel on web), zoom buttons, auto-fit. Focus state is owned by
// the host screen (so the detail card + search can drive it); the canvas owns
// only the camera transform and forwards node focus / recenter.
export function SocialWebCanvas({
  neighborhood,
  subjectId,
  accent,
  focusId,
  onFocusChange,
  onRecenter,
  sharedIds,
  activeKinds,
  centerOnId,
}: {
  neighborhood: Neighborhood;
  subjectId: string;
  accent: string;
  focusId: string | null;
  onFocusChange: (id: string | null) => void;
  onRecenter: (id: string) => void;
  sharedIds?: Set<string>;
  activeKinds?: { enemy: boolean; ally: boolean; teammate: boolean };
  centerOnId?: string | null;
}) {
  const [vp, setVp] = useState({ w: 0, h: 0 });

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  const fit = useCallback(() => {
    if (vp.w === 0) return;
    const s = Math.min(vp.w / GRAPH, vp.h / GRAPH) * 0.92;
    scale.value = s;
    tx.value = vp.w / 2 - GRAPH / 2;
    ty.value = vp.h / 2 - GRAPH / 2;
  }, [vp.w, vp.h, tx, ty, scale]);

  // Re-fit when the viewport or the neighbourhood (subject) changes. The screen
  // clears focus on recenter, so the canvas doesn't touch focus here.
  useEffect(() => {
    fit();
  }, [fit, subjectId]);

  // Search selected a node → glide the camera so that node sits centred.
  useEffect(() => {
    if (!centerOnId || vp.w === 0) return;
    const pos = layoutNeighborhood(
      neighborhood.nodes.map((n) => ({ id: n.id, isSubject: n.is_subject })),
      neighborhood.edges,
    ).get(centerOnId);
    if (!pos) return;
    const R = GRAPH / 2 - 48; // matches SocialWebGraph R
    const nx = GRAPH / 2 + pos.x * R;
    const ny = GRAPH / 2 + pos.y * R;
    const s = scale.value;
    tx.value = withTiming(vp.w / 2 - nx * s);
    ty.value = withTiming(vp.h / 2 - ny * s);
  }, [centerOnId, vp.w, vp.h, neighborhood, scale, tx, ty]);

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    });
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.min(2.5, Math.max(0.5, startScale.value * e.scale));
    });
  // No canvas-level tap gesture: it would double-fire with the node Pressables
  // (setting then clearing focus). Re-tapping the focused node clears it.
  const gesture = Gesture.Simultaneous(pan, pinch);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const zoomIn = () => {
    scale.value = Math.min(2.5, scale.value + 0.2);
  };
  const zoomOut = () => {
    scale.value = Math.max(0.5, scale.value - 0.2);
  };

  // Web: wheel/trackpad zoom.
  const onWheel =
    Platform.OS === 'web'
      ? (e: { deltaY: number; preventDefault?: () => void }) => {
          e.preventDefault?.();
          const next = scale.value * (e.deltaY > 0 ? 0.92 : 1.08);
          scale.value = Math.min(2.5, Math.max(0.5, next));
        }
      : undefined;

  return (
    <View
      style={styles.viewport}
      onLayout={(e) => setVp({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      // @ts-expect-error onWheel is a web-only DOM prop RNW forwards to the node
      onWheel={onWheel}
    >
      {/* Fixed starfield behind the panning graph — deep space, not moving with pan. */}
      {vp.w > 0 ? (
        <Svg width={vp.w} height={vp.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <Pattern id="stars" x={0} y={0} width={38} height={38} patternUnits="userSpaceOnUse">
              <Circle cx={2} cy={2} r={1} fill="rgba(245,235,220,0.10)" />
              <Circle cx={22} cy={14} r={0.7} fill="rgba(245,235,220,0.07)" />
              <Circle cx={12} cy={28} r={0.9} fill="rgba(245,235,220,0.08)" />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={vp.w} height={vp.h} fill="url(#stars)" />
        </Svg>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.canvas, canvasStyle]}>
          <SocialWebGraph
            neighborhood={neighborhood}
            subjectId={subjectId}
            accent={accent}
            size={GRAPH}
            focusId={focusId}
            sharedIds={sharedIds}
            activeKinds={activeKinds}
            onNodePress={(id) => onFocusChange(focusId === id ? null : id)}
            onNodeLongPress={(id) => onRecenter(id)}
          />
        </Animated.View>
      </GestureDetector>

      <View style={styles.controls}>
        <Pressable style={styles.ctrlBtn} onPress={zoomIn}>
          <Ionicons name="add" size={18} color={INK_TEXT.primary} />
        </Pressable>
        <Pressable style={styles.ctrlBtn} onPress={zoomOut}>
          <Ionicons name="remove" size={18} color={INK_TEXT.primary} />
        </Pressable>
        <Pressable style={styles.ctrlBtn} onPress={fit}>
          <Ionicons name="scan-outline" size={16} color={INK_TEXT.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  canvas: { position: 'absolute', left: 0, top: 0, width: GRAPH, height: GRAPH } as object,
  controls: { position: 'absolute', right: 14, bottom: 14, gap: 8 } as object,
  ctrlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,235,220,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
  },
});
