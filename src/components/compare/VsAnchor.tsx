import { Platform, StyleSheet, View } from 'react-native';
import { VsBadge } from './VsBadge';
import { FighterAnchor, ANCHOR_H } from './FighterAnchor';
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

  return (
    <View style={styles.wrap}>
      {stage && <View style={styles.spotlight as object} />}

      <View style={styles.row}>
        <FighterAnchor fighter={subject} seatLabel={name} lit tone={tone} vtName={morphName} />

        <View style={styles.vsWrap}>
          <VsBadge size={48} variant={stage ? 'glass' : 'solid'} />
        </View>

        <FighterAnchor fighter={preview ?? null} seatLabel="Your pick" flip tone={tone} />
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
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 16 },
  vsWrap: { height: ANCHOR_H, justifyContent: 'center' },
});
