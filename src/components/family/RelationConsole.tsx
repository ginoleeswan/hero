// src/components/family/RelationConsole.tsx
// The house page's signature control: two seats and the sentence between them.
//
// A character page can only ever show one person's relatives. The thing a house
// can do that nothing else in the app can is answer "how are these two related?"
// — so that question gets a control of its own rather than living as a verb
// scattered across fifty-five roster chips. Seat one is the root of the tree
// below; seat two is whoever you're measuring against.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { HeroAvatar } from '../HeroAvatar';
import type { KinshipDescription } from '../../lib/family/kinshipPath';

export interface ConsoleSeat {
  id: string;
  name: string;
  avatar_url: string | null;
  portrait_url: string | null;
  image_md_url: string | null;
  image_url: string | null;
}

const art = (m: ConsoleSeat) => m.portrait_url ?? m.image_md_url ?? m.image_url;

export function RelationConsole({
  root,
  partner,
  kinship,
  tint,
  onSwap,
  onClear,
}: {
  root: ConsoleSeat | null;
  partner: ConsoleSeat | null;
  kinship: KinshipDescription | null;
  tint: string;
  /** Make the compared member the root of the tree, and vice versa. */
  onSwap: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Trace the line</Text>

      <View style={styles.seats}>
        <Seat member={root} caption="Root of the tree" />

        {partner ? (
          <Pressable
            onPress={onSwap}
            accessibilityRole="button"
            accessibilityLabel="Swap: root the tree on the compared member"
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [styles.swap, hovered && (styles.swapHover as object)] as object
            }
          >
            <Ionicons name="swap-horizontal" size={16} color={COLORS.navy} />
          </Pressable>
        ) : (
          <View style={styles.swapIdle}>
            <Ionicons name="ellipsis-horizontal" size={16} color="#c4b8a3" />
          </View>
        )}

        {partner ? (
          <Seat member={partner} caption="Compared with" accent={tint} onClear={onClear} />
        ) : (
          <View style={styles.emptySeat}>
            <Text style={styles.emptySeatText}>Pick anyone from the house</Text>
          </View>
        )}
      </View>

      <View style={styles.rule} />

      {kinship ? (
        <View style={styles.answer}>
          <Text style={styles.headline}>{kinship.headline}</Text>
          <Text style={styles.chain}>{kinship.chain}</Text>
        </View>
      ) : partner ? (
        <Text style={styles.hint}>
          No line runs between these two in the records we hold.
        </Text>
      ) : (
        <Text style={styles.hint}>
          Choose a second name and Mythique walks the family graph between them — cousins,
          great-uncles, and the long way round included.
        </Text>
      )}
    </View>
  );
}

function Seat({
  member,
  caption,
  accent,
  onClear,
}: {
  member: ConsoleSeat | null;
  caption: string;
  accent?: string;
  onClear?: () => void;
}) {
  if (!member) return <View style={styles.emptySeat} />;
  return (
    <View style={[styles.seat, accent ? { borderColor: accent } : null] as object}>
      <HeroAvatar
        id={member.id}
        name={member.name}
        avatarUrl={member.avatar_url}
        fallbackUrl={art(member)}
        size={40}
        radius={20}
        bare
      />
      <View style={styles.seatMeta}>
        <Text style={styles.seatName} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={styles.seatCaption} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      {onClear ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={`Stop comparing with ${member.name}`}
          hitSlop={8}
          style={styles.clear}
        >
          <Ionicons name="close" size={14} color="#8d8375" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eadfcb',
    padding: 18,
    gap: 14,
  },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#a99b84',
  },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  seat: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fffaf0',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e7dcc9',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  seatMeta: { flexShrink: 1, minWidth: 0 },
  seatName: { fontFamily: 'Flame-Regular', fontSize: 17, lineHeight: 22, color: COLORS.black },
  seatCaption: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#a99b84',
  },
  clear: { marginLeft: 'auto', padding: 2 },
  emptySeat: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 210,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e0d4bd',
    borderStyle: 'dashed',
    paddingHorizontal: 12,
  },
  emptySeatText: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: '#a99b84' },
  swap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e7dcc9',
    backgroundColor: '#fffaf0',
    cursor: 'pointer',
  } as object,
  swapHover: { borderColor: '#cdbfa6', backgroundColor: '#f7eeda' } as object,
  swapIdle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  rule: { height: 1, backgroundColor: '#f0e6d4' },
  answer: { gap: 6 },
  headline: { fontFamily: 'Flame-Regular', fontSize: 26, lineHeight: 33, color: COLORS.black },
  chain: { fontFamily: 'FlameSans-Regular', fontSize: 13.5, lineHeight: 21, color: '#5a6a72' },
  hint: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    lineHeight: 21,
    color: '#8d8375',
    maxWidth: 520,
  },
});
