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
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { HeroAvatar } from '../HeroAvatar';
import { mixHex } from './HouseCrest';

export interface RosterMember {
  id: string;
  name: string;
  avatar_url: string | null;
  portrait_url: string | null;
  image_md_url: string | null;
  image_url: string | null;
}

/** Below this a search field costs more attention than it saves. */
const SEARCH_THRESHOLD = 12;

export function HouseRoster({
  members,
  focusId,
  withId,
  pathIds,
  tint,
  onCompare,
  onRoot,
}: {
  members: RosterMember[];
  focusId: string | null;
  withId: string | null;
  /** Ids on the traced line, so the answer is legible in the list too. */
  pathIds: Set<string>;
  tint: string;
  onCompare: (id: string) => void;
  onRoot: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, query]);

  const pathWash = mixHex(tint, '#ffffff', 0.87);

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>The house</Text>
        <Text style={styles.count}>{shown.length}</Text>
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
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
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
              <Pressable
                onPress={() => (isRoot ? onRoot(m.id) : onCompare(m.id))}
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
              </Pressable>

              {isRoot ? (
                <Text style={styles.tag}>Root</Text>
              ) : (
                <Pressable
                  onPress={() => onRoot(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Root the tree on ${m.name}`}
                  hitSlop={6}
                  style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                    [styles.rootBtn, hovered && (styles.rootBtnHover as object)] as object
                  }
                >
                  <Text style={styles.rootBtnText}>Root</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {shown.length === 0 ? <Text style={styles.empty}>No one by that name.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  direction: { fontFamily: 'FlameSans-Regular', fontSize: 12.5, color: '#a99b84', marginTop: -6 },
  title: { fontFamily: 'Flame-Regular', fontSize: 21, lineHeight: 27, color: COLORS.black },
  count: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: '#a99b84',
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
  tag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: '#a99b84',
    paddingHorizontal: 4,
  },
  rootBtn: {
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: '#eadfcb',
    cursor: 'pointer',
  } as object,
  rootBtnHover: { backgroundColor: '#f0e6d4', borderColor: '#cdbfa6' } as object,
  rootBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: COLORS.navy,
  },
  empty: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: '#8d8375', paddingVertical: 8 },
});
