import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';

type Act = 'squad' | 'challenger';

interface Props {
  act: Act;
  /** Side A has ≥1 — Act 2 is reachable. */
  hasSquad: boolean;
  /** Both sides ≥1 — the Fight goal is lit. */
  ready: boolean;
  /** Jump to a step (only backwards / to a reachable one). */
  onStep: (act: Act) => void;
}

/** The duel's progress header: ① Your Squad → ② Challenger → ③ Fight. The current
 *  act is lit; a completed act is tappable to go back. */
export function DuelStepper({ act, hasSquad, ready, onStep }: Props) {
  return (
    <View style={s.row}>
      <Step
        n="1"
        label="Your Squad"
        state={act === 'squad' ? 'current' : 'done'}
        onPress={() => onStep('squad')}
      />
      <Ionicons name="chevron-forward" size={14} color="rgba(245,235,220,0.3)" />
      <Step
        n="2"
        label="Challenger"
        state={act === 'challenger' ? 'current' : hasSquad ? 'todo' : 'locked'}
        onPress={hasSquad ? () => onStep('challenger') : undefined}
      />
      <Ionicons name="chevron-forward" size={14} color="rgba(245,235,220,0.3)" />
      <Step n="3" label="Fight" state={ready ? 'todo' : 'locked'} />
    </View>
  );
}

function Step({
  n,
  label,
  state,
  onPress,
}: {
  n: string;
  label: string;
  state: 'current' | 'done' | 'todo' | 'locked';
  onPress?: () => void;
}) {
  const current = state === 'current';
  const done = state === 'done';
  const muted = state === 'locked';
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={s.step} hitSlop={6}>
      <View style={[s.pip, current ? s.pipCurrent : done ? s.pipDone : s.pipTodo]}>
        {done ? (
          <Ionicons name="checkmark" size={12} color="#1a130a" />
        ) : (
          <Text style={[s.pipNum, current ? s.pipNumOn : null]}>{n}</Text>
        )}
      </View>
      <Text style={[s.label, current ? s.labelOn : muted ? s.labelMuted : null]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  pipCurrent: { backgroundColor: COLORS.goldAccent, borderColor: COLORS.goldAccent },
  pipDone: { backgroundColor: COLORS.goldAccent, borderColor: COLORS.goldAccent },
  pipTodo: { backgroundColor: 'transparent', borderColor: 'rgba(245,235,220,0.4)' },
  pipNum: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.6)' },
  pipNumOn: { color: '#1a130a' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    letterSpacing: 0.3,
    color: 'rgba(245,235,220,0.7)',
  },
  labelOn: { color: COLORS.beige },
  labelMuted: { color: INK_TEXT.faint },
});
