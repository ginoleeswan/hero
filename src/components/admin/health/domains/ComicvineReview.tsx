// ComicVine review queue (issue #93) — resolves heroes the collision gate
// flagged `needs_review` (an exact-name match whose publisher disagreed, or
// ambiguous same-name candidates). Each hero shows LIVE cv-search candidates
// (name · publisher · appearances) to accept inline, a manual-id escape hatch,
// and "Not on ComicVine". Accepting re-queues the hero so the drain re-enriches
// by the right id, overwriting the collision's bad data. Renders nothing when
// the queue is clear.
import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { InfoTip } from '../InfoTip';
import { HeroThumb, LoadMore } from '../ui';
import {
  listComicvineNeedsReview,
  countComicvineNeedsReview,
  acceptComicvineMatch,
  markComicvineUnmatched,
  type ComicvineReviewHero,
} from '../../../../lib/db/comicvineReview';
import {
  searchComicvineCharacters,
  existingComicvineIds,
  type CvCharacter,
} from '../../../../lib/db/cvIngest';

type Flash = (msg: string, tone?: 'info' | 'success' | 'error' | 'pending') => void;

const PAGE = 25;

// Same publisher-normalisation intent as the server gate — just enough to
// highlight the candidate that agrees with the hero's publisher (the likely fix).
function samePublisher(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const x = norm(a);
  const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}

export function ComicvineReview({ flash, onChanged }: { flash: Flash; onChanged: () => void }) {
  const [heroes, setHeroes] = useState<ComicvineReviewHero[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // Live candidates per hero id (null = loading, [] = none found).
  const [cands, setCands] = useState<Record<string, CvCharacter[] | null>>({});
  // Candidate ids already linked to another hero (accepting would collide).
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        listComicvineNeedsReview(limit),
        countComicvineNeedsReview(),
      ]);
      setHeroes(list);
      setTotal(count);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Fetch cv-search candidates for any hero we haven't looked up yet.
  useEffect(() => {
    const missing = heroes.filter((h) => !(h.id in cands));
    if (missing.length === 0) return;
    let alive = true;
    // Mark them loading so we don't refetch on the next render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCands((prev) => {
      const next = { ...prev };
      for (const h of missing) next[h.id] = null;
      return next;
    });
    (async () => {
      const results = await Promise.all(
        missing.map(async (h) => [h.id, await searchComicvineCharacters(h.name)] as const),
      );
      if (!alive) return;
      setCands((prev) => {
        const next = { ...prev };
        for (const [id, list] of results) next[id] = list;
        return next;
      });
      // Flag candidate ids already used elsewhere, so we can block a colliding accept.
      const allIds = results.flatMap(([, list]) => list.map((c) => c.id));
      if (allIds.length > 0) {
        const used = await existingComicvineIds(allIds);
        if (alive) setLinked((prev) => new Set([...prev, ...used]));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroes]);

  const removeHero = (id: string) => setHeroes((hs) => hs.filter((h) => h.id !== id));

  const accept = async (hero: ComicvineReviewHero, cvId: string) => {
    setBusy(`accept-${hero.id}`);
    try {
      await acceptComicvineMatch(hero.id, cvId);
      flash(`${hero.name} → CV ${cvId}; re-queued for enrichment.`, 'success');
      removeHero(hero.id);
      setTotal((t) => Math.max(0, t - 1));
      onChanged();
    } catch (e) {
      flash(`Accept failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const markUnmatched = async (hero: ComicvineReviewHero) => {
    setBusy(`unmatched-${hero.id}`);
    try {
      await markComicvineUnmatched(hero.id);
      flash(`${hero.name} marked "not on ComicVine".`, 'success');
      removeHero(hero.id);
      setTotal((t) => Math.max(0, t - 1));
      onChanged();
    } catch (e) {
      flash(`Failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading && heroes.length === 0) {
    return (
      <Panel title="ComicVine review" hint="Loading the queue…">
        <ActivityIndicator color={COLORS.orange} style={styles.spin} />
      </Panel>
    );
  }

  return (
    <Panel
      title="ComicVine review"
      hint={total > 0 ? `${total.toLocaleString()} to review` : 'Collision suspects land here'}
      action={
        <InfoTip text="Heroes whose ComicVine name-match was rejected because its publisher disagreed (or several same-name characters were ambiguous) — the cross-franchise collision guard. Pick the right ComicVine character to re-enrich from, paste an id manually, or mark it as not on ComicVine. Accepting re-queues the hero so the enrichment drain overwrites the bad data with the correct character." />
      }
    >
      {heroes.length === 0 ? (
        // A bare one-liner left the page looking unfinished — say what this
        // queue is for so the emptiness reads as a good sign, not a dead end.
        <View style={styles.allClear}>
          <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.green} />
          <Text style={styles.allClearTitle}>All clear — no collisions waiting on you.</Text>
          <Text style={styles.allClearSub}>
            When an enrichment’s name-match hits a publisher conflict or several same-name
            characters, the hero lands here for a human call. Empty means every match resolved
            cleanly.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {heroes.map((hero) => {
            const candidates = cands[hero.id];
            const busyThis = busy === `accept-${hero.id}` || busy === `unmatched-${hero.id}`;
            return (
              <View key={hero.id} style={styles.heroRow}>
                <View style={styles.who}>
                  <HeroThumb uri={hero.imageUrl} width={30} height={40} radius={6} />
                  <View style={styles.meta}>
                    <Text style={styles.name} numberOfLines={1}>
                      {hero.name}
                    </Text>
                    <Text style={styles.pub} numberOfLines={1}>
                      currently: {hero.publisher ?? '—'}
                    </Text>
                  </View>
                </View>

                {candidates === undefined || candidates === null ? (
                  <ActivityIndicator size="small" color={COLORS.grey} style={styles.candSpin} />
                ) : candidates.length === 0 ? (
                  <Text style={styles.noneFound}>No ComicVine characters by this name.</Text>
                ) : (
                  <View style={styles.candidates}>
                    {candidates.map((c) => {
                      const isLinked = linked.has(c.id);
                      const agrees = samePublisher(hero.publisher, c.publisher);
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => accept(hero, c.id)}
                          disabled={!!busy || isLinked}
                          style={[
                            styles.cand,
                            agrees && styles.candAgrees,
                            (!!busy || isLinked) && styles.dim,
                          ]}
                          accessibilityLabel={`Accept ${c.name} (CV ${c.id}) for ${hero.name}`}
                        >
                          <HeroThumb uri={c.image} width={28} height={38} radius={5} />
                          <View style={styles.candText}>
                            <Text style={styles.candName} numberOfLines={1}>
                              {c.name}
                              {agrees ? <Text style={styles.matchTag}>{'  · match'}</Text> : null}
                            </Text>
                            <Text style={styles.candSub} numberOfLines={1}>
                              {c.publisher ?? '—'}
                              {c.appearances != null
                                ? ` · ${c.appearances.toLocaleString()} apps`
                                : ''}
                              {isLinked ? ' · already linked' : ` · CV ${c.id}`}
                            </Text>
                            {c.deck ? (
                              <Text style={styles.candDeck} numberOfLines={2}>
                                {c.deck}
                              </Text>
                            ) : null}
                          </View>
                          <Ionicons
                            name={isLinked ? 'lock-closed-outline' : 'checkmark-circle-outline'}
                            size={18}
                            color={isLinked ? COLORS.grey : COLORS.orange}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <View style={styles.actions}>
                  <Pressable
                    onPress={() => markUnmatched(hero)}
                    disabled={!!busy}
                    style={[styles.noneBtn, !!busy && styles.dim]}
                  >
                    {busy === `unmatched-${hero.id}` ? (
                      <ActivityIndicator size="small" color={COLORS.grey} />
                    ) : (
                      <Ionicons name="close-circle-outline" size={14} color={COLORS.grey} />
                    )}
                    <Text style={styles.noneText}>Not on ComicVine</Text>
                  </Pressable>
                  <View style={styles.manualBox}>
                    <TextInput
                      value={manual[hero.id] ?? ''}
                      onChangeText={(t) => setManual((m) => ({ ...m, [hero.id]: t }))}
                      placeholder="CV id…"
                      placeholderTextColor={COLORS.grey}
                      keyboardType="number-pad"
                      style={[styles.manualInput, { outlineStyle: 'none' }] as object}
                    />
                    <Pressable
                      onPress={() => {
                        const id = (manual[hero.id] ?? '').trim();
                        if (/^\d+$/.test(id)) accept(hero, id);
                        else flash('Enter a numeric ComicVine id', 'error');
                      }}
                      disabled={busyThis || !(manual[hero.id] ?? '').trim()}
                      style={[
                        styles.manualSet,
                        (busyThis || !(manual[hero.id] ?? '').trim()) && styles.dim,
                      ]}
                    >
                      <Text style={styles.manualSetText}>Set</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
          {heroes.length < total ? (
            <LoadMore
              onPress={() => setLimit((l) => l + PAGE)}
              loading={loading}
              label={`Load more · ${(total - heroes.length).toLocaleString()} left`}
            />
          ) : null}
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  spin: { marginVertical: 10 },
  allClear: { alignItems: 'flex-start', gap: 6, paddingVertical: 6 },
  allClearTitle: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black },
  allClearSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    lineHeight: 17,
    maxWidth: 520,
  },
  candSpin: { alignSelf: 'flex-start', marginVertical: 4 },
  list: { gap: 4 },
  dim: { opacity: 0.4 },
  heroRow: {
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
  meta: { flex: 1, minWidth: 0 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black },
  pub: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  noneFound: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  candidates: { gap: 5 },
  cand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  candAgrees: { borderColor: COLORS.green, backgroundColor: 'rgba(74,153,110,0.08)' },
  candText: { flex: 1, minWidth: 0, gap: 1 },
  candName: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  matchTag: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.green },
  candSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  candDeck: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey, lineHeight: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  noneBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5 },
  noneText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.grey },
  manualBox: { flexDirection: 'row', alignItems: 'stretch', gap: 1, flex: 1, justifyContent: 'flex-end' },
  manualInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.navy,
    width: 90,
    backgroundColor: '#f6f0e6',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  manualSet: {
    backgroundColor: COLORS.navy,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualSetText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: '#fff' },
});
