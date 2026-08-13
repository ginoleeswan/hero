import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { LOGO_MASK_PATH as LOGO_PATH } from '../../constants/logo';

interface HeroLogoProps {
  iconSize?: number;
  fontSize?: number;
  color?: string;
  iconColor?: string;
  gap?: number;
  iconOnly?: boolean;
}

export function HeroLogo({
  iconSize = 24,
  fontSize = 20,
  color = COLORS.orange,
  iconColor,
  gap = 8,
  iconOnly = false,
}: HeroLogoProps) {
  const resolvedIconColor = iconColor ?? color;

  return (
    <View style={[styles.row, { gap }]}>
      <Svg width={iconSize} height={iconSize} viewBox="0 0 1024 1024">
        <Path fill={resolvedIconColor} d={LOGO_PATH} />
      </Svg>
      {!iconOnly && <Text style={[styles.wordmark, { fontSize, color }]}>mythique</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: 'Righteous_400Regular',
    // Web: ease the colour when the adaptive top chrome flips dark↔light.
    transition: 'color 300ms ease',
  } as object,
});
