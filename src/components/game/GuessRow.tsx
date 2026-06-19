// One guessed hero rendered as a comparison row: a thumbnail + name, then a
// chip per clue category coloured by match (green = hit, amber = close,
// muted = miss) with ↑/↓ hints for the numeric ones. Shared by native + web.
import { View, Text, StyleSheet } from 'react-native';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { GuessClue, Match, Direction } from '../../lib/game/guessCompare';

const TONE: Record<Match, { bg: string; fg: string }> = {
  hit: { bg: 'rgba(99,169,54,0.18)', fg: '#3f7d1f' },
  close: { bg: 'rgba(249,178,34,0.22)', fg: '#946200' },
  miss: { bg: 'rgba(41,60,67,0.07)', fg: COLORS.grey },
};

const arrow = (d: Direction | null) => (d === 'up' ? ' ↑' : d === 'down' ? ' ↓' : '');
const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');
const alignLabel = (a: string | null) =>
  a === 'good' ? 'Hero' : a === 'bad' ? 'Villain' : a === 'neutral' ? 'Neutral' : '—';

function Chip({ label, value, match }: { label: string; value: string; match: Match }) {
  const tone = TONE[match];
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, { color: tone.fg }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function GuessRow({ clue }: { clue: GuessClue }) {
  return (
    <View style={[styles.row, clue.correct && styles.rowCorrect]}>
      <View style={styles.head}>
        <View style={styles.thumb}>
          <HeroImage
            id={clue.id}
            name={clue.name}
            imageUrl={clue.imageUrl}
            portraitUrl={clue.portraitUrl}
            grid
            contentFit="cover"
            contentPosition="top"
            style={StyleSheet.absoluteFill}
            recyclingKey={clue.id}
          />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {clue.name}
        </Text>
        {clue.correct ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <View style={styles.chips}>
        <Chip label="Publisher" match={clue.publisher.match} value={clue.publisher.value ?? '—'} />
        <Chip label="Align" match={clue.alignment.match} value={alignLabel(clue.alignment.value)} />
        <Chip label="Origin" match={clue.origin.match} value={cap(clue.origin.value)} />
        <Chip label="Sex" match={clue.gender.match} value={cap(clue.gender.value)} />
        <Chip
          label="Debut"
          match={clue.firstYear.match}
          value={(clue.firstYear.value?.toString() ?? '—') + arrow(clue.firstYear.direction)}
        />
        <Chip
          label="Power"
          match={clue.powerTotal.match}
          value={(clue.powerTotal.value?.toString() ?? '—') + arrow(clue.powerTotal.direction)}
        />
        <Chip label="Powers" match={clue.powers.match} value={`${clue.powers.shared} shared`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
    padding: 12,
    gap: 10,
  },
  rowCorrect: { borderColor: COLORS.green, borderWidth: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: {
    width: 34,
    height: 34,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
  },
  name: { flex: 1, fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.navy },
  tick: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.green },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    alignItems: 'center',
    minWidth: 58,
    maxWidth: 130,
  },
  chipLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 1,
  },
  chipValue: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
});
