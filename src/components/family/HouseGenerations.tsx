// src/components/family/HouseGenerations.tsx
// The house as a whole: every member on the rung they stand on.
//
// The chart answers "who is this person's family" — rooted on Daenerys it shows
// the twenty-two she is recorded against, and the other thirty-three are just
// names in a list. This is the other half: no edges, no panning, the whole
// ladder oldest-first. Picking anyone drops back into their line, so the two
// views are a loop rather than a fork.
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';
import { HeroAvatar } from '../HeroAvatar';
import { mixHex } from './HouseCrest';
import { nodeDates, recordedSpan } from '../../lib/family/lifespan';
import type { Generations } from '../../lib/family/generations';

export interface GenerationMember {
  id: string;
  name: string;
  avatar_url: string | null;
  portrait_url: string | null;
  image_md_url: string | null;
  image_url: string | null;
  born: string | null;
  died: string | null;
  reign_start: string | null;
  reign_end: string | null;
}

const NUMERALS: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Numbered because generations are a real sequence, not for decoration. */
export function roman(n: number): string {
  let left = n;
  let out = '';
  for (const [value, glyph] of NUMERALS) {
    while (left >= value) {
      out += glyph;
      left -= value;
    }
  }
  return out;
}

export function HouseGenerations({
  generations,
  focusId,
  pathIds,
  tint,
  onSelect,
}: {
  generations: Generations<GenerationMember>;
  focusId: string | null;
  /** Ids on the traced line, lit here too so the answer survives the switch. */
  pathIds: Set<string>;
  tint: string;
  onSelect: (id: string) => void;
}) {
  const { bands, unplaced } = generations;
  const wash = mixHex(tint, '#ffffff', 0.87);
  // A 62px gutter is a sixth of a phone; below this the numeral goes inline.
  const { width } = useWindowDimensions();
  const stacked = width < 640;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Every generation</Text>
        <Text style={styles.count}>
          {bands.length} {bands.length === 1 ? 'rung' : 'rungs'} · oldest first
        </Text>
      </View>
      <View style={styles.divider} />

      {bands.map((band) => {
        // Anchored in time where the catalogue manages it, silent where not.
        const era = recordedSpan(band.members);
        return (
          <View key={band.depth} style={[styles.band, stacked && styles.bandStacked] as object}>
            <View style={[styles.rail, stacked && styles.railStacked] as object}>
              <Text style={styles.numeral}>{roman(band.depth + 1)}</Text>
              {era ? <Text style={styles.era}>{era}</Text> : null}
            </View>
            <View style={[styles.people, stacked && styles.peopleStacked] as object}>
              {band.members.map((m) => (
                <Person
                  key={m.id}
                  member={m}
                  isFocus={m.id === focusId}
                  onPath={m.id !== focusId && pathIds.has(m.id)}
                  wash={wash}
                  tint={tint}
                  stacked={stacked}
                  onPress={() => onSelect(m.id)}
                />
              ))}
            </View>
          </View>
        );
      })}

      {unplaced.length > 0 ? (
        <View style={[styles.band, stacked && styles.bandStacked] as object}>
          <View style={[styles.rail, stacked && styles.railStacked] as object}>
            <Text style={styles.numeralMuted}>—</Text>
          </View>
          <View style={[styles.people, stacked && styles.peopleStacked] as object}>
            <Text style={styles.unplacedNote}>
              No recorded generation — of the house, but nothing links them to a rung.
            </Text>
            {unplaced.map((m) => (
              <Person
                key={m.id}
                member={m}
                isFocus={m.id === focusId}
                onPath={false}
                wash={wash}
                tint={tint}
                stacked={stacked}
                onPress={() => onSelect(m.id)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Person({
  member,
  isFocus,
  onPath,
  wash,
  tint,
  stacked,
  onPress,
}: {
  member: GenerationMember;
  isFocus: boolean;
  onPath: boolean;
  wash: string;
  tint: string;
  /** Full-width row rather than a chip — see `peopleStacked`. */
  stacked: boolean;
  onPress: () => void;
}) {
  const dates = nodeDates(member);
  const crowned = !!member.reign_start;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Centre the chart on ${member.name}`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.person,
          stacked && styles.personStacked,
          onPath && { borderColor: tint, backgroundColor: wash },
          isFocus && styles.personFocus,
          hovered && !isFocus && (styles.personHover as object),
          pressed && styles.pressed,
        ] as object
      }
    >
      <HeroAvatar
        id={member.id}
        name={member.name}
        avatarUrl={member.avatar_url}
        fallbackUrl={member.portrait_url ?? member.image_md_url ?? member.image_url}
        size={34}
        radius={17}
        bare
      />
      {/* Chip: name over dates. Row: dates right, so the reigns line up. */}
      <View style={[styles.personMeta, stacked && styles.personMetaStacked] as object}>
        <Text style={styles.personName} numberOfLines={1}>
          {member.name}
        </Text>
        {dates ? (
          <View style={[styles.personDates, stacked && styles.personDatesStacked] as object}>
            {crowned ? (
              <MaterialCommunityIcons name="crown-outline" size={10.5} color="#b3a48b" />
            ) : null}
            <Text style={styles.personDatesText}>{dates}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eadfcb',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  count: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: '#a99b84',
    marginLeft: 'auto',
  },
  divider: { height: 1, backgroundColor: '#f0e6d4', marginTop: 12, marginBottom: 4 },

  // Same grammar as the chart's tier gutter: gutter left, content right.
  band: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 12 },
  bandStacked: { flexDirection: 'column', gap: 8 },
  rail: { width: 62, flexGrow: 0, flexShrink: 0, gap: 2, paddingTop: 6 },
  // Sticky: the ladder runs five screens on a phone and the numeral was the
  // only thing saying where you were.
  railStacked: {
    width: 'auto',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    position: 'sticky',
    top: 58,
    zIndex: 2,
    backgroundColor: 'white',
    paddingTop: 8,
    paddingBottom: 6,
  } as object,
  numeral: { fontFamily: 'Flame-Regular', fontSize: 17, lineHeight: 22, color: '#b3a48b' },
  numeralMuted: { fontFamily: 'Flame-Regular', fontSize: 17, lineHeight: 22, color: '#d6c9b2' },
  era: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: '#c0b39c',
  },
  people: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // A chip that never fits two to a line is a row with a ragged right edge.
  // `nowrap` matters: a wrapping column sizes children to content, not width.
  peopleStacked: { flexDirection: 'column', flexWrap: 'nowrap', gap: 6, alignSelf: 'stretch' },

  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#fffaf0',
    borderWidth: 1.5,
    borderColor: '#eee3cf',
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 14,
    cursor: 'pointer',
  } as object,
  personStacked: { alignSelf: 'stretch', borderRadius: 14 },
  personHover: { borderColor: '#cdbfa6', backgroundColor: '#f7eeda' } as object,
  personFocus: { borderColor: COLORS.navy, backgroundColor: '#fffaf0' },
  personMeta: { gap: 0, minWidth: 0 },
  personMetaStacked: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personName: { fontFamily: 'Flame-Regular', fontSize: 14.5, lineHeight: 19, color: COLORS.black },
  personDates: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  personDatesStacked: { marginLeft: 'auto' } as object,
  personDatesText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.4,
    color: '#a99b84',
  },
  unplacedNote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12.5,
    lineHeight: 20,
    color: '#a99b84',
    width: '100%',
  },
});
