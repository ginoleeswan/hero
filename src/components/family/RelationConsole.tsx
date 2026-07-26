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
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { HeroAvatar } from '../HeroAvatar';
import type { KinshipDescription } from '../../lib/family/kinshipPath';
import { reignLine, lifeLine } from '../../lib/family/lifespan';

export interface ConsoleSeat {
  id: string;
  name: string;
  summary: string | null;
  born: string | null;
  died: string | null;
  reign_start: string | null;
  reign_end: string | null;
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
  onRootPartner,
}: {
  root: ConsoleSeat | null;
  partner: ConsoleSeat | null;
  kinship: KinshipDescription | null;
  tint: string;
  /** Make the compared member the root of the tree, and vice versa. */
  onSwap: () => void;
  onClear: () => void;
  /** Re-centre the chart on the compared member and drop the comparison. */
  onRootPartner: () => void;
}) {
  const router = useRouter();
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
            {/* The instruction lives in the slot it fills, so the idle console is
                one row rather than an empty form with a paragraph under it. */}
            <Text style={styles.emptySeatText}>Pick a second name to trace the line</Text>
          </View>
        )}
      </View>

      {partner ? (
        <>
          <View style={styles.rule} />
          {kinship ? (
            <View style={styles.answer}>
              <Text style={styles.headline}>{kinship.headline}</Text>
              <Text style={styles.chain}>{kinship.chain}</Text>
            </View>
          ) : (
            <Text style={styles.hint}>No line runs between these two in the records we hold.</Text>
          )}

          {/* Who they actually are. Clicking a face in the chart should tell you
              something about the person, not just re-arrange the chart. */}
          {(() => {
            // A reign and a lifespan are different facts, so both can show — but
            // most of the catalogue has neither, and a blank meta line is worse
            // than no line.
            const dates = [reignLine(partner), lifeLine(partner)].filter(Boolean).join(' · ');
            return dates ? <Text style={styles.dates}>{dates}</Text> : null;
          })()}
          {partner.summary ? <Text style={styles.summary}>{partner.summary}</Text> : null}

          {/* Named buttons, not icons: the chart's own click is ambiguous
              between "who is this" and "centre on them", so both get said. */}
          <View style={styles.actions}>
            <ConsoleAction
              label={`Centre the chart on ${partner.name.split(' ')[0]}`}
              onPress={onRootPartner}
            />
            <ConsoleAction
              label="Open profile"
              onPress={() =>
                router.push(`/character/${partner.id}?name=${encodeURIComponent(partner.name)}`)
              }
            />
          </View>
        </>
      ) : null}
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

function ConsoleAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [styles.action, hovered && (styles.actionHover as object)] as object
      }
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
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
  dates: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#a99b84',
  },
  summary: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    lineHeight: 21,
    color: '#5a6a72',
    maxWidth: 620,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  action: {
    borderWidth: 1,
    borderColor: '#e7dcc9',
    backgroundColor: '#fffaf0',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    cursor: 'pointer',
  } as object,
  actionHover: { borderColor: '#cdbfa6', backgroundColor: '#f7eeda' } as object,
  actionText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  hint: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    lineHeight: 21,
    color: '#8d8375',
    maxWidth: 520,
  },
});
