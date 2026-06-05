import { View, Text, StyleSheet } from 'react-native';

interface VsBadgeProps {
  size?: number;
}

/**
 * Restrained typographic VS marker.
 * A small dark, semi-transparent disc with a hairline edge and the display "VS".
 * Sits on the seam between the two portraits — quiet, editorial, not a sticker.
 */
export function VsBadge({ size = 46 }: VsBadgeProps) {
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.vs}>VS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,14,10,0.5)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(245,235,220,0.45)',
  },
  vs: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    color: '#f5ebdc',
    letterSpacing: 2,
    marginTop: 1,
  },
});
