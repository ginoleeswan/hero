// src/components/family/HouseRoster.tsx
// Everyone who bears the name — the index that drives the console and the tree.
//
// The old version was fifty-five pill chips wrapped across the page bottom, each
// carrying its own "relate" verb. At that count a wrap grid is a wall: nothing
// scans, and a click a thousand pixels below the tree it changes reads as a
// click that did nothing. So it's a list — one row per person, sorted the way
// the house payload arrives (most famous first) — with a filter for long houses.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, HOUSE_INK } from '../../constants/colors';
import { HeroAvatar } from '../HeroAvatar';
import { PressScale } from '../ui/PressScale';
import { mixHex } from './HouseCrest';
import { nodeDates } from '../../lib/family/lifespan';

export interface RosterMember {
  id: string;
  name: string;
  avatar_url: string | null;
  portrait_url: string | null;
  image_md_url: string | null;
  image_url: string | null;
  reign_start?: string | null;
  reign_end?: string | null;
}

/** Below this a search field costs more attention than it saves. */
const SEARCH_THRESHOLD = 12;

export function HouseRoster({
  members,
  focusId,
  withId,
  pathIds,
  tint,
  initialVisible,
  onCompare,
  onRoot,
}: {
  members: RosterMember[];
  focusId: string | null;
  withId: string | null;
  /** Ids on the traced line, so the answer is legible in the list too. */
  pathIds: Set<string>;
  tint: string;
  /**
   * Rows before "show all". Omit where the list has its own scroll container —
   * stacked under the chart, fifty-five rows are three thousand pixels of wall.
   */
  initialVisible?: number;
  onCompare: (id: string) => void;
  onRoot: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, query]);

  // A search already narrows the list, so the cap only applies to the unfiltered
  // view — typing a name and still being told to "show all" would be absurd.
  const capped =
    !!initialVisible && !showAll && !query.trim() && matched.length > initialVisible + 2;
  const shown = capped ? matched.slice(0, initialVisible) : matched;

  const pathWash = mixHex(tint, '#ffffff', 0.87);

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>The house</Text>
        <Text style={styles.count}>{matched.length}</Text>
      </View>
      {/* One line, because a list with two verbs on every row teaches nothing on
          its own — and "Root" here is the same word the console's caption uses. */}
      <Text style={styles.direction}>Tap a name to see how they’re related.</Text>

      {members.length >= SEARCH_THRESHOLD ? (
        <View style={styles.search}>
          <Ionicons name="search" size={14} color="#a99b84" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a name"
            placeholderTextColor="#b3a894"
            style={styles.searchInput as object}
            accessibilityLabel="Find a name in this house"
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityLabel="Clear search"
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Ionicons name="close-circle" size={15} color="#c4b8a3" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.list}>
        {shown.map((m) => {
          const isRoot = m.id === focusId;
          const isWith = m.id === withId;
          const onPath = !isRoot && !isWith && pathIds.has(m.id);
          // Reigns only: at fifty-five rows a date on every line is a wall,
          // and this is the one that separates the rulers from the rest.
          const reign = m.reign_start
            ? nodeDates({ reign_start: m.reign_start, reign_end: m.reign_end })
            : null;
          return (
            <View
              key={m.id}
              style={
                [
                  styles.row,
                  onPath && { backgroundColor: pathWash },
                  isWith && { borderColor: tint, backgroundColor: pathWash },
                  isRoot && styles.rowRoot,
                ] as object
              }
            >
              <PressScale
                onPress={() => {
                  Haptics.selectionAsync();
                  if (isRoot) onRoot(m.id);
                  else onCompare(m.id);
                }}
                disabled={isRoot}
                accessibilityRole="button"
                accessibilityLabel={
                  isRoot ? `${m.name}, root of the tree` : `Compare ${m.name} with the root`
                }
                style={styles.rowMain}
              >
                <HeroAvatar
                  id={m.id}
                  name={m.name}
                  avatarUrl={m.avatar_url}
                  fallbackUrl={m.portrait_url ?? m.image_md_url ?? m.image_url}
                  size={30}
                  radius={15}
                  bare
                />
                <Text style={styles.name} numberOfLines={1}>
                  {m.name}
                </Text>
                {reign ? (
                  <View style={styles.reign}>
                    <MaterialCommunityIcons name="crown-outline" size={11} color="#b3a48b" />
                    <Text style={styles.reignText}>{reign}</Text>
                  </View>
                ) : null}
              </PressScale>

              {isRoot ? (
                <Text style={styles.tag}>Root</Text>
              ) : (
                <Pressable
                  onPress={() => onRoot(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Centre the chart on ${m.name}`}
                  hitSlop={6}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
                    [
                      styles.rootBtn,
                      hovered && (styles.rootBtnHover as object),
                      pressed && styles.pressed,
                    ] as object
                  }
                >
                  {/* The console's filled button teaches this glyph once, so
                      fifty-four repeats of it need no word beside them. */}
                  <Ionicons name="locate-outline" size={15} color="#b3a894" />
                </Pressable>
              )}
            </View>
          );
        })}

        {capped ? (
          <Pressable
            onPress={() => setShowAll(true)}
            accessibilityRole="button"
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
              [
                styles.more,
                hovered && (styles.moreHover as object),
                pressed && styles.pressed,
              ] as object
            }
          >
            <Text style={styles.moreText}>Show all {matched.length}</Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.navy} />
          </Pressable>
        ) : null}

        {shown.length === 0 ? <Text style={styles.empty}>No one by that name.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  pressed: { opacity: 0.6 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  direction: { fontFamily: 'FlameSans-Regular', fontSize: 12.5, color: HOUSE_INK, marginTop: -6 },
  title: { fontFamily: 'Flame-Regular', fontSize: 21, lineHeight: 27, color: COLORS.black },
  count: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: HOUSE_INK,
    marginLeft: 'auto',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffaf0',
    borderWidth: 1,
    borderColor: '#e7dcc9',
    borderRadius: 12,
    paddingHorizontal: 11,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    color: COLORS.black,
    outlineStyle: 'none',
  } as object,
  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingRight: 6,
  },
  rowRoot: { borderColor: COLORS.navy, backgroundColor: '#fffaf0' },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 6,
    paddingLeft: 7,
    minWidth: 0,
  },
  name: { fontFamily: 'FlameSans-Regular', fontSize: 13.5, color: COLORS.black, flexShrink: 1 },
  // Right-aligned so the reigns line up as a column the eye can run down.
  reign: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' } as object,
  reignText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: HOUSE_INK,
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7dcc9',
    backgroundColor: '#fffaf0',
    cursor: 'pointer',
  } as object,
  moreHover: { borderColor: '#cdbfa6', backgroundColor: '#f7eeda' } as object,
  moreText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: COLORS.navy,
  },
  tag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: HOUSE_INK,
    paddingHorizontal: 4,
  },
  rootBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as object,
  rootBtnHover: { backgroundColor: '#f0e6d4' } as object,
  empty: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: '#8d8375', paddingVertical: 8 },
});
