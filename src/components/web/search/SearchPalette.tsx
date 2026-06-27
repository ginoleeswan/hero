import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../constants/colors';
import { useSearch } from '../../../contexts/SearchContext';
import { useSearchHistory } from '../../../hooks/useSearchHistory';
import { SearchDropdownContent, type NavItem } from './SearchDropdownContent';

// Desktop command palette. Open state is the shared `searchFocused` flag, so the
// suggestion list's existing setSearchFocused(false)-on-select doubles as "close
// the palette". Reuses the orphaned SearchDropdownContent (idle vs suggestions).
export function SearchPalette() {
  const router = useRouter();
  const { query, setQuery, searchFocused, setSearchFocused } = useSearch();
  const { addSearch } = useSearchHistory();
  const inputRef = useRef<TextInput>(null);
  const [items, setItems] = useState<NavItem[]>([]);
  const [highlight, setHighlight] = useState(-1);

  const close = () => setSearchFocused(false);

  // Reset the keyboard cursor whenever the query changes — the item list shifts.
  useEffect(() => {
    setHighlight(-1);
  }, [query]);

  // Open fresh: clear any term left in the shared query (the results page mirrors
  // ?q= into context) and focus the field. An empty query surfaces the idle view
  // — trending + recent searches — so a new search starts from a clean slate.
  useEffect(() => {
    if (!searchFocused) return;
    setQuery('');
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [searchFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes; arrows move the cursor through the result rows; Enter opens the
  // highlighted row (universe → /universe, hero → /character), falling through to
  // the input's submit (commit the query to the results page) when nothing's
  // highlighted.
  useEffect(() => {
    if (!searchFocused) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((i) => (items.length ? (i + 1) % items.length : -1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((i) => (items.length ? (i - 1 + items.length) % items.length : -1));
      } else if (e.key === 'Enter') {
        const item = items[highlight];
        if (!item) return; // fall through to onSubmitEditing (commit query)
        e.preventDefault();
        addSearch(query);
        close();
        if (item.kind === 'universe') {
          router.push(`/universe/${item.slug}` as Parameters<typeof router.push>[0]);
        } else if (item.kind === 'team') {
          router.push(`/team/${item.id}` as Parameters<typeof router.push>[0]);
        } else if (item.kind === 'title') {
          router.push(`/title/${item.id}` as Parameters<typeof router.push>[0]);
        } else {
          router.push(`/character/${item.id}`);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchFocused, items, highlight, query]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!searchFocused) return null;

  // Enter commits to the dedicated results page (?q= is the source of truth).
  const submit = () => {
    const q = query.trim();
    if (!q) return;
    addSearch(q);
    close();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const overlay = (
    <View style={styles.overlay as object}>
      <Pressable style={styles.backdrop as object} onPress={close} aria-label="Close search" />
      <View style={styles.panel as object}>
        <View style={styles.inputRow}>
          <Ionicons name="search" size={20} color="rgba(245,235,220,0.5)" />
          <TextInput
            ref={inputRef}
            style={styles.input as object}
            placeholder="Search heroes & universes…"
            placeholderTextColor="rgba(245,235,220,0.4)"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            autoCorrect={false}
            returnKeyType="search"
          />
          <View style={styles.escBadge}>
            <Text style={styles.escText}>esc</Text>
          </View>
        </View>
        <View style={styles.body as object}>
          <SearchDropdownContent highlightIndex={highlight} onItemsChange={setItems} />
        </View>
      </View>
    </View>
  );

  // Render into document.body so the fixed full-viewport overlay isn't trapped by
  // the TopBar's `transform` (which makes position:fixed relative to the 64px bar
  // instead of the viewport — that's why the backdrop/blur only covered the
  // header and only the header was clickable to dismiss).
  if (typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body) as unknown as ReactElement;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    alignItems: 'center',
  } as object,
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7,14,19,0.55)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    cursor: 'default',
  } as object,
  panel: {
    position: 'absolute',
    top: '13vh',
    width: 600,
    maxWidth: '92vw',
    maxHeight: '64vh',
    backgroundColor: 'rgba(11,24,32,0.94)',
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 80px rgba(0,0,0,0.55)',
    overflow: 'hidden',
    flexDirection: 'column',
  } as object,
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    height: 58,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.10)',
    flexShrink: 0,
  } as object,
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 17,
    color: COLORS.beige,
    outlineStyle: 'none',
  } as object,
  escBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
  },
  escText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as object,
  body: { flex: 1, minHeight: 0 } as object,
});
