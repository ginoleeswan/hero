import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The window's top safe-area inset — a value that cannot change while the app
 * is running, and is therefore safe to bake into layout geometry.
 *
 * WHY THIS EXISTS
 *
 * The app is portrait-locked (`orientation: 'portrait'` in app.config.ts), so
 * the physical top safe area is fixed for the process's lifetime. Despite that,
 * screens reading `useSafeAreaInsets().top` were observing it CHANGE at
 * runtime — after tab switches, some seconds into a session — and every screen
 * that derives geometry from it moved at once: Explore's spotlight is sized
 * `spotlightHeight(insets.top)`, so it resized and exposed navy above the
 * carousel; Arena pads its stage by `insets.top + 24`; Profile's cover is
 * `140 + insets.top`. One shared input, three simultaneous symptoms.
 *
 * `useSafeAreaInsets()` reads the NEAREST SafeAreaProvider, and there is more
 * than one: expo-router wraps tab screens in their own. A nested provider seeds
 * from its parent's insets and is then corrected by a native measurement of its
 * OWN view — which is a different question ("what is safe within this subview")
 * than the one these screens are asking ("where does the window's unsafe area
 * end"). When those two answers disagree, the layout moves.
 *
 * This hook does not diagnose that disagreement — it removes the dependency on
 * it. `initialWindowMetrics` is a synchronous snapshot of the WINDOW captured
 * natively before the first React render; in a portrait-locked app it is both
 * correct and constant. Screens that are full-bleed and top-anchored should ask
 * for that, not for whatever the nearest provider currently believes.
 *
 * Use `useSafeAreaInsets()` as normal for anything that genuinely is relative
 * to its container, and for `.bottom` (keyboard and tab-bar aware surfaces).
 * This is specifically for "how far down does the window's chrome reach".
 *
 * The live hook is still called — unconditionally, as hooks must be — so the
 * fallback works on any platform where the native snapshot is unavailable.
 */
export function useStableTopInset(): number {
  const live = useSafeAreaInsets();
  return initialWindowMetrics?.insets.top ?? live.top;
}
