// Step 0 of the pipeline — add new characters from ComicVine, by name or by a
// whole grouping (team / comic series). Live search, multi-select, a new-only
// roster filter, a duplicate guard, and a one-click "enrich now" to close the
// loop. Added heroes enter as 'pending' and flow into step 1.
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { Panel } from './Panel';
import { HeroThumb } from './atoms';
import { InfoTip } from './InfoTip';
import {
  searchComicvineCharacters,
  fetchPopularCharacters,
  fetchCharacterDetail,
  searchComicvineGroups,
  getComicvineGroupMembers,
  existingComicvineIds,
  existingHeroNames,
  addComicvineHeroes,
  deleteHero,
  type CvCharacter,
  type CvCharacterDetail,
  type CvGroup,
  type GroupResource,
} from '../../../lib/db/cvIngest';
import { getBuildHeroes, type BuildStage } from '../../../lib/db/build';
import { CharacterPreview } from './CharacterPreview';

// A character added during this session — enough to show it, build it, or undo it.
type AddedHero = { id: string; name: string; image: string | null };

// Live build-stage badge for an added hero (updates as the pipeline runs).
const STAGE_BADGE: Record<BuildStage, { label: string; color: string }> = {
  comicvine: { label: 'ComicVine', color: COLORS.orange },
  resolve: { label: 'resolving', color: COLORS.orange },
  appearances: { label: 'appearances', color: COLORS.orange },
  review: { label: 'needs review', color: COLORS.yellow },
  unresolved: { label: 'no match', color: COLORS.grey },
  failed: { label: 'failed', color: COLORS.red },
  done: { label: 'built', color: COLORS.green },
};

type Mode = 'name' | 'popular' | 'team' | 'volume' | 'person' | 'movie' | 'publisher' | 'power';
type Flash = (msg: string, tone?: 'info' | 'success' | 'error' | 'pending') => void;
const MODES: { key: Mode; label: string }[] = [
  { key: 'popular', label: '★ Popular gaps' },
  { key: 'name', label: 'By name' },
  { key: 'team', label: 'By team' },
  { key: 'volume', label: 'By series' },
  { key: 'person', label: 'By creator' },
  { key: 'movie', label: 'By film' },
  { key: 'publisher', label: 'By publisher' },
  { key: 'power', label: 'By power' },
];
// Group-mode icon + search placeholder per resource.
type IconName = 'people' | 'book' | 'brush' | 'film' | 'business' | 'flash';
const GROUP_ICON: Record<string, IconName> = {
  team: 'people', volume: 'book', person: 'brush', movie: 'film', publisher: 'business', power: 'flash',
};
const PLACEHOLDER: Record<Mode, string> = {
  name: 'Character name… (e.g. Darth Vader)',
  popular: '',
  team: 'Team name… (e.g. Jedi Order)',
  volume: 'Comic series… (e.g. Star Wars)',
  person: 'Creator name… (e.g. Jack Kirby)',
  movie: 'Film title… (e.g. The Empire Strikes Back)',
  publisher: 'Publisher… (e.g. Valiant)',
  power: 'Power… (e.g. Telepathy)',
};

export function AddHeroesPanel({
  flash, onAdded, onBuild,
}: { flash: Flash; onAdded: () => void; onBuild: (heroIds: string[]) => void }) {
  const [mode, setMode] = useState<Mode>('name');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [chars, setChars] = useState<CvCharacter[]>([]);
  const [groups, setGroups] = useState<CvGroup[]>([]);
  const [group, setGroup] = useState<CvGroup | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addedSession, setAddedSession] = useState<AddedHero[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [rosterOpen, setRosterOpen] = useState(false);
  const [stages, setStages] = useState<Record<string, BuildStage>>({});
  const [newOnly, setNewOnly] = useState(true);

  // 'Popular gaps' paging — keep scanning ComicVine's most-appeared characters,
  // showing only the ones missing from the catalogue.
  const [popularOffset, setPopularOffset] = useState(0);
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularEnd, setPopularEnd] = useState(false);

  // Inline preview — which result row is expanded, and a lazy cache of the rich
  // ComicVine detail per character id (fetched once, on first expand).
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, CvCharacterDetail | null>>({});
  const [detailLoading, setDetailLoading] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
    if (id in detailCache || detailLoading.has(id)) return;
    setDetailLoading((p) => new Set(p).add(id));
    fetchCharacterDetail(id)
      .then((d) => setDetailCache((p) => ({ ...p, [id]: d })))
      .catch(() => setDetailCache((p) => ({ ...p, [id]: null })))
      .finally(() => setDetailLoading((p) => { const s = new Set(p); s.delete(id); return s; }));
  };

  // Poll the live build stage of this session's heroes so the roster reflects
  // progress (queued → ComicVine → … → built) and doesn't sit stale after a build.
  useEffect(() => {
    if (addedSession.length === 0) { setStages({}); return; }
    let alive = true;
    const ids = addedSession.map((a) => `cv-${a.id}`);
    // Once every added hero reaches a terminal stage there's nothing left to poll.
    const TERMINAL = new Set<BuildStage>(['done', 'failed', 'unresolved']);
    const tick = async () => {
      const rows = await getBuildHeroes(ids);
      if (!alive) return;
      setStages(Object.fromEntries(rows.map((r) => [r.id, r.stage])));
      if (rows.length === ids.length && rows.every((r) => TERMINAL.has(r.stage))) clearInterval(t);
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [addedSession]);
  const builtCount = addedSession.filter((a) => stages[`cv-${a.id}`] === 'done').length;

  const addedIds = useMemo(() => new Set(addedSession.map((a) => a.id)), [addedSession]);
  const reset = () => { setChars([]); setGroups([]); setGroup(null); setMembers([]); setSelected(new Set()); setExpandedId(null); };
  const isIn = (id: string) => existingIds.has(id) || addedIds.has(id);
  const isDup = (id: string, name: string) => !isIn(id) && existingNames.has(name.toLowerCase().trim());

  // Scan popular characters to surface gaps. The catalogue is popularity-seeded,
  // so the top pages are mostly already in it and we need to cover a lot of ground.
  // Fetch a batch of pages in parallel (instead of one slow sequential page at a
  // time) and run the catalogue-existence checks together — a click resolves in
  // one round-trip's worth of latency rather than a dozen stacked on each other.
  const PAGE = 100; // ComicVine's max page size — fewer, denser calls
  const BATCH_PAGES = 3; // pages fetched per click, concurrently
  const loadPopular = async (off: number, append: boolean) => {
    append ? setPopularLoading(true) : setLoading(true);
    try {
      const offsets = Array.from({ length: BATCH_PAGES }, (_, i) => off + i * PAGE);
      const pages = await Promise.all(offsets.map((o) => fetchPopularCharacters(o)));
      const ended = pages.some((p) => p.length < PAGE); // a short page = end of list
      // ComicVine's appearance-sorted paging can repeat a character across pages on
      // ties — de-dupe within the batch so React keys stay unique.
      const batchSeen = new Set<string>();
      const collected = pages.flat().filter((c) => !batchSeen.has(c.id) && batchSeen.add(c.id));
      const [ex, exN] = await Promise.all([
        existingComicvineIds(collected.map((c) => c.id)),
        existingHeroNames(collected.map((c) => c.name)),
      ]);
      setChars((prev) => {
        if (!append) return collected;
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...collected.filter((c) => !seen.has(c.id))];
      });
      setExistingIds((prev) => (append ? new Set([...prev, ...ex]) : ex));
      setExistingNames((prev) => (append ? new Set([...prev, ...exN]) : exN));
      setPopularOffset(off + BATCH_PAGES * PAGE);
      setPopularEnd(ended);
    } catch (e) { flash(`Couldn't load popular: ${(e as Error).message}`, 'error'); }
    finally { append ? setPopularLoading(false) : setLoading(false); }
  };

  // Load the first page of popular gaps when that mode is entered.
  useEffect(() => {
    if (mode !== 'popular') return;
    setPopularEnd(false); setSelected(new Set());
    loadPopular(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Live (debounced) search whenever the query or mode changes.
  useEffect(() => {
    if (mode === 'popular') return; // discovery mode handles its own loading
    if (group) return; // browsing a roster, don't re-search
    if (query.trim().length < 2) { reset(); return; }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        if (mode === 'name') {
          const r = await searchComicvineCharacters(query);
          if (!active) return;
          setChars(r); setGroups([]); setSelected(new Set());
          setExistingIds(await existingComicvineIds(r.map((c) => c.id)));
          setExistingNames(await existingHeroNames(r.map((c) => c.name)));
        } else {
          const r = await searchComicvineGroups(mode as GroupResource, query);
          if (!active) return;
          setGroups(r); setChars([]);
        }
      } catch (e) { if (active) flash(`Search failed: ${(e as Error).message}`, 'error'); }
      finally { if (active) setLoading(false); }
    }, 350);
    return () => { active = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode]);

  const openGroup = async (g: CvGroup) => {
    setGroup(g); setLoading(true); setSelected(new Set());
    try {
      const m = await getComicvineGroupMembers(mode as GroupResource, g.id);
      setMembers(m.characters);
      setExistingIds(await existingComicvineIds(m.characters.map((c) => c.id)));
      setExistingNames(await existingHeroNames(m.characters.map((c) => c.name)));
    } catch (e) { flash(`Load failed: ${(e as Error).message}`, 'error'); }
    finally { setLoading(false); }
  };

  // The current addable rows (characters in name mode, members in group mode).
  const rows = useMemo(
    () => (mode === 'name' || mode === 'popular' ? chars.map((c) => ({ id: c.id, name: c.name })) : members),
    [mode, chars, members],
  );
  const newRows = rows.filter((r) => !isIn(r.id));

  const toggle = (id: string) =>
    setSelected((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectAllNew = () => setSelected(new Set(newRows.map((r) => r.id)));
  const clearSel = () => setSelected(new Set());

  // Add a set of characters to the catalogue (as pending). Shared by the toolbar
  // "Add N" (the whole selection) and the inline preview's one-tap "Add". Returns
  // the ids actually added (new ones), so callers can chain a build.
  const addByIds = async (rawIds: string[]): Promise<string[]> => {
    const ids = rawIds.filter((id) => !isIn(id));
    if (ids.length === 0) return [];
    const payload = ids.map((id) => {
      const c = chars.find((x) => x.id === id);
      const m = members.find((x) => x.id === id);
      const d = detailCache[id];
      return { id, name: c?.name ?? m?.name ?? d?.name ?? '', image: c?.image ?? d?.image ?? null };
    });
    setBusy(true);
    try {
      const n = await addComicvineHeroes(payload);
      setAddedSession((p) => [...payload.filter((x) => !p.some((a) => a.id === x.id)), ...p]);
      setRosterOpen(true);
      // Drop just-added ids from the selection; keep any other ticked rows intact.
      setSelected((p) => { const s = new Set(p); ids.forEach((id) => s.delete(id)); return s; });
      flash(`Added ${n} hero${n === 1 ? '' : 'es'} — pending at step 1.`, 'success');
      onAdded();
      return ids;
    } catch (e) { flash(`Add failed: ${(e as Error).message}`, 'error'); return []; }
    finally { setBusy(false); }
  };
  const addSelected = () => addByIds([...selected]);
  // One-shot bulk: add every new row in the current view and immediately build them.
  const addAllNewAndBuild = async () => {
    const added = await addByIds(newRows.map((r) => r.id));
    if (added.length > 0) onBuild(added.map((id) => `cv-${id}`));
  };

  // Undo a just-added character — delete it from the catalogue and drop it here.
  const removeAdded = async (a: AddedHero) => {
    setRemoving((p) => new Set(p).add(a.id));
    try {
      await deleteHero(`cv-${a.id}`);
      setAddedSession((p) => p.filter((x) => x.id !== a.id));
      flash(`Removed ${a.name}.`, 'info');
      onAdded();
    } catch (e) { flash(`Remove failed: ${(e as Error).message}`, 'error'); }
    finally { setRemoving((p) => { const s = new Set(p); s.delete(a.id); return s; }); }
  };

  // Publisher / power rosters run to thousands; cap what we render so a big roster
  // can't jank the list. 'New only' (on by default) plus the cap keeps it usable.
  const ROSTER_CAP = 300;
  const memberFiltered = group ? (newOnly ? members.filter((m) => !isIn(m.id)) : members) : [];
  const memberView = memberFiltered.slice(0, ROSTER_CAP);
  const memberTruncated = memberFiltered.length - memberView.length;

  return (
    <Panel
      title="Add heroes · ComicVine"
      hint="Step 0 — bring new characters in. Search by name, team, series, creator, film, publisher or power; tap a result to preview it; added heroes flow into step 1."
      action={<InfoTip text="Not sure what's missing? Start with '★ Popular gaps' — ComicVine's most-published characters that aren't in your catalogue yet, most-appeared first. Or live-search by name, team, series, creator, film, publisher or power. Tap any result to preview its real name, powers, first appearance and more before adding. Tick the ones you want (or 'Select all new') and Add — or 'Add all & build' to do the whole new set in one go. Already-in-catalogue and same-name duplicates are flagged." />}
    >
      {/* Mode + live search */}
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Pressable key={m.key} onPress={() => { setMode(m.key); setQuery(''); reset(); }} style={[styles.modePill, mode === m.key && styles.modePillOn]}>
            <Text style={[styles.modePillText, mode === m.key && styles.modePillTextOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      {mode === 'popular' ? (
        <Text style={styles.popularHint}>
          ComicVine's most-published characters that aren't in your catalogue yet — top appearances first. Tick the ones worth adding.
        </Text>
      ) : !group ? (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.grey} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={PLACEHOLDER[mode]}
            placeholderTextColor={COLORS.grey}
            style={[styles.searchInput, { outlineStyle: 'none' }] as object}
          />
          {loading ? <ActivityIndicator size="small" color={COLORS.orange} /> : query.length > 0 ? (
            <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={16} color={COLORS.grey} /></Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Group search results (teams / series) */}
      {mode !== 'name' && !group && groups.length > 0 ? (
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          {groups.map((g) => (
            <Pressable key={g.id} onPress={() => openGroup(g)} style={styles.groupRow}>
              {g.image ? (
                <HeroThumb uri={g.image} width={34} height={44} radius={7} />
              ) : (
                <View style={styles.groupIcon}><Ionicons name={GROUP_ICON[mode] ?? 'book'} size={16} color={COLORS.orange} /></View>
              )}
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {g.members != null ? `${g.members} members` : (g.hint ?? mode)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.grey} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Selection toolbar (shared by name results + open roster) */}
      {((mode === 'name' || mode === 'popular') && chars.length > 0) || group ? (
        <View style={styles.toolbar}>
          {group ? (
            <Pressable onPress={() => { setGroup(null); setMembers([]); clearSel(); }} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={15} color={COLORS.navy} />
              <Text style={styles.backText} numberOfLines={1}>{group.name}</Text>
            </Pressable>
          ) : <View style={{ flex: 1 }} />}
          <Text style={styles.countText}>{newRows.length} new{rows.length ? ` of ${rows.length}` : ''}</Text>
          {group ? (
            <Pressable onPress={() => setNewOnly((v) => !v)} style={[styles.miniToggle, newOnly && styles.miniToggleOn]}>
              <Text style={[styles.miniToggleText, newOnly && styles.miniToggleTextOn]}>New only</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={selectAllNew} disabled={newRows.length === 0} style={[styles.linkBtn, newRows.length === 0 && styles.dim]}>
            <Text style={styles.linkText}>Select all new</Text>
          </Pressable>
          <Pressable onPress={addSelected} disabled={busy || selected.size === 0} style={[styles.addBtn, (busy || selected.size === 0) && styles.dim]}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={15} color="#fff" />}
            <Text style={styles.addBtnText}>Add {selected.size || ''}</Text>
          </Pressable>
          {/* One-shot: add every new row and build them immediately. */}
          <Pressable
            onPress={addAllNewAndBuild}
            disabled={busy || newRows.length === 0}
            style={[styles.buildAllBtn, (busy || newRows.length === 0) && styles.dim]}
            accessibilityLabel={`Add all ${newRows.length} new and build`}
          >
            <Ionicons name="construct" size={14} color="#fff" />
            <Text style={styles.buildAllText}>Add all {newRows.length} &amp; build</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Name results (with art + inline preview) */}
      {mode === 'name' && chars.length > 0 ? (
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          {chars.map((c) => (
            <CharacterRow
              key={c.id}
              c={c}
              selected={selected.has(c.id)}
              inCat={isIn(c.id)}
              dup={isDup(c.id, c.name)}
              expanded={expandedId === c.id}
              detail={detailCache[c.id]}
              detailLoading={detailLoading.has(c.id)}
              busy={busy}
              onToggleSelect={() => !isIn(c.id) && toggle(c.id)}
              onToggleExpand={() => toggleExpand(c.id)}
              onAdd={() => addByIds([c.id])}
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Popular gaps (missing-only, paged, with inline preview) */}
      {mode === 'popular' ? (
        loading && chars.length === 0 ? <ActivityIndicator color={COLORS.orange} style={{ marginTop: 14 }} /> : (
          <ScrollView style={styles.scroll} nestedScrollEnabled>
            {newRows.length === 0 && !loading ? (
              <Text style={styles.empty}>No gaps on the pages loaded so far — they're all in your catalogue. Load more to dig deeper.</Text>
            ) : null}
            {chars.filter((c) => !isIn(c.id)).map((c) => (
              <CharacterRow
                key={c.id}
                c={c}
                selected={selected.has(c.id)}
                inCat={false}
                dup={isDup(c.id, c.name)}
                expanded={expandedId === c.id}
                detail={detailCache[c.id]}
                detailLoading={detailLoading.has(c.id)}
                busy={busy}
                onToggleSelect={() => toggle(c.id)}
                onToggleExpand={() => toggleExpand(c.id)}
                onAdd={() => addByIds([c.id])}
              />
            ))}
            <Pressable
              onPress={() => loadPopular(popularOffset, true)}
              disabled={popularLoading || popularEnd}
              style={[styles.loadMore, (popularLoading || popularEnd) && styles.dim]}
            >
              {popularLoading ? (
                <ActivityIndicator size="small" color={COLORS.orange} />
              ) : (
                <Text style={styles.loadMoreText}>{popularEnd ? 'End of list' : 'Load more'}</Text>
              )}
            </Pressable>
          </ScrollView>
        )
      ) : null}

      {/* Roster (team / series members) */}
      {group ? (
        loading ? <ActivityIndicator color={COLORS.orange} style={{ marginTop: 14 }} /> : (
          <ScrollView style={styles.scroll} nestedScrollEnabled>
            {memberView.map((m) => (
              <Pressable key={m.id} onPress={() => !isIn(m.id) && toggle(m.id)} style={styles.memberRow}>
                <Checkbox checked={selected.has(m.id)} disabled={isIn(m.id)} />
                <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                <StatusBadge inCat={isIn(m.id)} dup={isDup(m.id, m.name)} />
              </Pressable>
            ))}
            {memberView.length === 0 ? <Text style={styles.empty}>{newOnly ? 'No new members — all in catalogue.' : 'No members.'}</Text> : null}
            {memberTruncated > 0 ? (
              <Text style={styles.empty}>
                Showing first {ROSTER_CAP.toLocaleString()} of {(memberView.length + memberTruncated).toLocaleString()}
                {newOnly ? ' new' : ''} — add these or refine with a narrower search.
              </Text>
            ) : null}
          </ScrollView>
        )
      ) : null}

      {/* Close the loop — review what you added, remove mistakes, then build live. */}
      {addedSession.length > 0 ? (
        <View style={styles.session}>
          <Pressable onPress={() => setRosterOpen((v) => !v)} style={styles.loopBar}>
            <Ionicons name="information-circle" size={15} color={COLORS.orange} />
            <Text style={styles.loopText}>
              {addedSession.length} added this session
              {builtCount > 0 ? ` · ${builtCount} built` : ''}
            </Text>
            <Ionicons name={rosterOpen ? 'chevron-up' : 'chevron-down'} size={15} color={COLORS.navy} />
            <Pressable onPress={() => onBuild(addedSession.map((a) => `cv-${a.id}`))} style={styles.loopBtn}>
              <Ionicons name="construct" size={12} color="#fff" />
              <Text style={styles.loopBtnText}>Build {addedSession.length}</Text>
            </Pressable>
          </Pressable>
          {rosterOpen ? (
            <View style={styles.addedList}>
              {addedSession.map((a) => {
                const busyThis = removing.has(a.id);
                return (
                  <View key={a.id} style={styles.addedRow}>
                    <HeroThumb uri={a.image} width={28} height={37} radius={5} />
                    <Text style={styles.addedName} numberOfLines={1}>{a.name}</Text>
                    {(() => {
                      const st = stages[`cv-${a.id}`];
                      const badge = st ? STAGE_BADGE[st] : null;
                      return badge ? (
                        <Text style={[styles.stageBadge, { color: badge.color }]} numberOfLines={1}>{badge.label}</Text>
                      ) : null;
                    })()}
                    <Pressable
                      onPress={() => removeAdded(a)}
                      disabled={busyThis}
                      style={[styles.removeBtn, busyThis && styles.dim]}
                      accessibilityLabel={`Remove ${a.name}`}
                    >
                      {busyThis ? (
                        <ActivityIndicator size="small" color={COLORS.red} />
                      ) : (
                        <Ionicons name="trash-outline" size={14} color={COLORS.red} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </Panel>
  );
}

// The result sub-line: appearances + publisher when we have a popularity count
// (name + popular feeds both carry it now), otherwise publisher or the deck.
function charSub(c: CvCharacter): string {
  if (c.appearances != null) {
    return `${c.appearances.toLocaleString()} appearances${c.publisher ? ` · ${c.publisher}` : ''}`;
  }
  return c.publisher ?? c.deck ?? '—';
}

// One character result: checkbox (multi-select) + tappable body (expand preview).
// The checkbox and the body are separate hit targets so ticking doesn't expand.
function CharacterRow({
  c, selected, inCat, dup, expanded, detail, detailLoading, busy,
  onToggleSelect, onToggleExpand, onAdd,
}: {
  c: CvCharacter;
  selected: boolean; inCat: boolean; dup: boolean; expanded: boolean;
  detail: CvCharacterDetail | null | undefined; detailLoading: boolean; busy: boolean;
  onToggleSelect: () => void; onToggleExpand: () => void; onAdd: () => void;
}) {
  return (
    <View style={[styles.charWrap, expanded && styles.charWrapOpen]}>
      <View style={styles.row}>
        <Pressable onPress={onToggleSelect} disabled={inCat} hitSlop={8}>
          <Checkbox checked={selected} disabled={inCat} />
        </Pressable>
        <Pressable onPress={onToggleExpand} style={styles.rowBody}>
          <HeroThumb uri={c.image} width={32} height={42} radius={6} />
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
            <Text style={styles.sub} numberOfLines={1}>{charSub(c)}</Text>
          </View>
          <StatusBadge inCat={inCat} dup={dup} />
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.grey} />
        </Pressable>
      </View>
      {expanded ? (
        <CharacterPreview
          detail={detail}
          loading={detailLoading}
          fallbackImage={c.image}
          inCat={inCat}
          busy={busy}
          onAdd={onAdd}
        />
      ) : null}
    </View>
  );
}

function Checkbox({ checked, disabled }: { checked: boolean; disabled: boolean }) {
  return (
    <View style={[styles.cb, checked && styles.cbOn, disabled && styles.cbDisabled]}>
      {checked && !disabled ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
    </View>
  );
}

function StatusBadge({ inCat, dup }: { inCat: boolean; dup: boolean }) {
  if (inCat) return <View style={styles.badge}><Ionicons name="checkmark" size={12} color={COLORS.green} /><Text style={[styles.badgeText, { color: COLORS.green }]}>in catalogue</Text></View>;
  if (dup) return <View style={styles.badge}><Ionicons name="warning" size={12} color={COLORS.yellow} /><Text style={[styles.badgeText, { color: COLORS.yellow }]}>possible dup</Text></View>;
  return null;
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, rowGap: 6, marginBottom: 10 },
  modePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#efe6d6' },
  modePillOn: { backgroundColor: COLORS.navy },
  modePillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  modePillTextOn: { color: '#fff' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f6f0e6', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  popularHint: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: COLORS.grey, lineHeight: 18 },
  loadMore: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 4 },
  loadMoreText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.orange, textDecorationLine: 'underline' },
  dim: { opacity: 0.4 },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1, minWidth: 0 },
  backText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy, flexShrink: 1 },
  countText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },
  miniToggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, backgroundColor: '#efe6d6' },
  miniToggleOn: { backgroundColor: COLORS.navy },
  miniToggleText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.navy },
  miniToggleTextOn: { color: '#fff' },
  linkBtn: { paddingVertical: 4 },
  linkText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange, textDecorationLine: 'underline' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.orange, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  addBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  buildAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.navy, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  buildAllText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },

  scroll: { maxHeight: 300, marginTop: 8 } as object,
  charWrap: { borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)' },
  charWrapOpen: { backgroundColor: '#faf5ec', borderRadius: 10, borderBottomColor: 'transparent', marginVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  rowBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)' },
  groupIcon: { width: 34, height: 44, borderRadius: 7, backgroundColor: COLORS.orange + '14', alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)' },
  memberName: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.black },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey, marginTop: 12 },

  cb: { width: 19, height: 19, borderRadius: 5, borderWidth: 2, borderColor: 'rgba(41,60,67,0.3)', alignItems: 'center', justifyContent: 'center' },
  cbOn: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  cbDisabled: { borderColor: 'rgba(41,60,67,0.12)', backgroundColor: 'rgba(41,60,67,0.05)' },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11 },

  session: { marginTop: 12, gap: 8 },
  loopBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.orange + '12', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  loopText: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  loopBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.orange, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  loopBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  addedList: { gap: 2 },
  addedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  addedName: { flex: 1, minWidth: 0, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  stageBadge: { fontFamily: 'Nunito_700Bold', fontSize: 11, fontVariant: ['tabular-nums'] },
  removeBtn: {
    width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.red + '12',
  },
});
