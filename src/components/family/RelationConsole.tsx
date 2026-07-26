// src/components/family/RelationConsole.tsx
// The house page's signature control: two seats and the sentence between them.
//
// A character page can only ever show one person's relatives. The thing a house
// can do that nothing else in the app can is answer "how are these two related?"
// — so that question gets a control of its own rather than living as a verb
// scattered across fifty-five roster chips. Seat one is the root of the tree
// below; seat two is whoever you're measuring against.
import { Fragment } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { HeroAvatar } from '../HeroAvatar';
import type { KinshipDescription } from '../../lib/family/kinshipPath';
import { reignLine, lifeLine } from '../../lib/family/lifespan';
import { mixHex } from './HouseCrest';

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
          {kinship && root ? (
            <Verdict kinship={kinship} root={root} partner={partner} tint={tint} />
          ) : (
            <Text style={styles.hint}>No line runs between these two in the records we hold.</Text>
          )}

          {/* Who they actually are. Clicking a face in the chart should tell you
              something about the person, not just re-arrange the chart. */}
          <Dossier member={partner} />

          {/* Named buttons, not icons: the chart's own click is ambiguous
              between "who is this" and "centre on them", so both get said. The
              filled one is the one that changes this page. */}
          <View style={styles.actions}>
            <ConsoleAction
              icon="locate-outline"
              label={`Centre the chart on ${firstName(partner.name)}`}
              onPress={onRootPartner}
              primary
            />
            <ConsoleAction
              icon="arrow-forward"
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

const firstName = (name: string) => name.split(' ')[0];

/**
 * Which way through the generations a hop moves. The relation *word* can't say
 * this — "10× great-grandfather" and "10× great-grandson" look alike at a
 * glance — so the arrow carries it, and a route that climbs to a shared
 * ancestor and comes back down reads as ↑↓ without anyone parsing the labels.
 */
const HOP_ARROW: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  parent: 'arrow-up',
  grandparent: 'arrow-up',
  ancestor: 'arrow-up',
  aunt_uncle: 'arrow-top-right',
  child: 'arrow-down',
  grandchild: 'arrow-down',
  descendant: 'arrow-down',
  niece_nephew: 'arrow-bottom-right',
};
/** Anything level with you — sibling, spouse, cousin, in-law. */
const hopArrow = (relation: string | null): keyof typeof MaterialCommunityIcons.glyphMap =>
  (relation && HOP_ARROW[relation]) || 'arrow-right';

/**
 * The finding: what the two people are to each other, and the route that proves
 * it.
 *
 * The relation leads, at display size, because that is the answer — the two
 * names sit in the seats directly above, so a headline that repeated them both
 * spent its largest type restating what was already on screen. The step count
 * moves out of the sentence and onto the route, which is the thing it measures.
 */
function Verdict({
  kinship,
  root,
  partner,
  tint,
}: {
  kinship: KinshipDescription;
  root: ConsoleSeat;
  partner: ConsoleSeat;
  tint: string;
}) {
  const lead = kinship.relation
    ? `${firstName(partner.name)} is ${firstName(root.name)}'s`
    : `${firstName(partner.name)} and ${firstName(root.name)} are`;
  // Only the first letter — CSS `capitalize` would make "10× Great-Grandson".
  const relation = kinship.relation ?? 'distant kin';
  const verdict = relation.charAt(0).toUpperCase() + relation.slice(1);
  const last = kinship.route.length - 1;

  return (
    <View style={styles.answer}>
      <Text style={styles.lead}>{lead}</Text>
      {/* Not clamped, so no line-height floor is needed to keep descenders. */}
      <Text style={styles.verdict}>{verdict}</Text>

      {kinship.route.length > 1 ? (
        <View style={styles.routeBlock}>
          <View style={styles.routeHead}>
            <Text style={styles.routeLabel}>The line</Text>
            <View style={styles.routeRule} />
            <Text style={styles.routeCount}>
              {kinship.steps} {kinship.steps === 1 ? 'step' : 'steps'}
            </Text>
          </View>

          {/* Grouped for assistive tech: the chips are a typeset sentence, and
              `chain` is that same sentence generated from the same array. */}
          <View style={styles.route} accessible accessibilityLabel={kinship.chain}>
            {kinship.route.map((stop, i) => (
              <Fragment key={`${stop.id}-${i}`}>
                {stop.role ? (
                  <View style={styles.link}>
                    <View style={styles.linkRule} />
                    <MaterialCommunityIcons
                      name={hopArrow(stop.relation)}
                      size={13}
                      color="#b3a48b"
                    />
                    <Text style={styles.linkRole}>{stop.role}</Text>
                    <View style={styles.linkRule} />
                  </View>
                ) : null}
                <View
                  style={
                    [
                      styles.stop,
                      i === last && {
                        borderColor: tint,
                        backgroundColor: mixHex(tint, '#ffffff', 0.93),
                      },
                    ] as object
                  }
                >
                  <Text style={styles.stopName}>{stop.name}</Text>
                </View>
              </Fragment>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The compared member in their own right. A reign and a lifespan are different
 * facts, so both can show — but most of the catalogue has neither, and a blank
 * meta line is worse than no line.
 */
function Dossier({ member }: { member: ConsoleSeat }) {
  const reign = reignLine(member);
  const life = lifeLine(member);
  // The glyph does the labelling, so each chip can be the fact and nothing
  // else: a crown says "reign" faster than the word "Reigned" reads, and it is
  // what separates two date ranges that would otherwise look identical.
  const facts: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }[] = [];
  if (reign) facts.push({ icon: 'crown-outline', text: reign.replace(/^Reigned /, '') });
  if (life) facts.push({ icon: 'calendar-range', text: life });

  if (!facts.length && !member.summary) return null;
  return (
    <View style={styles.dossier}>
      {facts.length ? (
        <View style={styles.facts}>
          {facts.map((fact) => (
            <View key={fact.text} style={styles.fact}>
              <MaterialCommunityIcons name={fact.icon} size={12.5} color="#a99b84" />
              <Text style={styles.factText}>{fact.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {member.summary ? <Text style={styles.summary}>{member.summary}</Text> : null}
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

function ConsoleAction({
  label,
  icon,
  primary,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.action,
          primary && styles.actionPrimary,
          hovered && ((primary ? styles.actionPrimaryHover : styles.actionHover) as object),
        ] as object
      }
    >
      <Ionicons name={icon} size={14} color={primary ? '#fdf6e8' : COLORS.navy} />
      <Text style={[styles.actionText, primary && styles.actionTextPrimary] as object}>{label}</Text>
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
  answer: { gap: 2 },
  lead: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#a99b84',
  },
  verdict: { fontFamily: 'Flame-Regular', fontSize: 34, lineHeight: 42, color: COLORS.black },

  routeBlock: { gap: 9, marginTop: 12 },
  // Label, hairline, count — the rule does the separating so the count can sit
  // at the end of the line it belongs to instead of floating over the chips.
  routeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#a99b84',
  },
  routeRule: { flexGrow: 1, flexShrink: 1, height: 1, backgroundColor: '#f0e6d4' },
  routeCount: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#c0b39c',
  },
  route: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  stop: {
    backgroundColor: '#fffaf0',
    borderWidth: 1,
    borderColor: '#e7dcc9',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  stopName: { fontFamily: 'Flame-Regular', fontSize: 15, lineHeight: 20, color: COLORS.black },
  link: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  linkRule: { width: 12, height: 1, backgroundColor: '#e2d6c1' },
  linkRole: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: '#8d8375',
  },

  dossier: { gap: 8 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fbf4e6',
    borderWidth: 1,
    borderColor: '#efe4d0',
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 11,
  },
  factText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: '#8d8375',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#e7dcc9',
    backgroundColor: '#fffaf0',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    cursor: 'pointer',
  } as object,
  actionHover: { borderColor: '#cdbfa6', backgroundColor: '#f7eeda' } as object,
  actionPrimary: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  actionPrimaryHover: { backgroundColor: COLORS.deepNavy, borderColor: COLORS.deepNavy } as object,
  actionText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  actionTextPrimary: { color: '#fdf6e8' },
  hint: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    lineHeight: 21,
    color: '#8d8375',
    maxWidth: 520,
  },
});
