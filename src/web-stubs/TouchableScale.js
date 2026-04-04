import React from 'react';
import { Pressable } from 'react-native';
export default function TouchableScale({ children, onPress, style }) {
  return <Pressable onPress={onPress} style={style}>{children}</Pressable>;
}
