// The mobile pull-to-refresh indicator: a pill that follows the pull, with a
// ring that DRAWS as you pull toward the trigger, snaps full + brightens when
// armed, then spins while the refresh actually runs (the hook holds it up until
// the data settles). Settles smoothly on release because the transition is off
// only while the finger is down.
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../../../constants/colors';
import { CHROME_TOP } from './CommandShell';

const SIZE = 22;
const STROKE = 2.5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function PullToRefreshIndicator({
  distance,
  progress,
  armed,
  dragging,
  refreshing,
}: {
  distance: number;
  progress: number;
  armed: boolean;
  dragging: boolean;
  refreshing: boolean;
}) {
  // While refreshing the ring is a fixed ¾ arc that spins (indeterminate);
  // while pulling it fills to `progress`.
  const shown = refreshing ? 0.72 : progress;
  const offset = CIRC * (1 - shown);
  const active = armed || refreshing;

  return (
    <View
      style={
        [
          s.wrap,
          {
            opacity: refreshing ? 1 : Math.min(1, distance / 40),
            transform: [
              { translateY: distance * 0.4 },
              { scale: 0.6 + Math.min(1, progress) * 0.4 },
            ],
            // Follow the finger 1:1 while dragging; ease on release + settle.
            transition: dragging
              ? 'none'
              : 'transform 260ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 200ms ease',
          },
        ] as object
      }
      pointerEvents="none"
    >
      <View style={[s.pill, active && (s.pillArmed as object)] as object}>
        <View
          style={
            [
              s.ring,
              // The whole ring spins while refreshing (keyframe in +html.tsx).
              refreshing ? ({ animation: 'ptr-spin 0.8s linear infinite' } as object) : null,
            ] as object
          }
        >
          <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: '-90deg' }] } as object}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={active ? COLORS.orange : 'rgba(245,235,220,0.55)'}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={offset}
            />
          </Svg>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'fixed',
    top: `calc(64px + env(safe-area-inset-top) + 6px)` as unknown as number,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 60,
    willChange: 'transform',
  } as object,
  pill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: CHROME_TOP,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
    transition: 'border-color 180ms ease',
  } as object,
  pillArmed: { borderColor: 'rgba(231,115,51,0.55)' } as object,
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
