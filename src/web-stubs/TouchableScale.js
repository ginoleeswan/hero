import React from 'react';
import { Pressable } from 'react-native';
export default function TouchableScale({
  children,
  onPress,
  style,
  activeScale: _a,
  tension: _t,
  friction: _f,
  delayPressIn: _d,
  ...rest
}) {
  return (
    <Pressable onPress={onPress} style={style} {...rest}>
      {children}
    </Pressable>
  );
}
