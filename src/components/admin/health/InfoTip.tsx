// Small hover tooltip for the (web) command center. A "?" icon that reveals an
// explanation bubble on hover. The bubble is rendered with fixed positioning at
// the icon's measured screen position so it escapes every parent's stacking
// context / overflow and never hides behind sibling panels.
import { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';

const BUBBLE_W = 240;

export function InfoTip({ text, size = 14 }: { text: string; size?: number }) {
  const ref = useRef<View>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const open = () => {
    const node = ref.current as unknown as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    } | null;
    if (node?.measureInWindow) {
      node.measureInWindow((x, y, w, h) => {
        // Right-align the bubble to the icon, clamp to the left viewport edge.
        setPos({ top: y + h + 6, left: Math.max(8, x + w - BUBBLE_W) });
      });
    } else {
      setPos({ top: 0, left: 0 });
    }
  };

  return (
    <>
      <Pressable
        ref={ref}
        onHoverIn={open}
        onHoverOut={() => setPos(null)}
        hitSlop={6}
        accessibilityLabel={text}
        style={styles.trigger}
      >
        <Ionicons name="help-circle-outline" size={size} color={COLORS.grey} />
      </Pressable>
      {pos ? (
        <View style={[styles.bubble, { top: pos.top, left: pos.left }] as object} pointerEvents="none">
          <Text style={styles.bubbleText}>{text}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { cursor: 'pointer' } as object,
  bubble: {
    position: 'fixed',
    width: BUBBLE_W,
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    zIndex: 99999,
    boxShadow: '0 8px 24px rgba(11,18,24,0.32)',
  } as object,
  bubbleText: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: '#fff', lineHeight: 18 },
});
