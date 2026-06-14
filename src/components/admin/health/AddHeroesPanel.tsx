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
  searchComicvineGroups,
  getComicvineGroupMembers,
  existingComicvineIds,
  existingHeroNames,
  addComicvineHeroes,
  type CvCharacter,
  type CvGroup,
  type GroupResource,
} from '../../../lib/db/cvIngest';

type Mode = 'name' | 'team' | 'volume';
type Flash = (msg: string, tone?: 'info' | 'success' | 'error' | 'pending') => void;
const MODES: { key: Mode; label: string }[] = [
  { key: 'name', label: 'By name' },
  { key: 'team', label: 'By team' },
  { key: 'volume', label: 'By series' },
];

export function AddHeroesPanel({
  flash, onAdded, onEnrich,
}: { flash: Flash; onAdded: () => void; onEnrich: () => void }) {
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
  const [addedSession, setAddedSession] = useState<Set<string>>(new Set());
  const [newOnly, setNewOnly] = useState(true);

  const reset = () => { setChars([]); setGroups([]); setGroup(null); setMembers([]); setSelected(new Set()); };
  const isIn = (id: string) => existingIds.has(id) || addedSession.has(id);
  const isDup = (id: string, name: string) => !isIn(id) && existingNames.has(name.toLowerCase().trim());

  // Live (debounced) search whenever the query or mode changes.
  useEffect(() => {
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
    () => (mode === 'name' ? chars.map((c) => ({ id: c.id, name: c.name })) : members),
    [mode, chars, members],
  );
  const newRows = rows.filter((r) => !isIn(r.id));

  const toggle = (id: string) =>
    setSelected((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectAllNew = () => setSelected(new Set(newRows.map((r) => r.id)));
  const clearSel = () => setSelected(new Set());

  const addSelected = async () => {
    const ids = [...selected].filter((id) => !isIn(id));
    if (ids.length === 0) return;
    const payload = ids.map((id) => {
      const c = chars.find((x) => x.id === id);
      const m = members.find((x) => x.id === id);
      return { id, name: c?.name ?? m?.name ?? '', image: c?.image ?? null };
    });
    setBusy(true);
    try {
      const n = await addComicvineHeroes(payload);
      setAddedSession((p) => { const s = new Set(p); ids.forEach((id) => s.add(id)); return s; });
      setSelected(new Set());
      flash(`Added ${n} hero${n === 1 ? '' : 'es'} — pending at step 1.`, 'success');
      onAdded();
    } catch (e) { flash(`Add failed: ${(e as Error).message}`, 'error'); }
    finally { setBusy(false); }
  };

  const memberView = group ? (newOnly ? members.filter((m) => !isIn(m.id)) : members) : [];

  return (
    <Panel
      title="Add heroes · ComicVine"
      hint="Step 0 — bring new characters in. Search a name, a team, or a comic series; added heroes flow into step 1."
      action={<InfoTip text="Live-search ComicVine by character name, team, or comic series. Tick the ones you want (or 'Select all new'), Add them, then 'Enrich now' to build them. Already-in-catalogue and same-name duplicates are flagged." />}
    >
      {/* Mode + live search */}
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Pressable key={m.key} onPress={() => { setMode(m.key); setQuery(''); reset(); }} style={[styles.modePill, mode === m.key && styles.modePillOn]}>
            <Text style={[styles.modePillText, mode === m.key && styles.modePillTextOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      {!group ? (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.grey} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={mode === 'name' ? 'Character name… (e.g. Darth Vader)' : mode === 'team' ? 'Team name… (e.g. Jedi Order)' : 'Comic series… (e.g. Star Wars)'}
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
            <Pressable key={g.id} onPress={() => openGroup(g)} style={styles.row}>
              <View style={styles.groupIcon}><Ionicons name={mode === 'team' ? 'people' : 'book'} size={16} color={COLORS.orange} /></View>
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
      {(mode === 'name' && chars.length > 0) || group ? (
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
        </View>
      ) : null}

      {/* Name results (with art) */}
      {mode === 'name' && chars.length > 0 ? (
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          {chars.map((c) => (
            <Pressable key={c.id} onPress={() => !isIn(c.id) && toggle(c.id)} style={styles.row}>
              <Checkbox checked={selected.has(c.id)} disabled={isIn(c.id)} />
              <HeroThumb uri={c.image} width={32} height={42} radius={6} />
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>{c.publisher ?? c.deck ?? '—'}</Text>
              </View>
              <StatusBadge inCat={isIn(c.id)} dup={isDup(c.id, c.name)} />
            </Pressable>
          ))}
        </ScrollView>
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
          </ScrollView>
        )
      ) : null}

      {/* Close the loop */}
      {addedSession.size > 0 ? (
        <View style={styles.loopBar}>
          <Ionicons name="information-circle" size={15} color={COLORS.orange} />
          <Text style={styles.loopText}>{addedSession.size} added this session — pending at step 1.</Text>
          <Pressable onPress={onEnrich} style={styles.loopBtn}>
            <Ionicons name="play" size={12} color="#fff" />
            <Text style={styles.loopBtnText}>Enrich now</Text>
          </Pressable>
        </View>
      ) : null}
    </Panel>
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
  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  modePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#efe6d6' },
  modePillOn: { backgroundColor: COLORS.navy },
  modePillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  modePillTextOn: { color: '#fff' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f6f0e6', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
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

  scroll: { maxHeight: 300, marginTop: 8 } as object,
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)' },
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

  loopBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: COLORS.orange + '12', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  loopText: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  loopBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.orange, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  loopBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
});
