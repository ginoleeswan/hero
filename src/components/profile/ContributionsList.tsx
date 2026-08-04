import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, PAPER_TEXT, ORANGE_INK } from '../../constants/colors';
import {
  describeContribution,
  parsePgArrayLiteral,
  type MyContribution,
} from '../../lib/db/contributions';

/** Status → dot colour. A single small dot carries the state a full pill used to. */
const STATUS_DOT: Record<MyContribution['status'], string> = {
  approved: COLORS.green,
  pending: COLORS.orange,
  rejected: COLORS.grey,
  superseded: COLORS.grey,
};

const STATUS_WORD: Record<MyContribution['status'], string> = {
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
  superseded: 'Superseded',
};

const COLLAPSED_COUNT = 5;

/** Sentence-case a bare field label ("publisher" → "Publisher"). */
function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Clean a stored value for display — unwrap pg-array list literals to "a, b". */
function valuePreview(raw: string): string {
  const v = raw.trim();
  if (v.startsWith('{') && v.endsWith('}')) return parsePgArrayLiteral(v).join(', ');
  return v;
}

/**
 * What the contribution changed, favouring the concrete value the user set
 * ("Publisher · The Muppets") over a bare field name repeated down the list.
 * Facts/reports keep their own phrasing.
 */
function rowDetail(c: MyContribution): string {
  const label = titleCase(describeContribution(c));
  if (c.kind === 'field' && c.new_value) return `${label} · ${valuePreview(c.new_value)}`;
  return label;
}

/**
 * A compact, scannable list of the user's contributions. Replaces the old wall
 * of full-width cards (one giant card per edit, all reading "publisher /
 * APPROVED") that buried everything below it. Rows are one line each — status
 * dot, hero, what changed — and collapse to the first few with a show-all
 * toggle, so a prolific contributor doesn't push their collection off-screen.
 */
/** "12 approved · 3 pending" — only the non-zero states, most-settled first. */
function summarize(contributions: MyContribution[]): string {
  const order: MyContribution['status'][] = ['approved', 'pending', 'rejected', 'superseded'];
  return order
    .map((status) => ({ status, n: contributions.filter((c) => c.status === status).length }))
    .filter((s) => s.n > 0)
    .map((s) => `${s.n} ${STATUS_WORD[s.status].toLowerCase()}`)
    .join(' · ');
}

export function ContributionsList({ contributions }: { contributions: MyContribution[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? contributions : contributions.slice(0, COLLAPSED_COUNT);

  return (
    <View>
      <Text style={styles.summary}>{summarize(contributions)}</Text>
      {shown.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => router.push(`/character/${c.hero_id}`)}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.row,
            hovered && styles.rowHover,
          ]}
        >
          <View style={[styles.dot, { backgroundColor: STATUS_DOT[c.status] }]} />
          <Text style={styles.hero} numberOfLines={1}>
            {c.hero_name}
          </Text>
          <Text style={styles.what} numberOfLines={1}>
            {rowDetail(c)}
          </Text>
          <Text style={[styles.status, { color: STATUS_DOT[c.status] }]}>
            {STATUS_WORD[c.status]}
          </Text>
        </Pressable>
      ))}

      {contributions.length > COLLAPSED_COUNT && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.toggle,
            hovered && styles.toggleHover,
          ]}
        >
          <Text style={styles.toggleText}>
            {expanded ? 'Show less' : `Show all ${contributions.length}`}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={COLORS.orange}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.08)',
    cursor: 'pointer',
  } as object,
  rowHover: { backgroundColor: 'rgba(231,115,51,0.06)' } as object,
  dot: { width: 8, height: 8, borderRadius: 4 },
  hero: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.navy,
    flexShrink: 1,
  },
  what: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: PAPER_TEXT.faint,
    flex: 1,
  },
  status: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 12,
    cursor: 'pointer',
  } as object,
  toggleHover: { opacity: 0.7 } as object,
  toggleText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: ORANGE_INK,
  },
});
