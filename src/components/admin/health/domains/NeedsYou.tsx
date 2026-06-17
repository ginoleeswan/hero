// "Needs you" — the resolver's ambiguous queue. Each hero shows its Wikidata
// candidates (name · description · score) to pick inline, with a manual-QID
// escape hatch. Owns its own Wikidata-summary fetch + manual-entry state.
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { InfoTip } from '../InfoTip';
import { HeroThumb, LoadMore, EmptyState } from '../ui';
import { withAlpha, type LogTone } from '../format';
import { fetchWikidataEntities, type WikidataSummary } from '../../../../lib/api';
import type { AmbiguousHero } from '../../../../lib/db/catalogHealth';

const BULK_THRESHOLD = 0.9;

// Open a candidate's Wikidata page in a new tab so you can eyeball the match.
const openWiki = (qid: string) => {
  if (typeof window !== 'undefined')
    window.open(`https://www.wikidata.org/wiki/${qid}`, '_blank', 'noopener');
};

export function NeedsYou({
  ambiguous,
  ambiguousTotal,
  ambiguousFetching,
  busy,
  fill,
  onResolveQid,
  onMarkUnresolved,
  onBulkAccept,
  onLoadMoreAmbiguous,
  flash,
}: {
  ambiguous: AmbiguousHero[];
  ambiguousTotal: number;
  ambiguousFetching: boolean;
  busy: string | null;
  fill: boolean;
  onResolveQid: (id: string, qid: string, name: string) => void;
  onMarkUnresolved: (id: string, name: string) => void;
  onBulkAccept: (heroes: AmbiguousHero[], threshold: number) => void;
  onLoadMoreAmbiguous: () => void;
  flash: (msg: string, tone?: LogTone) => void;
}) {
  // Wikidata label + description per candidate QID, fetched lazily.
  const [wdInfo, setWdInfo] = useState<Record<string, WikidataSummary>>({});
  // Per-hero manual QID entry, for when the resolver missed the right match.
  const [manualQid, setManualQid] = useState<Record<string, string>>({});

  const bulkEligible = ambiguous.filter((hero) => {
    const top = [...hero.candidates].sort((a, b) => b.score - a.score)[0];
    return top && top.score >= BULK_THRESHOLD;
  }).length;

  // Pull labels + descriptions for any candidate QIDs we haven't fetched yet.
  useEffect(() => {
    const missing = ambiguous
      .flatMap((hero) => hero.candidates.map((c) => c.qid))
      .filter((qid) => !(qid in wdInfo));
    if (missing.length === 0) return;
    let alive = true;
    fetchWikidataEntities(missing).then((found) => {
      if (alive && Object.keys(found).length > 0) setWdInfo((prev) => ({ ...prev, ...found }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambiguous]);

  const body = (
    <>
      {bulkEligible > 0 ? (
        <Pressable
          onPress={() => onBulkAccept(ambiguous, BULK_THRESHOLD)}
          disabled={busy === 'bulk-accept'}
          style={[styles.bulkBar, busy === 'bulk-accept' && styles.dim]}
        >
          <Ionicons name="checkmark-done" size={15} color={COLORS.green} />
          <Text style={styles.bulkText}>
            Auto-accept {bulkEligible} confident match{bulkEligible === 1 ? '' : 'es'} (≥{' '}
            {BULK_THRESHOLD.toFixed(2)})
          </Text>
        </Pressable>
      ) : null}
      {ambiguous.map((hero) => {
        const busyThis = busy === `resolveqid-${hero.id}`;
        return (
          <View key={hero.id} style={styles.row}>
            <View style={styles.who}>
              <HeroThumb uri={hero.imageUrl} width={30} height={40} radius={6} />
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {hero.name}
                </Text>
                <Text style={styles.pub} numberOfLines={1}>
                  {hero.publisher ?? '—'}
                </Text>
              </View>
            </View>
            <View style={styles.candidates}>
              {hero.candidates.map((c) => {
                const info = wdInfo[c.qid];
                return (
                  <View key={c.qid} style={styles.cand}>
                    <Pressable
                      onPress={() => onResolveQid(hero.id, c.qid, hero.name)}
                      disabled={!!busy}
                      style={[styles.candMainBtn, !!busy && styles.dim]}
                      accessibilityLabel={`Pick ${info?.label ?? c.qid} for ${hero.name}`}
                    >
                      {info?.image ? (
                        <HeroThumb uri={info.image} width={30} height={40} radius={6} />
                      ) : (
                        <View style={styles.candNoImg}>
                          <Ionicons name="image-outline" size={14} color={COLORS.grey} />
                        </View>
                      )}
                      <View style={styles.candText}>
                        <Text style={styles.candLabel} numberOfLines={1}>
                          {info?.label ?? c.qid}
                          <Text style={styles.candScore}>{`  ·  ${c.score.toFixed(2)}`}</Text>
                        </Text>
                        <Text style={styles.candDesc} numberOfLines={2}>
                          {info
                            ? info.description || 'no Wikidata description'
                            : `${c.qid} · loading…`}
                        </Text>
                      </View>
                      <Ionicons
                        name={busyThis ? 'ellipsis-horizontal' : 'checkmark-circle-outline'}
                        size={18}
                        color={COLORS.orange}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => openWiki(c.qid)}
                      style={styles.chipLink}
                      accessibilityLabel={`Open ${c.qid} on Wikidata to verify`}
                    >
                      <Ionicons name="open-outline" size={14} color={COLORS.navy} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
            {/* Escape hatch — none of the candidates are right. */}
            <View style={styles.actions}>
              <Pressable
                onPress={() => onMarkUnresolved(hero.id, hero.name)}
                disabled={!!busy}
                style={[styles.noneBtn, !!busy && styles.dim]}
              >
                <Ionicons name="close-circle-outline" size={14} color={COLORS.grey} />
                <Text style={styles.noneText}>None of these</Text>
              </Pressable>
              <View style={styles.manualBox}>
                <TextInput
                  value={manualQid[hero.id] ?? ''}
                  onChangeText={(t) => setManualQid((prev) => ({ ...prev, [hero.id]: t }))}
                  placeholder="paste QID… (Q12345)"
                  placeholderTextColor={COLORS.grey}
                  autoCapitalize="characters"
                  style={[styles.manualInput, { outlineStyle: 'none' }] as object}
                />
                <Pressable
                  onPress={() => {
                    const q = (manualQid[hero.id] ?? '').trim().toUpperCase();
                    if (/^Q\d+$/.test(q)) onResolveQid(hero.id, q, hero.name);
                    else flash('Enter a valid QID like Q12345', 'error');
                  }}
                  disabled={!!busy || !(manualQid[hero.id] ?? '').trim()}
                  style={[
                    styles.manualSet,
                    (!!busy || !(manualQid[hero.id] ?? '').trim()) && styles.dim,
                  ]}
                >
                  <Text style={styles.manualSetText}>Set</Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}
      {ambiguous.length < ambiguousTotal ? (
        <LoadMore
          onPress={onLoadMoreAmbiguous}
          loading={ambiguousFetching}
          label={`Load more · ${(ambiguousTotal - ambiguous.length).toLocaleString()} left`}
        />
      ) : null}
    </>
  );

  return (
    <Panel
      fill={fill}
      scroll={fill}
      title="Needs you"
      hint={
        ambiguousTotal > 0 ? `${ambiguousTotal.toLocaleString()} to review` : 'Decisions land here'
      }
      action={
        <InfoTip text="Heroes the resolver couldn't confidently match to one Wikidata identity. Each candidate shows its Wikidata name, description and confidence score — tap the right one to lock it in, no need to leave the page. The ↗ still opens Wikidata if you want to dig deeper." />
      }
    >
      {ambiguous.length === 0 ? (
        <EmptyState text="All clear — nothing waiting on you." />
      ) : fill ? (
        body
      ) : (
        <ScrollView style={styles.boundedScroll} nestedScrollEnabled showsVerticalScrollIndicator>
          {body}
        </ScrollView>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  dim: { opacity: 0.4 },
  boundedScroll: { maxHeight: 340 } as object,
  row: {
    flexDirection: 'column',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
  meta: { flex: 1, minWidth: 0 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black },
  pub: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  candidates: { gap: 5 },
  cand: { flexDirection: 'row', alignItems: 'stretch', gap: 1 },
  candMainBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: withAlpha(COLORS.navy, 0.05),
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  candNoImg: {
    width: 30,
    height: 40,
    borderRadius: 6,
    backgroundColor: withAlpha(COLORS.navy, 0.05),
    alignItems: 'center',
    justifyContent: 'center',
  },
  candText: { flex: 1, minWidth: 0, gap: 1 },
  candLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  candScore: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  candDesc: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey, lineHeight: 15 },
  chipLink: {
    backgroundColor: withAlpha(COLORS.navy, 0.05),
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: withAlpha(COLORS.green, 0.08),
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 4,
  },
  bulkText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.green },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' },
  noneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  noneText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.grey },
  manualBox: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 1,
    flex: 1,
    minWidth: 150,
    justifyContent: 'flex-end',
  },
  manualInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.navy,
    flex: 1,
    maxWidth: 170,
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
