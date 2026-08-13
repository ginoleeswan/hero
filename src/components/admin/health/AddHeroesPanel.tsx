// Step 0 of the pipeline — add new characters from ComicVine, by name or by a
// whole grouping (team / comic series). Live search, multi-select, a new-only
// roster filter, a duplicate guard, and a one-click "enrich now" to close the
// loop. Added heroes enter as 'pending' and flow into step 1.
import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '../../ui/Text';
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

import {
  STAGE_BADGE,
  MODES,
  GROUP_ICON,
  PLACEHOLDER,
  type AddedHero,
  type Mode,
  type Flash,
} from './AddHeroesPanel.constants';
import { CharacterRow, MemberRow } from './AddHeroesPanelRows';
import { styles } from './AddHeroesPanel.styles';

export function AddHeroesPanel({
  flash,
  onAdded,
  onBuild,
}: {
  flash: Flash;
  onAdded: () => void;
  onBuild: (heroIds: string[]) => void;
}) {
  // Default to "By name" so the panel opens without firing any ComicVine request —
  // discovery modes (Popular gaps) fetch on entry, which isn't always wanted.
  const [mode, setMode] = useState<Mode>('name');
  // Same breakpoint as CommandShell/Panel — the mode-chip scroller bleeds to the
  // card edge, and the bleed must match the panel pad in force at this width.
  const { width } = useWindowDimensions();
  const narrow = width < 760;
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
      .finally(() =>
        setDetailLoading((p) => {
          const s = new Set(p);
          s.delete(id);
          return s;
        }),
      );
  };

  // Poll the live build stage of this session's heroes so the roster reflects
  // progress (queued → ComicVine → … → built) and doesn't sit stale after a build.
  useEffect(() => {
    if (addedSession.length === 0) {
      // Nothing added yet — clear the poll map. Effect polls a live build stage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStages({});
      return;
    }
    let alive = true;
    const ids = addedSession.map((a) => a.heroId);
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
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [addedSession]);
  const builtCount = addedSession.filter((a) => stages[a.heroId] === 'done').length;

  // Dedup against search results is by ComicVine id; build/delete use the hero id.
  const addedIds = useMemo(() => new Set(addedSession.map((a) => a.comicvineId)), [addedSession]);
  const reset = () => {
    setChars([]);
    setGroups([]);
    setGroup(null);
    setMembers([]);
    setSelected(new Set());
    setExpandedId(null);
  };
  const isIn = (id: string) => existingIds.has(id) || addedIds.has(id);
  const isDup = (id: string, name: string) =>
    !isIn(id) && existingNames.has(name.toLowerCase().trim());

  // Scan popular characters to surface gaps. The catalogue is popularity-seeded,
  // so the top pages are mostly already in it and we need to cover a lot of ground.
  // Fetch a batch of pages in parallel (instead of one slow sequential page at a
  // time) and run the catalogue-existence checks together — a click resolves in
  // one round-trip's worth of latency rather than a dozen stacked on each other.
  const PAGE = 100; // ComicVine's max page size — fewer, denser calls
  const BATCH_PAGES = 3; // pages fetched per click, concurrently
  const loadPopular = async (off: number, append: boolean) => {
    if (append) setPopularLoading(true);
    else setLoading(true);
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
    } catch (e) {
      flash(`Couldn't load popular: ${(e as Error).message}`, 'error');
    } finally {
      if (append) setPopularLoading(false);
      else setLoading(false);
    }
  };

  // Load the first page of popular gaps when that mode is entered.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== 'popular') return;
    setPopularEnd(false);
    setSelected(new Set());
    loadPopular(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Live (debounced) search whenever the query or mode changes.
  useEffect(() => {
    if (mode === 'popular') return; // discovery mode handles its own loading
    if (group) return; // browsing a roster, don't re-search
    if (query.trim().length < 2) {
      // Too short to search — clear results. `reset` sets state internally.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reset();
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        if (mode === 'name') {
          const r = await searchComicvineCharacters(query);
          if (!active) return;
          setChars(r);
          setGroups([]);
          setSelected(new Set());
          setExistingIds(await existingComicvineIds(r.map((c) => c.id)));
          setExistingNames(await existingHeroNames(r.map((c) => c.name)));
        } else {
          const r = await searchComicvineGroups(mode as GroupResource, query);
          if (!active) return;
          setGroups(r);
          setChars([]);
        }
      } catch (e) {
        if (active) flash(`Search failed: ${(e as Error).message}`, 'error');
      } finally {
        if (active) setLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode]);

  const openGroup = async (g: CvGroup) => {
    setGroup(g);
    setLoading(true);
    setSelected(new Set());
    try {
      const m = await getComicvineGroupMembers(mode as GroupResource, g.id);
      setMembers(m.characters);
      setExistingIds(await existingComicvineIds(m.characters.map((c) => c.id)));
      setExistingNames(await existingHeroNames(m.characters.map((c) => c.name)));
    } catch (e) {
      flash(`Load failed: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // The current addable rows (characters in name mode, members in group mode).
  const rows = useMemo(
    () =>
      mode === 'name' || mode === 'popular'
        ? chars.map((c) => ({ id: c.id, name: c.name }))
        : members,
    [mode, chars, members],
  );
  const newRows = rows.filter((r) => !isIn(r.id));

  const toggle = (id: string) =>
    setSelected((p) => {
      const s = new Set(p);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const selectAllNew = () => setSelected(new Set(newRows.map((r) => r.id)));
  const clearSel = () => setSelected(new Set());

  // Add a set of characters to the catalogue (as pending). Shared by the toolbar
  // "Add N" (the whole selection) and the inline preview's one-tap "Add". Returns
  // the ids actually added (new ones), so callers can chain a build.
  const addByIds = async (rawCvIds: string[]): Promise<string[]> => {
    const cvIds = rawCvIds.filter((id) => !isIn(id));
    if (cvIds.length === 0) return [];
    const meta = new Map(
      cvIds.map((id) => {
        const c = chars.find((x) => x.id === id);
        const m = members.find((x) => x.id === id);
        const d = detailCache[id];
        return [
          id,
          { name: c?.name ?? m?.name ?? d?.name ?? '', image: c?.image ?? d?.image ?? null },
        ];
      }),
    );
    const payload = cvIds.map((id) => ({
      id,
      name: meta.get(id)!.name,
      image: meta.get(id)!.image,
    }));
    setBusy(true);
    try {
      // The RPC returns the minted internal hero ids (source-neutral) — track those.
      const added = await addComicvineHeroes(payload);
      const items: AddedHero[] = added.map((a) => ({
        heroId: a.heroId,
        comicvineId: a.comicvineId,
        name: meta.get(a.comicvineId)?.name ?? '',
        image: meta.get(a.comicvineId)?.image ?? null,
      }));
      setAddedSession((p) => [
        ...items.filter((x) => !p.some((a) => a.comicvineId === x.comicvineId)),
        ...p,
      ]);
      setRosterOpen(true);
      // Drop just-added ids from the selection; keep any other ticked rows intact.
      setSelected((p) => {
        const s = new Set(p);
        cvIds.forEach((id) => s.delete(id));
        return s;
      });
      flash(
        `Added ${added.length} hero${added.length === 1 ? '' : 'es'} — pending at step 1.`,
        'success',
      );
      onAdded();
      return items.map((x) => x.heroId);
    } catch (e) {
      flash(`Add failed: ${(e as Error).message}`, 'error');
      return [];
    } finally {
      setBusy(false);
    }
  };
  const addSelected = () => addByIds([...selected]);
  // One-shot bulk: add every new row in the current view and immediately build them.
  const addAllNewAndBuild = async () => {
    const addedHeroIds = await addByIds(newRows.map((r) => r.id));
    if (addedHeroIds.length > 0) onBuild(addedHeroIds);
  };

  // Undo a just-added character — delete it from the catalogue and drop it here.
  const removeAdded = async (a: AddedHero) => {
    setRemoving((p) => new Set(p).add(a.heroId));
    try {
      await deleteHero(a.heroId);
      setAddedSession((p) => p.filter((x) => x.comicvineId !== a.comicvineId));
      flash(`Removed ${a.name}.`, 'info');
      onAdded();
    } catch (e) {
      flash(`Remove failed: ${(e as Error).message}`, 'error');
    } finally {
      setRemoving((p) => {
        const s = new Set(p);
        s.delete(a.heroId);
        return s;
      });
    }
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
      action={
        <InfoTip text="Not sure what's missing? Start with '★ Popular gaps' — ComicVine's most-published characters that aren't in your catalogue yet, most-appeared first. Or live-search by name, team, series, creator, film, publisher or power. Tap any result to preview its real name, powers, first appearance and more before adding. Tick the ones you want (or 'Select all new') and Add — or 'Add all & build' to do the whole new set in one go. Already-in-catalogue and same-name duplicates are flagged." />
      }
    >
      {/* Mode + live search. One horizontally-scrollable row so the 8 chips never
          wrap to a second line (esp. on mobile). Bleeds to the card edges so the
          cut-off chip signals "scroll me" instead of looking clipped. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.modeScroll, narrow && styles.modeScrollNarrow]}
        contentContainerStyle={[styles.modeRow, narrow && styles.modeRowNarrow]}
      >
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => {
              setMode(m.key);
              setQuery('');
              reset();
            }}
            style={[styles.modePill, mode === m.key && styles.modePillOn]}
          >
            <Text style={[styles.modePillText, mode === m.key && styles.modePillTextOn]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {mode === 'popular' ? (
        <Text style={styles.popularHint}>
          ComicVine’s most-published characters that aren’t in your catalogue yet — top appearances
          first. Tick the ones worth adding.
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
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.orange} />
          ) : query.length > 0 ? (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.grey} />
            </Pressable>
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
                <View style={styles.groupIcon}>
                  <Ionicons name={GROUP_ICON[mode] ?? 'book'} size={16} color={COLORS.orange} />
                </View>
              )}
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {g.name}
                </Text>
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
            <Pressable
              onPress={() => {
                setGroup(null);
                setMembers([]);
                clearSel();
              }}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={15} color={COLORS.navy} />
              <Text style={styles.backText} numberOfLines={1}>
                {group.name}
              </Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Text style={styles.countText}>
            {newRows.length} new{rows.length ? ` of ${rows.length}` : ''}
          </Text>
          {group ? (
            <Pressable
              onPress={() => setNewOnly((v) => !v)}
              style={[styles.miniToggle, newOnly && styles.miniToggleOn]}
            >
              <Text style={[styles.miniToggleText, newOnly && styles.miniToggleTextOn]}>
                New only
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={selectAllNew}
            disabled={newRows.length === 0}
            style={[styles.linkBtn, newRows.length === 0 && styles.dim]}
          >
            <Text style={styles.linkText}>Select all new</Text>
          </Pressable>
          <Pressable
            onPress={addSelected}
            disabled={busy || selected.size === 0}
            style={[styles.addBtn, (busy || selected.size === 0) && styles.dim]}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="add" size={15} color="#fff" />
            )}
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
        loading && chars.length === 0 ? (
          <ActivityIndicator color={COLORS.orange} style={{ marginTop: 14 }} />
        ) : (
          <ScrollView style={styles.scroll} nestedScrollEnabled>
            {newRows.length === 0 && !loading ? (
              <Text style={styles.empty}>
                No gaps on the pages loaded so far — they’re all in your catalogue. Load more to dig
                deeper.
              </Text>
            ) : null}
            {chars
              .filter((c) => !isIn(c.id))
              .map((c) => (
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
        loading ? (
          <ActivityIndicator color={COLORS.orange} style={{ marginTop: 14 }} />
        ) : (
          <ScrollView style={styles.scroll} nestedScrollEnabled>
            {memberView.map((m) => (
              <MemberRow
                key={m.id}
                m={m}
                selected={selected.has(m.id)}
                inCat={isIn(m.id)}
                dup={isDup(m.id, m.name)}
                expanded={expandedId === m.id}
                detail={detailCache[m.id]}
                detailLoading={detailLoading.has(m.id)}
                busy={busy}
                onToggleSelect={() => !isIn(m.id) && toggle(m.id)}
                onToggleExpand={() => toggleExpand(m.id)}
                onAdd={() => addByIds([m.id])}
              />
            ))}
            {memberView.length === 0 ? (
              <Text style={styles.empty}>
                {newOnly ? 'No new members — all in catalogue.' : 'No members.'}
              </Text>
            ) : null}
            {memberTruncated > 0 ? (
              <Text style={styles.empty}>
                Showing first {ROSTER_CAP.toLocaleString()} of{' '}
                {(memberView.length + memberTruncated).toLocaleString()}
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
            <Ionicons
              name={rosterOpen ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={COLORS.navy}
            />
            <Pressable
              onPress={() => onBuild(addedSession.map((a) => a.heroId))}
              style={styles.loopBtn}
            >
              <Ionicons name="construct" size={12} color="#fff" />
              <Text style={styles.loopBtnText}>Build {addedSession.length}</Text>
            </Pressable>
          </Pressable>
          {rosterOpen ? (
            <View style={styles.addedList}>
              {addedSession.map((a) => {
                const busyThis = removing.has(a.heroId);
                return (
                  <View key={a.comicvineId} style={styles.addedRow}>
                    <HeroThumb uri={a.image} width={28} height={37} radius={5} />
                    <Text style={styles.addedName} numberOfLines={1}>
                      {a.name}
                    </Text>
                    {(() => {
                      const st = stages[a.heroId];
                      const badge = st ? STAGE_BADGE[st] : null;
                      return badge ? (
                        <Text style={[styles.stageBadge, { color: badge.color }]} numberOfLines={1}>
                          {badge.label}
                        </Text>
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
