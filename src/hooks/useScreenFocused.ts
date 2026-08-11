// src/hooks/useScreenFocused.ts — is this screen the one being looked at?
//
// The tab bar is `NativeTabs`, which keeps every screen MOUNTED — that is the
// whole point of native tabs, and it is why switching them is instant. It also
// means an endlessly repeating animation on Explore keeps running while you are
// on Search, or Arena, or Profile. Forever. For nobody.
//
// That is the same class of waste as a list paginating rows nothing will draw:
// not a crash, not visible, just work the device is doing for no one. Anything
// here that loops with `withRepeat(..., -1)` should hold still while the screen
// is not on top.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export function useScreenFocused(): boolean {
  // Starts true: a screen mounts because it is being shown, and starting false
  // would make every loop begin with a stutter as focus resolves.
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  return focused;
}
