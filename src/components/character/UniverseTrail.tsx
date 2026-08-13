import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { INK_TEXT } from '../../constants/colors';

export interface TrailStop {
  id: string;
  name: string;
}

/**
 * The path you took to get here.
 *
 * Travelling between universes is the whole point of the scene, and without a
 * record of it every hop is a teleport — you arrive somewhere with no sense of
 * having come from anywhere, and no way back short of leaving the screen. The
 * crumbs make the same journey read as exploration, and each one is a way home.
 *
 * Deliberately quiet: it sits under the title in muted text at the weight of a
 * caption, because it's orientation, not a control anyone came here to use.
 */
export function UniverseTrail({
  trail,
  current,
  onJump,
  max = 3,
}: {
  trail: TrailStop[];
  current: string;
  onJump: (index: number) => void;
  /** Older hops collapse into a count so a long crawl can't wrap the header. */
  max?: number;
}) {
  if (trail.length === 0) return null;
  const hidden = Math.max(0, trail.length - max);
  const shown = trail.slice(hidden);

  return (
    <View style={styles.row}>
      {hidden > 0 ? <Text style={styles.faint}>+{hidden}</Text> : null}
      {shown.map((stop, i) => (
        <View key={`${stop.id}-${i}`} style={styles.item}>
          <Pressable onPress={() => onJump(hidden + i)} hitSlop={6}>
            <Text style={styles.crumb} numberOfLines={1}>
              {stop.name}
            </Text>
          </Pressable>
          <Text style={styles.sep}>›</Text>
        </View>
      ))}
      <Text style={styles.current} numberOfLines={1}>
        {current}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crumb: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: INK_TEXT.muted,
    textDecorationLine: 'underline',
  },
  sep: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.faint },
  current: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.primary },
  faint: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.faint },
});
