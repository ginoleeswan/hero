import { View, type ViewStyle } from 'react-native';

interface SquircleMaskProps {
  style?: ViewStyle;
  cornerRadius?: number;
  children: React.ReactNode;
}

export function SquircleMask({ style, cornerRadius = 26, children }: SquircleMaskProps) {
  return (
    <View style={[style, { borderRadius: cornerRadius, overflow: 'hidden' }]}>{children}</View>
  );
}
