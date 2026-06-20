import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { LOGO_MASK_PATH as LOGO_PATH } from '../../constants/logo';

// Reanimated's useAnimatedProps doesn't drive SVG attributes on web, so the
// react-native-svg loader sits frozen on its first (hidden) frame. On web we
// render a plain DOM <svg> and animate it with CSS keyframes — the same draw-in
// (stroke dashes in over the first 60% of the cycle, navy fill fades in over the
// last 40%) the reanimated version performs on native.
const STYLE_ID = 'logo-loader-keyframes';
const KEYFRAMES = `
@keyframes logoLoaderDraw {
  0% { stroke-dashoffset: 100; }
  60%, 100% { stroke-dashoffset: 0; }
}
@keyframes logoLoaderFill {
  0%, 60% { fill-opacity: 0; }
  100% { fill-opacity: 1; }
}
.logo-loader-path {
  stroke-dasharray: 100;
  fill-opacity: 0;
  animation:
    logoLoaderDraw 2s ease-in-out infinite,
    logoLoaderFill 2s ease-in-out infinite;
}
`;

export function LogoLoader() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
  }, []);

  return (
    <View style={styles.container}>
      <svg width={120} height={120} viewBox="0 0 1024 1024">
        <path
          className="logo-loader-path"
          pathLength={100}
          d={LOGO_PATH}
          stroke={COLORS.beige}
          strokeWidth={12}
          fill={COLORS.beige}
        />
      </svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // The document default background is deep-navy (see app/+html.tsx), so the
  // status-bar and toolbar safe areas behind this box are already ink — the
  // loader only needs to fill the app box.
  container: {
    flex: 1,
    backgroundColor: COLORS.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
