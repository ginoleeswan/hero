import { StyleSheet, Text, View } from 'react-native';
import type { HeroTagChip } from '../../lib/db/heroFacts';
import { traitColor, withAlpha } from './traitColors';

interface Props {
  tags: HeroTagChip[];
  /** Dark-stage variant: translucent pills tuned for the ink band. */
  onInk?: boolean;
}

// A slim, colour-coded band of theme pills. Each pill is tinted by its vocab
// category (source/scope/tone/role/archetype) with a leading category dot, so
// the band reads as "this hero's themes" at a glance — sibling to the
// alignment/origin badges in the identity header. `onInk` retunes the pills
// for the dark identity band, where they now live on the character page.
export function TraitBand({ tags, onInk }: Props) {
  if (tags.length === 0) return null;
  return (
    <View style={styles.row}>
      {tags.map((t) => {
        const c = traitColor(t.category);
        return (
          <View
            key={t.slug}
            style={[
              styles.pill,
              onInk
                ? { backgroundColor: withAlpha(c, 0.22), borderColor: withAlpha(c, 0.6) }
                : { backgroundColor: withAlpha(c, 0.1), borderColor: withAlpha(c, 0.35) },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: c }]} />
            <Text style={[styles.label, { color: onInk ? withAlpha(c, 0.95) : c }]}>{t.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 10,
    paddingRight: 13,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
