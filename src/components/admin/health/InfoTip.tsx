// Small hover tooltip for the (web) command center. A "?" icon that reveals an
// explanation bubble on hover. The bubble is portalled to document.body and
// positioned (fixed) at the icon's measured screen coordinates, so it sits above
// every panel regardless of stacking context / overflow.
import { useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';

const BUBBLE_W = 240;

// Web-only: portal the bubble out to <body> so no panel can paint over it.
// Guarded require keeps react-dom out of the native runtime path.
let portal: ((node: ReactNode, container: Element) => ReactNode) | null = null;
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  portal = require('react-dom').createPortal;
}

export function InfoTip({ text, size = 14 }: { text: string; size?: number }) {
  const ref = useRef<View>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const open = () => {
    const node = ref.current as unknown as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    } | null;
    if (node?.measureInWindow) {
      node.measureInWindow((x, y, w, h) => {
        setPos({ top: y + h + 6, left: Math.max(8, x + w - BUBBLE_W) });
      });
    } else {
      setPos({ top: 0, left: 0 });
    }
  };

  const bubble =
    pos != null ? (
      <View
        style={[styles.bubble, { top: pos.top, left: pos.left }] as object}
        pointerEvents="none"
      >
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    ) : null;

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
      {bubble && portal ? portal(bubble, document.body) : bubble}
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
