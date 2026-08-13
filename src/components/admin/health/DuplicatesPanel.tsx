// Possible-duplicates review: same-name heroes where one row is unlinked (no
// comicvine_id) next to its linked twin — the realistic duplicate case. Pick the
// survivor, mark any genuinely-distinct same-name character as "separate", and
// merge the rest in one click (admin_merge_heroes repoints data + deletes losers).
// Renders nothing when the catalogue is clean.
import { useEffect, useState, useCallback } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { Panel } from './Panel';
import { InfoTip } from './InfoTip';
import { HeroThumb } from './atoms';
import {
  listDuplicateGroups,
  mergeHeroes,
  type DupGroup,
  type DupHero,
} from '../../../lib/db/dedup';

type Flash = (msg: string, tone?: 'info' | 'success' | 'error' | 'pending') => void;

// The most canonical row to keep: prefer a linked (comicvine_id) row, then the
// most-published, as the default survivor.
function defaultWinner(heroes: DupHero[]): string {
  const ranked = [...heroes].sort((a, b) => {
    const link = Number(!!b.comicvineId) - Number(!!a.comicvineId);
    if (link !== 0) return link;
    return (b.issueCount ?? 0) - (a.issueCount ?? 0);
  });
  return ranked[0].heroId;
}

export function DuplicatesPanel({ flash, onChanged }: { flash: Flash; onChanged: () => void }) {
  const [groups, setGroups] = useState<DupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState<Record<string, string>>({});
  const [separate, setSeparate] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = await listDuplicateGroups(60);
      setGroups(g);
      setWinner(Object.fromEntries(g.map((grp) => [grp.name, defaultWinner(grp.heroes)])));
      setSeparate(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount. `load` sets loading/data state internally.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const mergeGroup = async (grp: DupGroup) => {
    const win = winner[grp.name];
    const losers = grp.heroes.filter((h) => h.heroId !== win && !separate.has(h.heroId));
    if (!win || losers.length === 0) return;
    setBusy(grp.name);
    try {
      for (const l of losers) await mergeHeroes(l.heroId, win);
      flash(
        `Merged ${losers.length} duplicate${losers.length === 1 ? '' : 's'} into ${grp.name}.`,
        'success',
      );
      onChanged();
      await load();
    } catch (e) {
      flash(`Merge failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Panel title="Possible duplicates" hint="Scanning the catalogue…">
        <ActivityIndicator color={COLORS.orange} style={{ marginVertical: 10 }} />
      </Panel>
    );
  }
  if (groups.length === 0) return null; // clean — nothing to show

  return (
    <Panel
      title="Possible duplicates"
      hint={`${groups.length} same-name group${groups.length === 1 ? '' : 's'} to review`}
      action={
        <InfoTip text="Same-name heroes where at least one row isn't linked to ComicVine — the usual sign of a duplicate (e.g. a legacy import next to its ComicVine twin). Pick the row to keep, mark any genuinely-different character as 'separate', then Merge — the kept row absorbs the others' curated data, favourites and Wikidata identity, and the duplicates are deleted." />
      }
    >
      <View style={styles.groups}>
        {groups.map((grp) => {
          const win = winner[grp.name];
          const toMerge = grp.heroes.filter(
            (h) => h.heroId !== win && !separate.has(h.heroId),
          ).length;
          return (
            <View key={grp.name} style={styles.group}>
              <Text style={styles.groupName} numberOfLines={1}>
                {grp.name}
              </Text>
              {grp.heroes.map((h) => {
                const isWinner = h.heroId === win;
                const isSeparate = separate.has(h.heroId);
                return (
                  <View key={h.heroId} style={styles.row}>
                    <Pressable
                      onPress={() => setWinner((w) => ({ ...w, [grp.name]: h.heroId }))}
                      style={styles.radio}
                      accessibilityLabel={`Keep ${h.name} (${h.heroId})`}
                    >
                      <View style={[styles.radioDot, isWinner && styles.radioDotOn]}>
                        {isWinner ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
                      </View>
                    </Pressable>
                    <HeroThumb uri={h.imageUrl} width={30} height={40} radius={6} />
                    <View style={styles.meta}>
                      <Text style={styles.name} numberOfLines={1}>
                        {h.name}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {h.comicvineId ? `CV ${h.comicvineId}` : 'unlinked'}
                        {h.publisher ? ` · ${h.publisher}` : ''}
                        {h.issueCount != null ? ` · ${h.issueCount.toLocaleString()} issues` : ''}
                      </Text>
                    </View>
                    {isWinner ? (
                      <Text style={styles.keepTag}>keep</Text>
                    ) : (
                      <Pressable
                        onPress={() =>
                          setSeparate((s) => {
                            const n = new Set(s);
                            if (n.has(h.heroId)) n.delete(h.heroId);
                            else n.add(h.heroId);
                            return n;
                          })
                        }
                        style={[styles.sepBtn, isSeparate && styles.sepBtnOn]}
                      >
                        <Text style={[styles.sepText, isSeparate && styles.sepTextOn]}>
                          {isSeparate ? 'separate' : 'merge'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
              <Pressable
                onPress={() => mergeGroup(grp)}
                disabled={busy === grp.name || toMerge === 0}
                style={[styles.mergeBtn, (busy === grp.name || toMerge === 0) && styles.dim]}
              >
                {busy === grp.name ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="git-merge" size={14} color="#fff" />
                )}
                <Text style={styles.mergeText}>
                  {toMerge > 0 ? `Merge ${toMerge} into kept` : 'Nothing to merge'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  groups: { gap: 14 },
  group: { gap: 6 },
  groupName: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.navy },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  radio: { padding: 2 },
  radioDot: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(41,60,67,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotOn: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  meta: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black },
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11.5,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  keepTag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.green,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sepBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: COLORS.orange + '1a',
  },
  sepBtnOn: { backgroundColor: '#efe6d6' },
  sepText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.orange },
  sepTextOn: { color: COLORS.grey },
  mergeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    backgroundColor: COLORS.navy,
    borderRadius: 9,
    paddingVertical: 9,
  },
  mergeText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: '#fff' },
  dim: { opacity: 0.4 },
});
