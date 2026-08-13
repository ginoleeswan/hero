import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { useMatchupVote } from '../../hooks/useMatchupVote';
import type { NeighborNode } from '../../lib/db/heroes/neighborhood';

/**
 * "Who wins?" without leaving the graph.
 *
 * The universe was a browser: beautiful, and with nothing to do in it. The
 * app's actual engine is the Arena, and the moment a viewer is most likely to
 * have an opinion is the moment they've just opened two characters side by side
 * and read which one out-powers the other. Asking there — rather than sending
 * them to /compare and hoping they follow — is the difference between a page
 * that is looked at and one that is used.
 *
 * Votes are anonymous-friendly by design: no sign-up wall at the vote moment,
 * the pick persists against a per-device key. A cold-start product cannot
 * afford to gate its one cheap interaction behind an account.
 *
 * Orange and teal, not the character's accent — those two are reserved across
 * the app for competitive meaning, so a split bar always reads the same way
 * wherever it appears.
 */
export function UniverseVote({
  subject,
  node,
  subjectName,
}: {
  subject: NeighborNode;
  node: NeighborNode;
  subjectName: string;
}) {
  const { pickedId, tally, loaded, castVote } = useMatchupVote(subject.id, node.id);

  const total = tally?.total ?? 0;
  const votesA = tally?.votesA ?? 0;
  // Before anyone has voted there is no split to draw; an even bar would imply
  // a dead heat the data never claimed.
  const pctA = total > 0 ? Math.round((votesA / total) * 100) : null;

  if (!loaded) return <View style={styles.reserve} />;

  if (!pickedId) {
    return (
      <View style={styles.block}>
        <Text style={styles.label}>Who wins?</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.choice, { borderColor: COLORS.orange + '99' }] as object}
            onPress={() => castVote('a')}
            accessibilityLabel={`Vote for ${subjectName}`}
          >
            <Text style={[styles.choiceText, { color: COLORS.orange }] as object} numberOfLines={1}>
              {subjectName}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.choice, { borderColor: COLORS.blue + '99' }] as object}
            onPress={() => castVote('b')}
            accessibilityLabel={`Vote for ${node.name}`}
          >
            <Text style={[styles.choiceText, { color: COLORS.blue }] as object} numberOfLines={1}>
              {node.name}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const mine = pickedId === subject.id ? subjectName : node.name;
  return (
    <View style={styles.block}>
      <Text style={styles.label}>
        You picked {mine}
        {total > 0 ? ` · ${total} vote${total === 1 ? '' : 's'}` : ''}
      </Text>
      {pctA === null ? (
        <Text style={styles.first}>First vote in — the crowd hasn&#8217;t weighed in yet.</Text>
      ) : (
        <>
          <View style={styles.bar}>
            <View
              style={[styles.fill, { width: `${pctA}%`, backgroundColor: COLORS.orange }] as object}
            />
            <View
              style={
                [styles.fill, { width: `${100 - pctA}%`, backgroundColor: COLORS.blue }] as object
              }
            />
          </View>
          <View style={styles.row}>
            <Text style={[styles.side, { color: COLORS.orange }] as object} numberOfLines={1}>
              {pctA}% {subjectName}
            </Text>
            <Text
              style={[styles.side, styles.sideRight, { color: COLORS.blue }] as object}
              numberOfLines={1}
            >
              {node.name} {100 - pctA}%
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Holds the card's height steady while the tally resolves, so the buttons
  // below don't jump under a cursor that's already moving towards them.
  reserve: { height: 58 },
  block: { gap: 6, marginTop: 4 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
  row: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  choiceText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8 },
  side: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 11 },
  sideRight: { textAlign: 'right' },
  first: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: INK_TEXT.muted },
});
