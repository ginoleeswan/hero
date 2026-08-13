import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { COLORS } from '../../constants/colors';

interface VsBadgeProps {
  size?: number;
  /**
   * `glass` — dark translucent disc for the seam between portraits (native).
   * `solid` — opaque navy medallion that reads cleanly on a light surface (web scorecard).
   */
  variant?: 'glass' | 'solid';
}

/**
 * Restrained typographic VS marker — the display "VS" on a small disc.
 * Sits between the two combatants; quiet and editorial, not a sticker.
 */
export function VsBadge({ size = 46, variant = 'glass' }: VsBadgeProps) {
  const solid = variant === 'solid';
  return (
    <View
      style={[
        styles.ring,
        solid && (styles.ringSolid as object),
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
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
  ringSolid: {
    backgroundColor: COLORS.navy,
    borderColor: 'rgba(245,235,220,0.22)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
  } as object,
  vs: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    color: '#f5ebdc',
    letterSpacing: 2,
    marginTop: 1,
  },
});
