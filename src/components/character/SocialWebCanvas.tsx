import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { INK_TEXT } from '../../constants/colors';
import { SocialWebGraph } from './SocialWebGraph';
import type { Neighborhood } from '../../lib/db/heroes/neighborhood';

const GRAPH = 720; // fixed logical canvas the graph lays out within

// Gestured, zoomable, focus-aware viewport around the constellation renderer.
// Pan + pinch (+ wheel on web), zoom buttons, auto-fit. Owns focus state and
// forwards node navigate / recenter to the host screen.
export function SocialWebCanvas({
  neighborhood,
  subjectId,
  accent,
  onNavigate,
  onRecenter,
}: {
  neighborhood: Neighborhood;
  subjectId: string;
  accent: string;
  onNavigate: (id: string) => void;
  onRecenter: (id: string) => void;
}) {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [focusId, setFocusId] = useState<string | null>(null);

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

  // Re-fit when the viewport or the neighbourhood (subject) changes; clear focus.
  useEffect(() => {
    setFocusId(null);
    fit();
  }, [fit, subjectId]);

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
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.canvas, canvasStyle]}>
          <SocialWebGraph
            neighborhood={neighborhood}
            subjectId={subjectId}
            accent={accent}
            size={GRAPH}
            focusId={focusId}
            onNodePress={(id) => setFocusId((cur) => (cur === id ? null : id))}
            onNodeLongPress={(id) => onRecenter(id)}
            onNodeOpen={(id) => onNavigate(id)}
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
