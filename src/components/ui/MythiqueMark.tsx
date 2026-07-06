// src/components/ui/MythiqueMark.tsx — the Mythique mask emblem as a native
// react-native-svg node, sized by height (it's a wide mark). Used to top the
// wordmark lockup on the shareable posters; web/OG draw the same path from
// src/constants/brandMark via a data URI.
import Svg, { Path } from 'react-native-svg';
import { MARK_PATH, MARK_VIEWBOX, MARK_ASPECT } from '../../constants/brandMark';

export function MythiqueMark({ height, color }: { height: number; color: string }) {
  return (
    <Svg width={height * MARK_ASPECT} height={height} viewBox={MARK_VIEWBOX}>
      <Path d={MARK_PATH} fill={color} />
    </Svg>
  );
}
