// Small hover tooltip for the (web) command center. A "?" icon that reveals an
// explanation bubble on hover — so every action/control can say what it does.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';

export function InfoTip({ text, size = 14 }: { text: string; size?: number }) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable
        onHoverIn={() => setShow(true)}
        onHoverOut={() => setShow(false)}
        hitSlop={6}
        accessibilityLabel={text}
        style={styles.trigger}
      >
        <Ionicons name="help-circle-outline" size={size} color={COLORS.grey} />
      </Pressable>
      {show ? (
        <View style={styles.bubble} pointerEvents="none">
          <Text style={styles.bubbleText}>{text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' } as object,
  trigger: { cursor: 'pointer' } as object,
  bubble: {
    position: 'absolute',
    top: 22,
    right: 0,
    width: 230,
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    zIndex: 100,
    boxShadow: '0 8px 24px rgba(11,18,24,0.28)',
  } as object,
  bubbleText: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: '#fff', lineHeight: 18 },
});
