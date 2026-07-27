// src/components/event/EventCurve.tsx
// The detection curve — the page's signature element, drawn as atmosphere.
//
// This app does not read a schedule; there is no usable public calendar for fan
// conventions. It infers the window from attention on the event's own Wikipedia
// article. So the honest hero for an event page is not a poster — it's the
// evidence.
//
// Rendered full-bleed behind the masthead rather than boxed as a chart: at a
// desktop width a fourteen-point series inside a column is a hairline with a
// bump, and the breakout stops reading as a breakout. As a wide, low band under
// the title it becomes the page's texture, and the shaded window is legible at a
// glance without anyone having to study axes.
//
// Deliberately not interactive, and deliberately unlabelled here — the numbers
// live in the stat row above, where they have typographic weight.
import Svg, { Path, Rect, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS } from '../../constants/colors';

export interface EventCurveProps {
  series: { date: string; views: number }[];
  from: string | null;
  to: string | null;
  accent: string;
  width: number;
  height?: number;
}

export function EventCurve({ series, from, to, accent, width, height = 180 }: EventCurveProps) {
  // Two points can't show a breakout; below that the figure would imply
  // precision the data doesn't have.
  if (series.length < 3 || width <= 0) return null;

  const views = series.map((d) => d.views);
  const peak = Math.max(...views);
  if (peak <= 0) return null;

  const n = series.length;
  const x = (i: number) => (i / (n - 1)) * width;
  // Headroom so the peak never touches the top edge and reads as clipped.
  const y = (v: number) => height - (v / (peak * 1.06)) * height;

  const line = series
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.views).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;

  const inWindow = (d: string) => (!from ? false : d >= from && d <= (to ?? from));
  const firstIn = series.findIndex((d) => inWindow(d.date));
  let lastIn = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (inWindow(series[i].date)) {
      lastIn = i;
      break;
    }
  }
  const hasWindow = firstIn >= 0 && lastIn >= firstIn;
  // Half a step either side so the shade brackets the days rather than slicing
  // through the first and last of them.
  const step = width / (n - 1);
  const winX = hasWindow ? Math.max(0, x(firstIn) - step / 2) : 0;
  const winW = hasWindow ? Math.min(width - winX, x(lastIn) - x(firstIn) + step) : 0;

  return (
    <Svg width={width} height={height}>
      <Defs>
        {/* The fill fades out upward so the band dissolves into the stage
            instead of ending on a hard edge behind the type. */}
        <LinearGradient id="evc-fill" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={accent} stopOpacity={0.34} />
          <Stop offset="1" stopColor={accent} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>

      {hasWindow && (
        <>
          {/* The inferred window. The whole point of the figure. */}
          <Rect x={winX} y={0} width={winW} height={height} fill={accent} opacity={0.16} />
          <Line
            x1={winX}
            y1={0}
            x2={winX}
            y2={height}
            stroke={accent}
            strokeWidth={1}
            opacity={0.6}
          />
          <Line
            x1={winX + winW}
            y1={0}
            x2={winX + winW}
            y2={height}
            stroke={accent}
            strokeWidth={1}
            opacity={0.6}
          />
        </>
      )}

      {/* The article's ordinary level, so the breakout has something to break out
          FROM. A recessive hairline, not a labelled axis. */}
      <Line
        x1={0}
        y1={y(median(views))}
        x2={width}
        y2={y(median(views))}
        stroke={COLORS.beige}
        strokeWidth={1}
        strokeDasharray="2 5"
        opacity={0.18}
      />

      <Path d={area} fill="url(#evc-fill)" />
      <Path d={line} stroke={accent} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
