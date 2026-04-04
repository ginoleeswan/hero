import React from 'react';
import { View } from 'react-native';
export function AnimatedCircularProgress({ children }) {
  return <View>{children ? children(0) : null}</View>;
}
