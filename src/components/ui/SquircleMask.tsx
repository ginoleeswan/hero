import { StyleSheet, type ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { SquircleView } from 'react-native-figma-squircle';

interface SquircleMaskProps {
  style?: ViewStyle;
  cornerRadius?: number;
  children: React.ReactNode;
}

export function SquircleMask({ style, cornerRadius = 26, children }: SquircleMaskProps) {
  return (
    <MaskedView
      style={style}
      maskElement={
        <SquircleView
          style={StyleSheet.absoluteFill}
          squircleParams={{ cornerRadius, cornerSmoothing: 1, fillColor: 'pink' }}
        />
      }
    >
      {children}
    </MaskedView>
  );
}
