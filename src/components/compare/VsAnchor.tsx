import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { VsBadge } from './VsBadge';
import { FighterAnchor, ANCHOR_H, ANCHOR_W } from './FighterAnchor';
import type { PickSubject } from '../../hooks/usePickOpponents';

export interface AnchorPreview {
  id: string;
  name: string;
  image_url?: string | null;
  portrait_url?: string | null;
}

/**
 * The matchup anchor — the locked-in fighter glows on the left, a VS badge sits
 * centered, and an empty seat waits on the right. Rendered on the navy "stage"
 * (`tone="stage"`) it reads as the arena before the fight; hovering a roster
 * card feeds `preview` so the seat — and its name — fill live before you commit.
 */
export function VsAnchor({
  subject,
  name,
  preview,
  tone = 'stage',
  morphName,
}: {
  subject: PickSubject | null;
  name: string;
  preview?: AnchorPreview | null;
  tone?: 'stage' | 'light';
  /** Web only: view-transition-name so the locked hero morphs into the arena. */
  morphName?: string;
}) {
  const stage = tone === 'stage';
  const { width } = useWindowDimensions();

  // Two 128px anchors either side of a 48px badge with 16px gaps needs 336px,
  // and the spotlight behind them is 520 — both wider than a 320px phone's
  // content area, so the row spilled and the decorative glow made the document
  // scroll sideways. Give them the space that exists instead.
  const GUTTER = 32;
  const BADGE = 48;
  const gap = width < 380 ? 10 : 16;
  const room = Math.floor((width - GUTTER - BADGE - gap * 2) / 2);
  const anchorW = Math.max(92, Math.min(ANCHOR_W, room));
  const spotWidth = Math.min(520, Math.max(240, width));

  return (
    <View style={styles.wrap}>
      {stage && <View style={[styles.spotlight, { width: spotWidth }] as object} />}

      <View style={[styles.row, { gap }] as object}>
        <FighterAnchor
          fighter={subject}
          seatLabel={name}
          lit
          tone={tone}
          vtName={morphName}
          w={anchorW}
        />

        <View style={styles.vsWrap}>
          <VsBadge size={BADGE} variant={stage ? 'glass' : 'solid'} />
        </View>

        <FighterAnchor
          fighter={preview ?? null}
          seatLabel="Your pick"
          flip
          tone={tone}
          w={anchorW}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 8 },
  spotlight: {
    position: 'absolute',
    top: -6,
    width: 520,
    height: 240,
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(ellipse at center, rgba(206,155,51,0.22) 0%, rgba(206,155,51,0) 64%)',
      } as object,
      default: {},
    }),
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  vsWrap: { height: ANCHOR_H, justifyContent: 'center' },
});
