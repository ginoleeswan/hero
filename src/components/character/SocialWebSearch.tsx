import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type TextInput as RNTextInput,
} from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroAvatar } from '../HeroAvatar';
import type { NeighborKind, NeighborNode } from '../../lib/db/heroes/neighborhood';

const KIND_LABEL: Record<NeighborKind, string> = {
  enemy: 'Nemesis',
  ally: 'Ally',
  teammate: 'Teammate',
  family: 'Bloodline',
};
/** Group headings, worded exactly as the scene labels its clusters. */
const KIND_GROUP: Record<NeighborKind, string> = {
  enemy: 'Nemeses',
  ally: 'Allies',
  teammate: 'Teammates',
  family: 'Bloodline',
};
const KIND_COLOR: Record<NeighborKind, string> = {
  enemy: COLORS.red,
  ally: COLORS.green,
  teammate: COLORS.blue,
  family: COLORS.purple,
};

/**
 * Jump to a character in the current universe.
 *
 * Collapsed to an icon until asked for. It used to sit permanently expanded
 * under the title, which spent a 260px field on a secondary action, put it in
 * the same column as the focus card, and cost a whole row on a phone. Reaching
 * for a name is something you decide to do; the affordance can wait until then.
 *
 * Each result carries its faction — the dot and the word. Position IS the
 * information on this screen, so "Harley Quinn, Nemesis" tells you where she is
 * standing before you get there, where a bare name would make you hunt for a
 * head that just lit up somewhere off to the left.
 */
export function SocialWebSearch({
  nodes,
  kindOf,
  onPick,
}: {
  nodes: NeighborNode[];
  /** Which faction a node belongs to, for the result's colour and label. */
  kindOf?: (id: string) => NeighborKind | null;
  onPick: (id: string) => void;
}) {
  const { width: vw } = useWindowDimensions();
  const narrow = vw < 760;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<RNTextInput | null>(null);
  // The whole control, so a click outside it can be told apart from one inside.
  const rootRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    // Names that START with the term first — typing "ba" should reach Batman
    // before Deathstroke's alias happens to contain it.
    return nodes
      .filter((n) => n.name.toLowerCase().includes(term))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(term) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(term) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 7);
  }, [q, nodes]);

  // the highlighted
  // row resets to the top whenever the query changes. Derived state that has to
  // follow an input; there is no render-time form that keeps the list mounted.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCursor(0), [q]);

  /**
   * With nothing typed, show the whole cast grouped by faction.
   *
   * A search box that is blank until you guess a name is a dead end — you have
   * to already know who is here. Opening straight into the roster makes this
   * the readable index of the constellation: the same four groups, in the same
   * order, as a list you can scan. It's also the only way to browse the cast
   * that doesn't require orbiting the scene.
   */
  const index = useMemo(() => {
    const order: NeighborKind[] = ['enemy', 'ally', 'teammate', 'family'];
    return order
      .map((kind) => ({
        kind,
        members: nodes.filter((n) => !n.is_subject && kindOf?.(n.id) === kind),
      }))
      .filter((g) => g.members.length > 0);
  }, [nodes, kindOf]);

  const close = () => {
    setOpen(false);
    setQ('');
  };
  const choose = (id: string) => {
    onPick(id);
    close();
  };

  // "/" is the long-standing convention for "search this page", and costs
  // nothing to offer. Ignored while a field already has focus so it can still
  // be typed as a character.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLElement && (el.tagName === 'INPUT' || el.isContentEditable);
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape and click-away, at document level. RNW's onKeyPress doesn't reliably
  // deliver Escape on web, and a panel you can only dismiss with its own button
  // is a trap the moment the pointer has moved on.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (!rootRef.current?.contains(e.target)) close();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.toggle}
        hitSlop={TOGGLE_SLOP}
        accessibilityLabel="Find a character in this universe"
      >
        <Ionicons name="search" size={16} color={INK_TEXT.muted} />
      </Pressable>
    );
  }

  return (
    <View style={styles.anchor} ref={rootRef as never}>
      <Pressable
        onPress={close}
        style={styles.toggle}
        hitSlop={TOGGLE_SLOP}
        accessibilityLabel="Close search"
      >
        <Ionicons name="close" size={16} color={INK_TEXT.primary} />
      </Pressable>

      <View
        style={
          [
            styles.panel,
            narrow && styles.panelNarrow,
            narrow && { width: Math.min(320, vw - 32) },
          ] as object
        }
      >
        <View style={styles.field}>
          <Ionicons name="search" size={15} color={INK_TEXT.muted} />
          <TextInput
            ref={inputRef}
            value={q}
            onChangeText={setQ}
            placeholder="Find in this universe…"
            placeholderTextColor={INK_TEXT.faint}
            style={styles.input}
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => results[cursor] && choose(results[cursor].id)}
            // Arrow keys walk the list without leaving the field, so the whole
            // interaction is one uninterrupted keyboard motion.
            onKeyPress={(e) => {
              const key = (e.nativeEvent as { key?: string }).key;
              if (key === 'Escape') return close();
              if (!results.length) return;
              if (key === 'ArrowDown') setCursor((c) => (c + 1) % results.length);
              if (key === 'ArrowUp') setCursor((c) => (c - 1 + results.length) % results.length);
            }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear">
              <Ionicons name="close-circle" size={15} color={INK_TEXT.muted} />
            </Pressable>
          ) : null}
        </View>

        {q.trim() ? (
          <View style={styles.results}>
            {results.length === 0 ? (
              <Text style={styles.empty}>No one by that name in this universe.</Text>
            ) : (
              results.map((n, i) => {
                const kind = kindOf?.(n.id) ?? null;
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => choose(n.id)}
                    onHoverIn={() => setCursor(i)}
                    style={[styles.row, i === cursor && styles.rowActive] as object}
                  >
                    {/* The same flat head that's drawn in the scene, so what
                        you pick here is recognisably what lights up there. */}
                    <HeroAvatar
                      id={n.id}
                      name={n.name}
                      avatarUrl={n.avatar_url}
                      fallbackUrl={n.portrait_url ?? n.image_md_url ?? n.image_url}
                      size={28}
                      bare
                    />
                    <Text style={styles.rowName} numberOfLines={1}>
                      {n.name}
                    </Text>
                    {kind ? (
                      <View style={styles.kind}>
                        <View
                          style={[styles.dot, { backgroundColor: KIND_COLOR[kind] }] as object}
                        />
                        <Text style={[styles.kindText, { color: KIND_COLOR[kind] }] as object}>
                          {KIND_LABEL[kind]}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.results}>
            <View style={styles.scroll}>
              {index.map((g) => (
                <View key={g.kind}>
                  <View style={styles.groupHead}>
                    <View style={[styles.dot, { backgroundColor: KIND_COLOR[g.kind] }] as object} />
                    <Text style={[styles.groupText, { color: KIND_COLOR[g.kind] }] as object}>
                      {KIND_GROUP[g.kind]} · {g.members.length}
                    </Text>
                  </View>
                  {g.members.map((n) => (
                    <Pressable
                      key={n.id}
                      onPress={() => choose(n.id)}
                      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                        [styles.row, hovered && styles.rowActive] as object
                      }
                    >
                      <HeroAvatar
                        id={n.id}
                        name={n.name}
                        avatarUrl={n.avatar_url}
                        fallbackUrl={n.portrait_url ?? n.image_md_url ?? n.image_url}
                        size={26}
                        bare
                      />
                      <Text style={styles.rowName} numberOfLines={1}>
                        {n.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// 34pt toggle + 5pt of slop each side = the 44pt target floor. Slop rather
// than a bigger button: the control floats over the constellation.
const TOGGLE_SLOP = 5;

const styles = StyleSheet.create({
  // The panel hangs off the toggle, so the toggle keeps its place in the header
  // row and the results are free to be wider than it.
  anchor: { position: 'relative' } as object,
  toggle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'absolute',
    top: 42,
    right: 0,
    width: 320,
    gap: 8,
    zIndex: 40,
  } as object,
  panelNarrow: { width: 268 } as object,
  // The list has to stay inside the viewport on a phone, where the panel opens
  // just under a header that already owns the top of the screen.
  scroll: { maxHeight: '52dvh', overflowY: 'auto' } as object,
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingTop: 9,
    paddingBottom: 3,
  },
  groupText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as object,
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    height: 42,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(11,24,32,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.24)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  } as object,
  input: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 16, // ≥16: iOS zooms on focus below this
    color: INK_TEXT.primary,
    outlineStyle: 'none',
  } as object,
  results: {
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(11,24,32,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
  } as object,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
    transition: 'background-color 120ms ease',
  } as object,
  rowActive: { backgroundColor: 'rgba(245,235,220,0.09)' } as object,
  rowName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: INK_TEXT.primary },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  kindText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } as object,
  empty: { fontFamily: 'FlameSans-Regular', fontSize: 12.5, color: INK_TEXT.faint, padding: 13 },
  hint: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    color: INK_TEXT.faint,
    paddingLeft: 4,
  },
});
