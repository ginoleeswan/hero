import React from 'react';
import { View } from 'react-native';
export default function MaskedView({ children, style }) {
  return <View style={[style, { overflow: 'hidden' }]}>{children}</View>;
}
