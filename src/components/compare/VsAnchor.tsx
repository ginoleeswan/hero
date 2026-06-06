import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { heroImageSource } from '../../constants/heroImages';
import { COLORS } from '../../constants/colors';
import { VsBadge } from './VsBadge';
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
  const filled = !!preview;
  const subjectName = subject?.name ?? name;
  const stage = tone === 'stage';

  return (
    <View style={styles.wrap}>
      {stage && <View style={styles.spotlight as object} />}

      <View style={styles.row}>
        <View style={styles.col}>
          <View
            style={[
              styles.portrait,
              styles.lit,
              morphName ? ({ viewTransitionName: morphName } as object) : null,
            ]}
          >
            {subject ? (
              <Image
                source={heroImageSource(subject.id, subject.image_url, subject.portrait_url)}
                contentFit="cover"
                contentPosition="top center"
                style={StyleSheet.absoluteFill}
                placeholder={COLORS.navy}
                transition={150}
              />
            ) : null}
          </View>
          <Text style={[styles.fighterName, stage && styles.nameStage]} numberOfLines={1}>
            {subjectName}
          </Text>
        </View>

        <View style={styles.vsWrap}>
          <VsBadge size={48} variant={stage ? 'glass' : 'solid'} />
        </View>

        <View style={styles.col}>
          <View
            style={[
              styles.portrait,
              styles.slot,
              stage && styles.slotStage,
              filled && styles.slotFilled,
            ]}
          >
            {preview ? (
              <Image
                source={heroImageSource(preview.id, preview.image_url, preview.portrait_url)}
                contentFit="cover"
                contentPosition="top center"
                style={[StyleSheet.absoluteFill, { transform: [{ scaleX: -1 }] }]}
                placeholder={COLORS.navy}
                transition={120}
              />
            ) : (
              <Text style={[styles.q, stage && styles.qStage]}>?</Text>
            )}
          </View>
          <Text
            style={[
              styles.fighterName,
              stage && styles.nameStage,
              !filled && styles.placeholderName,
              !filled && stage && styles.placeholderStage,
            ]}
            numberOfLines={1}
          >
            {preview?.name ?? 'Your pick'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const W = 128;
const H = 160;
const RADIUS = 28;

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
  col: { alignItems: 'center', gap: 10, width: W },
  vsWrap: { height: H, justifyContent: 'center' },
  portrait: {
    width: W,
    height: H,
    borderRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
  },
  lit: {
    boxShadow: '0 0 0 2px rgba(206,155,51,0.9), 0 0 52px rgba(206,155,51,0.3)',
  } as object,
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(41,60,67,0.24)',
    backgroundColor: 'rgba(41,60,67,0.03)',
    ...Platform.select({ web: { transition: 'border-color 180ms ease' } as object, default: {} }),
  },
  slotStage: {
    borderColor: 'rgba(245,235,220,0.32)',
    backgroundColor: 'rgba(245,235,220,0.04)',
  },
  slotFilled: { borderColor: 'transparent', borderStyle: 'solid', backgroundColor: '#1b2a30' },
  q: { fontFamily: 'Flame-Regular', fontSize: 42, color: 'rgba(41,60,67,0.3)' },
  qStage: { color: 'rgba(245,235,220,0.4)' },
  fighterName: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    color: COLORS.navy,
    textAlign: 'center',
  },
  nameStage: {
    color: COLORS.beige,
    ...Platform.select({
      web: { textShadow: '0 1px 10px rgba(0,0,0,0.5)' } as object,
      default: {},
    }),
  },
  placeholderName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.4)',
  },
  placeholderStage: { color: 'rgba(245,235,220,0.45)' },
});
