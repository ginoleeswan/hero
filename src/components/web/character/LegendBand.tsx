import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { DidYouKnowDeck } from '../../character/DidYouKnowDeck';
import { PortrayedBySection } from '../../PortrayedBySection';
import type { HeroPortrayals } from '../../../lib/db/people';
import type { FirstIssue } from '../../../types';

// One editorial band for the character's story-through-time: the debut cover
// anchors the left, a timeline spine threads Did You Know moments and the
// actors who carried the role. Crown-washed card — same grammar as the
// Power Profile band, so the two accent moments bookend the page.
export function LegendBand({
  accent,
  accentWash,
  firstIssue,
  facts,
  portrayals,
  onPressDebut,
}: {
  accent: string;
  accentWash: string;
  firstIssue: FirstIssue | null;
  facts: string[];
  portrayals: HeroPortrayals | null;
  onPressDebut: () => void;
}) {
  const hasPortrayals =
    !!portrayals && (portrayals.performers.length > 0 || portrayals.voiceActors.length > 0);
  const hasDebut = !!firstIssue?.imageUrl;
  if (!hasDebut && facts.length === 0 && !hasPortrayals) return null;
  const year = firstIssue?.coverDate ? firstIssue.coverDate.slice(0, 4) : null;
  return (
    <View
      style={
        [
          styles.band,
          {
            backgroundImage: `linear-gradient(180deg, ${accentWash} 0%, rgba(255,255,255,0) 65%)`,
            borderColor: accent + '33',
          },
        ] as object
      }
    >
      <Text style={styles.title}>Legend</Text>
      <View style={[styles.titleRule, { backgroundColor: accent + '22' }] as object} />

      <View style={styles.columns}>
        {hasDebut ? (
          <Pressable
            onPress={onPressDebut}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [styles.debut, hovered && styles.debutHover] as object
            }
          >
            <View style={styles.debutCover}>
              <img
                src={firstIssue!.imageUrl!}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </View>
            {year ? (
              <Text style={[styles.debutYear, { color: accent }] as object}>{year}</Text>
            ) : null}
            <Text style={styles.debutLabel}>First appearance</Text>
            {firstIssue!.name ? (
              <Text style={styles.debutName} numberOfLines={2}>
                {firstIssue!.name.split(';')[0].trim()}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        <View style={styles.flow}>
          {/* Timeline spine — a hairline the moments hang from */}
          <View style={[styles.spine, { backgroundColor: accent + '2b' }] as object} />
          {facts.length > 0 ? (
            <View style={styles.moment}>
              <View style={[styles.momentDot, { backgroundColor: accent }] as object} />
              <Text style={styles.momentLabel}>Did you know</Text>
              <View style={styles.deckClip}>
                <DidYouKnowDeck facts={facts} contentInset={0} />
              </View>
            </View>
          ) : null}
          {hasPortrayals ? (
            <View style={styles.moment}>
              <View style={[styles.momentDot, { backgroundColor: accent }] as object} />
              <Text style={styles.momentLabel}>Portrayed by</Text>
              <PortrayedBySection portrayals={portrayals!} contentInset={0} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    boxShadow: '0 6px 22px rgba(41,60,67,0.06)',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  titleRule: { height: 1, marginBottom: 16 },
  columns: { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  debut: { width: 150, gap: 4 },
  debutHover: { opacity: 0.9 } as object,
  debutCover: {
    width: 150,
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy + '10',
  } as object,
  // Non-clamped Flame display — no descender clipping risk.
  debutYear: { fontFamily: 'Flame-Regular', fontSize: 26, lineHeight: 30, marginTop: 8 },
  debutLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.55)',
  },
  debutName: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.navy, lineHeight: 18 },
  flow: { flex: 1, minWidth: 260, gap: 22, position: 'relative', paddingLeft: 18 } as object,
  spine: { position: 'absolute', left: 3, top: 6, bottom: 6, width: 1 } as object,
  moment: { gap: 8 },
  momentDot: {
    position: 'absolute',
    left: -18,
    top: 3,
    width: 7,
    height: 7,
    borderRadius: 4,
  } as object,
  momentLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.55)',
  },
  // The deck sizes cards from window width; clip so it can't overflow the band.
  deckClip: { overflow: 'hidden', borderRadius: 12 } as object,
});
