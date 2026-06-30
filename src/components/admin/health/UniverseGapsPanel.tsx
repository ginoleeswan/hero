// Universe gaps: characters still parked in the 'Company-Licensed' catch-all with
// no real franchise. ComicVine gives the comic house, not the franchise, so there
// is no reliable auto-signal — assignment is editorial. This panel makes it a
// fast drain: it clusters characters by their best-guess franchise so a whole
// cast (e.g. nine Muppets) is placed in one click, lets you correct or exclude
// individuals before applying, places the long-tail singletons inline with
// canonical-name quick-picks, and keeps the last placement undoable. Rows leave
// the list the instant they're placed and the count ticks down; placing a hero
// also makes it fame-eligible. Shows a cleared state when the bucket is drained.
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { Panel } from './Panel';
import { InfoTip } from './InfoTip';
import { HeroThumb } from './atoms';
import { setHeroUniverse, type UnbrandedHero } from '../../../lib/db/catalogHealth';
import { refreshFameScores } from '../../../lib/db/build';
import { searchUniverses } from '../../../lib/db/universes';

type Flash = (msg: string, tone?: 'info' | 'success' | 'error' | 'pending') => void;

const CATCH_ALL = 'Company-Licensed';
const CLUSTER_MIN = 2; // a franchise guess shared by this many becomes a bulk cluster

// Best-effort franchise guess from ComicVine team membership — a pre-fill the
// admin accepts or overrides, never an auto-write (generic teams make it
// unreliable on its own; the Muppets are not Sesame Street).
const SUGGESTERS: [RegExp, string][] = [
  [
    /jedi|sith|rebel alliance|galactic republic|mandalor|ithorian|wookie|t'?surr|abednedo/i,
    'Star Wars',
  ],
  [/minbari|psi corps|grey council|narn|centauri/i, 'Babylon 5'],
  [/muppet/i, 'The Muppets'],
  [/nests|k' team|kof/i, 'SNK'],
];
function suggestFranchise(teams: string[] | null): string {
  const hay = (teams ?? []).join(' ');
  for (const [re, franchise] of SUGGESTERS) if (re.test(hay)) return franchise;
  return '';
}

const cvUrl = (id: string | null) =>
  id ? `https://comicvine.gamespot.com/character/4005-${id}/` : null;

function CvLink({ id }: { id: string | null }) {
  const url = cvUrl(id);
  return (
    <>
      <Text style={styles.cv}>cv-{id ?? '?'}</Text>
      {url ? (
        <Pressable
          onPress={() => Linking.openURL(url)}
          hitSlop={6}
          accessibilityLabel="Open in ComicVine"
        >
          <Ionicons name="open-outline" size={13} color={COLORS.grey} />
        </Pressable>
      ) : null}
    </>
  );
}

// ── A franchise cluster: one editable universe applied to a selected cast ──────
function ClusterCard({
  universe,
  heroes,
  busyIds,
  onApply,
}: {
  universe: string;
  heroes: UnbrandedHero[];
  busyIds: Set<string>;
  onApply: (ids: string[], universe: string) => void;
}) {
  const [value, setValue] = useState(universe);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const busy = heroes.some((h) => busyIds.has(h.id));

  const selectedIds = heroes.filter((h) => !excluded.has(h.id)).map((h) => h.id);
  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canApply = !!value.trim() && selectedIds.length > 0 && !busy;

  return (
    <View style={styles.cluster}>
      <View style={styles.clusterHead}>
        <View style={styles.avatarStack}>
          {heroes.slice(0, 3).map((h, i) => (
            <View key={h.id} style={[styles.avatarSlot, i > 0 && styles.avatarOverlap]}>
              <HeroThumb uri={h.image} size={26} radius={7} />
            </View>
          ))}
        </View>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Universe…"
          placeholderTextColor={COLORS.grey}
          style={styles.clusterInput}
          editable={!busy}
          onSubmitEditing={() => canApply && onApply(selectedIds, value)}
          returnKeyType="done"
        />
        <Pressable
          onPress={() => canApply && onApply(selectedIds, value)}
          disabled={!canApply}
          style={[styles.bulkBtn, !canApply && styles.btnOff]}
          accessibilityLabel={`Set ${selectedIds.length} characters to ${value}`}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.bulkText}>Set {selectedIds.length}</Text>
          )}
        </Pressable>
      </View>
      <View style={styles.members}>
        {heroes.map((h) => {
          const on = !excluded.has(h.id);
          return (
            <Pressable
              key={h.id}
              style={styles.member}
              onPress={() => toggle(h.id)}
              disabled={busy}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={h.name}
            >
              <Ionicons
                name={on ? 'checkbox' : 'square-outline'}
                size={17}
                color={on ? COLORS.orange : COLORS.grey}
              />
              <HeroThumb uri={h.image} size={22} radius={6} />
              <Text style={[styles.memberName, !on && styles.memberOff]} numberOfLines={1}>
                {h.name}
              </Text>
              <CvLink id={h.comicvineId} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── A long-tail singleton: free text with canonical quick-picks ───────────────
function LooseRow({
  hero,
  busy,
  onApply,
}: {
  hero: UnbrandedHero;
  busy: boolean;
  onApply: (ids: string[], universe: string) => void;
}) {
  const [value, setValue] = useState(() => suggestFranchise(hero.teams));
  const sub = (hero.teams ?? []).length > 0 ? (hero.teams ?? []).join(' · ') : hero.hint;
  const picks = useMemo(() => {
    const q = value.trim();
    if (q.length < 2) return [];
    return searchUniverses(q, 3).filter((u) => u.name.toLowerCase() !== q.toLowerCase());
  }, [value]);

  const place = () => {
    if (value.trim() && !busy) onApply([hero.id], value);
  };

  return (
    <View style={styles.looseWrap}>
      <View style={styles.row}>
        <HeroThumb uri={hero.image} size={34} />
        <View style={styles.info}>
          <View style={styles.nameLine}>
            <Text style={styles.name} numberOfLines={1}>
              {hero.name}
            </Text>
            <CvLink id={hero.comicvineId} />
          </View>
          {sub ? (
            <Text style={styles.sub} numberOfLines={1}>
              {sub}
            </Text>
          ) : (
            <Text style={styles.subEmpty}>no team hint — identify via ComicVine</Text>
          )}
        </View>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Universe…"
          placeholderTextColor={COLORS.grey}
          style={styles.input}
          editable={!busy}
          onSubmitEditing={place}
          returnKeyType="done"
        />
        <Pressable
          onPress={place}
          disabled={busy || !value.trim()}
          style={[styles.setBtn, (busy || !value.trim()) && styles.btnOff]}
          accessibilityLabel={`Set ${hero.name}'s universe`}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.setText}>Set</Text>
          )}
        </Pressable>
      </View>
      {picks.length > 0 ? (
        <View style={styles.picks}>
          {picks.map((u) => (
            <Pressable key={u.slug} style={styles.pick} onPress={() => setValue(u.name)}>
              <Text style={styles.pickText}>{u.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function UniverseGapsPanel({
  heroes,
  loading,
  flash,
  onChanged,
}: {
  heroes: UnbrandedHero[];
  loading: boolean;
  flash: Flash;
  onChanged: () => void;
}) {
  // Optimistic drain: placed heroes leave the list immediately, before the refetch.
  const [placed, setPlaced] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ ids: string[]; universe: string } | null>(null);
  const [undoing, setUndoing] = useState(false);

  const visible = useMemo(() => heroes.filter((h) => !placed.has(h.id)), [heroes, placed]);

  const { clusters, loose } = useMemo(() => {
    const byU = new Map<string, UnbrandedHero[]>();
    const singles: UnbrandedHero[] = [];
    for (const h of visible) {
      const s = suggestFranchise(h.teams);
      if (!s) singles.push(h);
      else byU.set(s, [...(byU.get(s) ?? []), h]);
    }
    const clusters: { universe: string; heroes: UnbrandedHero[] }[] = [];
    for (const [universe, hs] of byU) {
      if (hs.length >= CLUSTER_MIN) clusters.push({ universe, heroes: hs });
      else singles.push(...hs);
    }
    clusters.sort((a, b) => b.heroes.length - a.heroes.length);
    return { clusters, loose: singles };
  }, [visible]);

  // Never appeared (clean catch-all) → render nothing.
  if (!loading && heroes.length === 0) return null;

  const nameOf = (id: string) => heroes.find((h) => h.id === id)?.name ?? 'character';

  const apply = async (ids: string[], universe: string) => {
    const u = universe.trim();
    if (!u || ids.length === 0) return;
    setBusyIds((prev) => new Set([...prev, ...ids]));
    try {
      for (const id of ids) await setHeroUniverse(id, u);
      await refreshFameScores(); // placed → now fame-eligible
      setPlaced((prev) => new Set([...prev, ...ids]));
      setUndo({ ids, universe: u });
      flash(
        ids.length === 1 ? `${nameOf(ids[0])} → ${u}` : `Placed ${ids.length} characters → ${u}`,
        'success',
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not set universe.', 'error');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      onChanged(); // reconcile with server truth (covers partial-batch failure)
    }
  };

  const revert = async () => {
    if (!undo || undoing) return;
    const { ids, universe } = undo;
    setUndoing(true);
    try {
      for (const id of ids) await setHeroUniverse(id, CATCH_ALL);
      await refreshFameScores();
      setPlaced((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setUndo(null);
      flash(`Reverted ${ids.length} from ${universe} back to the catch-all.`, 'info');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not undo.', 'error');
    } finally {
      setUndoing(false);
      onChanged();
    }
  };

  const copyList = async () => {
    const text = visible
      .map((h) => `${h.name}\t${h.id}\tcv-${h.comicvineId ?? '?'}\t${(h.teams ?? []).join('/')}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      flash(`Copied ${visible.length} unbranded characters.`, 'success');
    } catch {
      flash('Could not copy to clipboard.', 'error');
    }
  };

  const allDone = !loading && visible.length === 0;

  return (
    <Panel
      title="Needs a universe"
      hint={
        allDone
          ? 'Catch-all cleared'
          : `${visible.length} character${visible.length === 1 ? '' : 's'} still in the Company-Licensed catch-all`
      }
      action={
        <InfoTip text="ComicVine gives the comic publisher, not the franchise, so these can't be auto-placed. Characters that share a best-guess franchise are grouped — correct the universe once and Set the whole cast (uncheck any that don't belong). Singletons place inline with canonical name suggestions. Placing a hero makes it fame-eligible; the last placement can be undone. Newly-ingested licensed characters land here." />
      }
    >
      {loading ? (
        <ActivityIndicator color={COLORS.orange} style={styles.loader} />
      ) : allDone ? (
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={26} color={COLORS.green} />
          <Text style={styles.doneText}>Every character has a universe.</Text>
          {undo ? (
            <Pressable onPress={revert} disabled={undoing} style={styles.undoInline}>
              <Text style={styles.undoText}>{undoing ? 'Undoing…' : 'Undo last'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          {undo ? (
            <View style={styles.undoBar}>
              <Ionicons name="arrow-undo-outline" size={15} color={COLORS.navy} />
              <Text style={styles.undoBarText} numberOfLines={1}>
                Placed {undo.ids.length} → {undo.universe}
              </Text>
              <Pressable onPress={revert} disabled={undoing} hitSlop={6}>
                <Text style={styles.undoText}>{undoing ? 'Undoing…' : 'Undo'}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable style={styles.copyBtn} onPress={copyList} accessibilityRole="button">
            <Ionicons name="copy-outline" size={14} color={COLORS.navy} />
            <Text style={styles.copyText}>Copy list</Text>
          </Pressable>

          {clusters.length > 0 ? (
            <View style={styles.clusterList}>
              {clusters.map((c) => (
                <ClusterCard
                  key={c.universe}
                  universe={c.universe}
                  heroes={c.heroes}
                  busyIds={busyIds}
                  onApply={apply}
                />
              ))}
            </View>
          ) : null}

          {loose.length > 0 ? (
            <>
              {clusters.length > 0 ? (
                <Text style={styles.looseHeading}>Identify individually</Text>
              ) : null}
              <View style={styles.list}>
                {loose.map((h) => (
                  <LooseRow key={h.id} hero={h} busy={busyIds.has(h.id)} onApply={apply} />
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  loader: { paddingVertical: 24 },

  // Done state
  done: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  doneText: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.navy },
  undoInline: { paddingVertical: 4, paddingHorizontal: 10 },

  // Undo bar
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(231,115,51,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.22)',
    marginBottom: 8,
  },
  undoBarText: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  undoText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange },

  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: 'rgba(41,60,67,0.06)',
    marginBottom: 10,
  },
  copyText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

  // Clusters
  clusterList: { gap: 10, marginBottom: 6 },
  cluster: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    backgroundColor: 'rgba(41,60,67,0.025)',
    padding: 10,
    gap: 8,
  },
  clusterHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatarSlot: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.beige,
    backgroundColor: COLORS.beige,
  },
  avatarOverlap: { marginLeft: -10 },
  clusterInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.2)',
    backgroundColor: '#fff',
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.black,
  },
  bulkBtn: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.orange,
  },
  bulkText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: '#fff' },
  members: { gap: 2 },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  memberName: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: COLORS.black },
  memberOff: { color: COLORS.grey, textDecorationLine: 'line-through' },

  // Loose rows
  looseHeading: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginTop: 4,
    marginBottom: 4,
  },
  list: { gap: 4 },
  looseWrap: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.06)',
    paddingBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  info: { flex: 1, minWidth: 0, gap: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black, flexShrink: 1 },
  cv: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  subEmpty: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11.5,
    color: COLORS.grey,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  input: {
    width: 150,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.18)',
    backgroundColor: '#fff',
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    color: COLORS.black,
  },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 44, paddingBottom: 4 },
  pick: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(41,60,67,0.06)',
  },
  pickText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.navy },

  setBtn: {
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    backgroundColor: COLORS.orange,
  },
  btnOff: { opacity: 0.4 },
  setText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: '#fff' },
});
