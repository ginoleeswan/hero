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
 * The matchup anchor for the opponent picker: the locked-in fighter glows on the
 * left, a VS badge sits centered between, and an empty slot waits on the right.
 * On web, hovering a roster card feeds `preview` here so the slot — and its name
 * label — fill live, previewing the matchup before you commit. This mirrors the
 * destination arena, so the picker reads as "complete the fight".
 */
export function VsAnchor({
  subject,
  name,
  preview,
}: {
  subject: PickSubject | null;
  name: string;
  preview?: AnchorPreview | null;
}) {
  const filled = !!preview;
  const subjectName = subject?.name ?? name;

  return (
    <View style={styles.wrap}>
      <View style={styles.spotlight as object} />

      <View style={styles.row}>
        <View style={styles.col}>
          <View style={[styles.portrait, styles.lit]}>
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
          <Text style={styles.fighterName} numberOfLines={1}>
            {subjectName}
          </Text>
        </View>

        <View style={styles.vsWrap}>
          <VsBadge size={48} variant="solid" />
        </View>

        <View style={styles.col}>
          <View style={[styles.portrait, styles.slot, filled && styles.slotFilled]}>
            {preview ? (
              <Image
                source={heroImageSource(preview.id, preview.image_url, preview.portrait_url)}
                contentFit="cover"
                contentPosition="top center"
                style={StyleSheet.absoluteFill}
                placeholder={COLORS.navy}
                transition={120}
              />
            ) : (
              <Text style={styles.q}>?</Text>
            )}
          </View>
          <Text style={[styles.fighterName, !filled && styles.placeholderName]} numberOfLines={1}>
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
    top: 0,
    width: 480,
    height: 230,
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(ellipse at center, rgba(206,155,51,0.18) 0%, rgba(206,155,51,0) 62%)',
      } as object,
      default: {},
    }),
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 16 },
  col: { alignItems: 'center', gap: 10, width: W },
  // Same height as the portraits so the badge lands on their vertical centre.
  vsWrap: { height: H, justifyContent: 'center' },
  portrait: {
    width: W,
    height: H,
    borderRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  lit: {
    boxShadow: '0 0 0 2px rgba(206,155,51,0.85), 0 0 48px rgba(206,155,51,0.26)',
  } as object,
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(41,60,67,0.24)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(41,60,67,0.03)',
    ...Platform.select({ web: { transition: 'border-color 180ms ease' } as object, default: {} }),
  },
  slotFilled: { borderColor: 'transparent', borderStyle: 'solid', backgroundColor: COLORS.navy },
  q: { fontFamily: 'Flame-Regular', fontSize: 42, color: 'rgba(41,60,67,0.3)' },
  fighterName: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    color: COLORS.navy,
    textAlign: 'center',
  },
  placeholderName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.4)',
  },
});
