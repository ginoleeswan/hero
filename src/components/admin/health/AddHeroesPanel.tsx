// Step 0 of the pipeline — add new characters from ComicVine, by name or by
// whole team. Added heroes enter as 'pending' and flow into step 1.
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { Panel } from './Panel';
import { HeroThumb } from './atoms';
import { InfoTip } from './InfoTip';
import {
  searchComicvineCharacters,
  searchComicvineTeams,
  getComicvineTeamMembers,
  existingComicvineIds,
  addComicvineHeroes,
  type CvCharacter,
  type CvTeam,
} from '../../../lib/db/cvIngest';

type Mode = 'name' | 'team';
type Flash = (msg: string, tone?: 'info' | 'success' | 'error' | 'pending') => void;

export function AddHeroesPanel({ flash, onAdded }: { flash: Flash; onAdded: () => void }) {
  const [mode, setMode] = useState<Mode>('name');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [chars, setChars] = useState<CvCharacter[]>([]);
  const [teams, setTeams] = useState<CvTeam[]>([]);
  const [team, setTeam] = useState<CvTeam | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());

  const reset = () => { setChars([]); setTeams([]); setTeam(null); setMembers([]); };

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setLoading(true); reset();
    try {
      if (mode === 'name') {
        const r = await searchComicvineCharacters(query);
        setChars(r);
        setExisting(await existingComicvineIds(r.map((c) => c.id)));
      } else {
        setTeams(await searchComicvineTeams(query));
      }
    } catch (e) { flash(`Search failed: ${(e as Error).message}`, 'error'); }
    finally { setLoading(false); }
  };

  const openTeam = async (t: CvTeam) => {
    setTeam(t); setBusy(`team-${t.id}`);
    try {
      const m = await getComicvineTeamMembers(t.id);
      setMembers(m.characters);
      setExisting(await existingComicvineIds(m.characters.map((c) => c.id)));
    } catch (e) { flash(`Load failed: ${(e as Error).message}`, 'error'); }
    finally { setBusy(null); }
  };

  const addOne = async (c: CvCharacter) => {
    setBusy(`add-${c.id}`);
    try {
      const n = await addComicvineHeroes([{ id: c.id, name: c.name, image: c.image }]);
      setAdded((p) => new Set(p).add(c.id));
      flash(n > 0 ? `Added ${c.name} — run ComicVine to enrich.` : `${c.name} already in catalogue.`, 'success');
      onAdded();
    } catch (e) { flash(`Add failed: ${(e as Error).message}`, 'error'); }
    finally { setBusy(null); }
  };

  const addTeamNew = async () => {
    const toAdd = members.filter((m) => !existing.has(m.id) && !added.has(m.id));
    if (toAdd.length === 0) { flash('Nothing new to add.', 'info'); return; }
    setBusy('add-team');
    try {
      const n = await addComicvineHeroes(toAdd.map((m) => ({ id: m.id, name: m.name, image: null })));
      setAdded((p) => { const s = new Set(p); toAdd.forEach((m) => s.add(m.id)); return s; });
      flash(`Added ${n} new from ${team?.name ?? 'team'} — run ComicVine to enrich.`, 'success');
      onAdded();
    } catch (e) { flash(`Add failed: ${(e as Error).message}`, 'error'); }
    finally { setBusy(null); }
  };

  const isIn = (id: string) => existing.has(id) || added.has(id);
  const newCount = members.filter((m) => !isIn(m.id)).length;

  return (
    <Panel
      title="Add heroes · ComicVine"
      hint="Step 0 — bring new characters into the catalogue. They enter as pending and flow into step 1."
      action={<InfoTip text="Search ComicVine by character name, or pick a team to add its whole roster. Added heroes are inserted as 'pending' — run ComicVine (step 1) to fill in their powers, bio and art." />}
    >
      {/* Mode + search */}
      <View style={styles.modeRow}>
        {(['name', 'team'] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => { setMode(m); reset(); }} style={[styles.modePill, mode === m && styles.modePillOn]}>
            <Text style={[styles.modePillText, mode === m && styles.modePillTextOn]}>{m === 'name' ? 'By name' : 'By team'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.grey} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder={mode === 'name' ? 'Character name… (e.g. Darth Vader)' : 'Team name… (e.g. Jedi Order)'}
            placeholderTextColor={COLORS.grey}
            style={[styles.searchInput, { outlineStyle: 'none' }] as object}
          />
        </View>
        <Pressable onPress={runSearch} disabled={loading || query.trim().length < 2} style={[styles.searchBtn, (loading || query.trim().length < 2) && styles.dim]}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.searchBtnText}>Search</Text>}
        </Pressable>
      </View>

      {/* By name: character results */}
      {mode === 'name' && chars.length > 0 ? (
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          {chars.map((c) => {
            const inCat = isIn(c.id);
            const busyThis = busy === `add-${c.id}`;
            return (
              <View key={c.id} style={styles.row}>
                <HeroThumb uri={c.image} width={34} height={44} radius={7} />
                <View style={styles.meta}>
                  <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{c.publisher ?? c.deck ?? '—'}</Text>
                </View>
                {inCat ? (
                  <View style={styles.inChip}><Ionicons name="checkmark" size={13} color={COLORS.green} /><Text style={styles.inChipText}>In catalogue</Text></View>
                ) : (
                  <Pressable onPress={() => addOne(c)} disabled={!!busy} style={[styles.addBtn, !!busy && styles.dim]}>
                    {busyThis ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={15} color="#fff" />}
                    <Text style={styles.addBtnText}>Add</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {/* By team: team list, then roster */}
      {mode === 'team' && !team && teams.length > 0 ? (
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          {teams.map((t) => (
            <Pressable key={t.id} onPress={() => openTeam(t)} disabled={!!busy} style={styles.row}>
              <View style={styles.teamIcon}><Ionicons name="people" size={16} color={COLORS.orange} /></View>
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>{t.name}</Text>
                <Text style={styles.sub}>{t.members != null ? `${t.members} members` : 'team'}</Text>
              </View>
              {busy === `team-${t.id}` ? <ActivityIndicator size="small" color={COLORS.orange} /> : <Ionicons name="chevron-forward" size={16} color={COLORS.grey} />}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {mode === 'team' && team ? (
        <View>
          <View style={styles.teamHead}>
            <Pressable onPress={() => { setTeam(null); setMembers([]); }} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={15} color={COLORS.navy} />
              <Text style={styles.backText}>Teams</Text>
            </Pressable>
            <Text style={styles.teamName} numberOfLines={1}>{team.name} · {members.length} members</Text>
            <Pressable onPress={addTeamNew} disabled={!!busy || newCount === 0} style={[styles.addAllBtn, (!!busy || newCount === 0) && styles.dim]}>
              {busy === 'add-team' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={15} color="#fff" />}
              <Text style={styles.addBtnText}>Add {newCount} new</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} nestedScrollEnabled>
            {members.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                {isIn(m.id) ? <Text style={styles.memberIn}>in catalogue</Text> : <Text style={styles.memberNew}>new</Text>}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  modePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#efe6d6' },
  modePillOn: { backgroundColor: COLORS.navy },
  modePillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  modePillTextOn: { color: '#fff' },

  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f6f0e6', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  searchBtn: { backgroundColor: COLORS.orange, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, minWidth: 78, alignItems: 'center' },
  searchBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  dim: { opacity: 0.4 },

  scroll: { maxHeight: 300, marginTop: 10 } as object,
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  teamIcon: { width: 34, height: 44, borderRadius: 7, backgroundColor: COLORS.orange + '14', alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.orange, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  inChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inChipText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.green },

  teamHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  teamName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black, minWidth: 120 },
  addAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.orange, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  memberName: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.black },
  memberIn: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },
  memberNew: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.green },
});
