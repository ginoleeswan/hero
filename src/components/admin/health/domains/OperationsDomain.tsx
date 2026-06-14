// Operations domain — controls (batch size, run, retry, cron toggle), run
// history table, activity log, and hero console. Extracted from health.web.tsx;
// active-run / stop lives in the VitalsBar ribbon, not here.
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { RunHistory } from '../RunHistory';
import { Chip, HeroThumb } from '../atoms';
import { LOG_TONE_COLOR, logClock } from '../format';
import type {
  CatalogHealth,
  EnrichmentRun,
  AdminHeroResult,
  AmbiguousHero,
} from '../../../../lib/db/catalogHealth';
import type { LogEntry } from '../format';

export function OperationsDomain({
  h,
  runs,
  runsTotal,
  runsLoading,
  runsFetching,
  onLoadMore,
  log,
  toast,
  clearLog,
  heroQuery,
  setHeroQuery,
  heroResults,
  heroSearchLoading,
  batchSize,
  setBatchSize,
  busy,
  cronOn,
  onRunDrain,
  onRetryFailed,
  onToggleCron,
  onReenrich,
  ambiguous,
  onResolveQid,
  narrow,
}: {
  h: CatalogHealth;
  runs: EnrichmentRun[];
  runsTotal: number;
  runsLoading: boolean;
  runsFetching: boolean;
  onLoadMore: () => void;
  log: LogEntry[];
  toast: string | null;
  clearLog: () => void;
  heroQuery: string;
  setHeroQuery: (q: string) => void;
  heroResults: AdminHeroResult[];
  heroSearchLoading: boolean;
  batchSize: number;
  setBatchSize: (n: number) => void;
  busy: string | null;
  cronOn: boolean;
  onRunDrain: () => void;
  onRetryFailed: () => void;
  onToggleCron: () => void;
  onReenrich: (id: string, name: string) => void;
  ambiguous: AmbiguousHero[];
  onResolveQid: (id: string, qid: string, name: string) => void;
  narrow: boolean;
}) {
  const router = useRouter();

  const toastAction = toast ? (
    <View style={styles.toastWrap}>
      <Ionicons name="information-circle" size={15} color={COLORS.orange} />
      <Text style={styles.toast}>{toast}</Text>
    </View>
  ) : undefined;

  const clearAction =
    log.length > 0 ? (
      <Pressable onPress={clearLog} style={styles.miniBtn}>
        <Ionicons name="trash-outline" size={14} color={COLORS.navy} />
        <Text style={styles.miniBtnText}>Clear</Text>
      </Pressable>
    ) : undefined;

  return (
    <Bento>
      {/* ── Operations actions card ── */}
      <Panel title="Operations" action={toastAction}>
        <View style={[styles.opsBody, narrow && styles.opsBodyNarrow]}>
          <View style={styles.opsActions}>
            <View style={styles.sizeSel}>
              {[10, 25, 50].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setBatchSize(n)}
                  style={[styles.sizePill, batchSize === n && styles.sizePillOn]}
                >
                  <Text style={[styles.sizePillText, batchSize === n && styles.sizePillTextOn]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={onRunDrain}
              disabled={!!busy}
              style={[
                styles.actBtn,
                styles.actPrimary,
                narrow && styles.actGrow,
                !!busy && styles.actDim,
              ]}
            >
              {busy === 'drain' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="play" size={15} color="#fff" />
              )}
              <Text style={styles.actPrimaryText}>Run batch · {batchSize}</Text>
            </Pressable>
            <Pressable
              onPress={onRetryFailed}
              disabled={!!busy || (h.cvStatus.failed ?? 0) === 0}
              style={[
                styles.actBtn,
                styles.actGhost,
                narrow && styles.actGrow,
                (!!busy || (h.cvStatus.failed ?? 0) === 0) && styles.actDim,
              ]}
            >
              {busy === 'retry' ? (
                <ActivityIndicator size="small" color={COLORS.navy} />
              ) : (
                <Ionicons name="refresh" size={15} color={COLORS.navy} />
              )}
              <Text style={styles.actGhostText}>
                Retry failed{h.cvStatus.failed ? ` · ${h.cvStatus.failed}` : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={onToggleCron}
              disabled={!!busy}
              style={[
                styles.actBtn,
                cronOn ? styles.actOn : styles.actGhost,
                narrow && styles.actGrow,
                !!busy && styles.actDim,
              ]}
            >
              {busy === 'cron' ? (
                <ActivityIndicator size="small" color={cronOn ? '#fff' : COLORS.navy} />
              ) : (
                <Ionicons
                  name={cronOn ? 'pause' : 'play-skip-forward'}
                  size={15}
                  color={cronOn ? '#fff' : COLORS.navy}
                />
              )}
              <Text style={cronOn ? styles.actPrimaryText : styles.actGhostText}>
                {cronOn ? 'Auto-drain ON' : 'Auto-drain OFF'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Panel>

      {/* ── Run history card ── */}
      <Panel
        title="Run history"
        hint={`${runsTotal.toLocaleString()} runs logged · cron + manual · auto-refreshes`}
      >
        <RunHistory
          runs={runs}
          total={runsTotal}
          narrow={narrow}
          loading={runsLoading}
          fetching={runsFetching}
          onLoadMore={onLoadMore}
        />
      </Panel>

      {/* ── Activity log + Hero console side-by-side ── */}
      <Bento.Row narrow={narrow}>
        {/* Activity log */}
        <Panel
          title="Activity log"
          hint="Live results of actions & runs this session"
          action={clearAction}
        >
          {log.length === 0 ? (
            <Text style={styles.runsEmpty}>
              Nothing yet — run a batch or action and results stream in here.
            </Text>
          ) : (
            <ScrollView
              style={styles.logPanel}
              contentContainerStyle={styles.logPanelInner}
              nestedScrollEnabled
            >
              {log.map((e) => (
                <View key={e.id} style={styles.logRow}>
                  <Text style={styles.logTime}>{logClock(e.at)}</Text>
                  <View style={[styles.logDot, { backgroundColor: LOG_TONE_COLOR[e.tone] }]} />
                  <Text style={styles.logText}>{e.text}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Panel>

        {/* Hero console */}
        <Panel title="Hero console" hint="Find any hero and re-fetch its ComicVine data on demand">
          <View style={styles.heroSearchBox}>
            <Ionicons name="search" size={16} color={COLORS.grey} />
            <TextInput
              value={heroQuery}
              onChangeText={setHeroQuery}
              placeholder="Search heroes by name…"
              placeholderTextColor={COLORS.grey}
              style={[styles.heroSearchInput, { outlineStyle: 'none' }] as object}
            />
            {heroQuery.length > 0 && (
              <Pressable onPress={() => setHeroQuery('')}>
                <Ionicons name="close-circle" size={16} color={COLORS.grey} />
              </Pressable>
            )}
          </View>
          {heroQuery.trim().length >= 2 && (
            <View style={{ marginTop: 6 }}>
              {heroSearchLoading ? (
                <ActivityIndicator color={COLORS.orange} style={{ marginTop: 14 }} />
              ) : heroResults.length === 0 ? (
                <Text style={styles.runsEmpty}>No heroes match "{heroQuery}".</Text>
              ) : (
                heroResults.map((hero) => {
                  const st = hero.comicvine_status ?? 'none';
                  const stc =
                    st === 'done'
                      ? COLORS.green
                      : st === 'failed'
                        ? COLORS.red
                        : st === 'pending'
                          ? COLORS.yellow
                          : COLORS.grey;
                  const busyThis = busy === `reenrich-${hero.id}`;
                  return (
                    <View key={hero.id} style={styles.hcRow}>
                      <HeroThumb
                        uri={hero.portrait_url ?? hero.image_url}
                        width={34}
                        height={44}
                        radius={7}
                      />
                      <Pressable
                        style={styles.hcInfo}
                        onPress={() => router.push(`/character/${hero.id}`)}
                      >
                        <Text style={styles.hcName} numberOfLines={1}>
                          {hero.name}
                        </Text>
                        <View style={styles.hcMetaRow}>
                          <Text style={styles.hcPub} numberOfLines={1}>
                            {hero.publisher ?? '—'}
                          </Text>
                          <Chip bg={stc + '22'} fg={stc} text={st} capitalize />
                          {!hero.portrait_url && <Text style={styles.hcFlag}>no portrait</Text>}
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => onReenrich(hero.id, hero.name)}
                        disabled={!!busy}
                        style={[styles.hcBtn, !!busy && styles.actDim]}
                      >
                        {busyThis ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="refresh" size={14} color="#fff" />
                        )}
                        <Text style={styles.hcBtnText}>Re-fetch</Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </Panel>

        <Panel title="Identity review" hint="Pick the correct Wikidata QID for ambiguous heroes">
          {ambiguous.length === 0 ? (
            <Text style={styles.runsEmpty}>No heroes awaiting review.</Text>
          ) : (
            ambiguous.map((hero) => {
              const busyThis = busy === `resolveqid-${hero.id}`;
              return (
                <View key={hero.id} style={styles.hcRow}>
                  <HeroThumb uri={hero.imageUrl} width={34} height={44} radius={7} />
                  <View style={styles.hcInfo}>
                    <Text style={styles.hcName} numberOfLines={1}>{hero.name}</Text>
                    <Text style={styles.hcPub} numberOfLines={1}>{hero.publisher ?? '—'}</Text>
                  </View>
                  <View style={styles.idrCandidates}>
                    {hero.candidates.map((c) => (
                      <Pressable
                        key={c.qid}
                        onPress={() => onResolveQid(hero.id, c.qid, hero.name)}
                        disabled={!!busy}
                        style={[styles.idrChip, !!busy && styles.actDim]}
                      >
                        <Text style={styles.idrChipText}>
                          {busyThis ? '…' : `${c.qid} · ${c.score.toFixed(2)}`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </Panel>
      </Bento.Row>
    </Bento>
  );
}

const styles = StyleSheet.create({
  // Operations body
  opsBody: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 14 },
  opsBodyNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  opsActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },

  // Batch-size selector
  sizeSel: { flexDirection: 'row', backgroundColor: '#efe6d6', borderRadius: 10, padding: 3 },
  sizePill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8 },
  sizePillOn: { backgroundColor: '#fff' },
  sizePillText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.grey },
  sizePillTextOn: { color: COLORS.navy },

  // Action buttons
  actBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actPrimary: { backgroundColor: COLORS.orange },
  actPrimaryText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  actGhost: { backgroundColor: '#efe6d6' },
  actGhostText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  actOn: { backgroundColor: COLORS.green },
  actDim: { opacity: 0.4 },
  actGrow: { flexGrow: 1, flexBasis: 140, justifyContent: 'center' },

  // Toast
  toastWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toast: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange },

  // Activity log
  logPanel: {
    maxHeight: 300,
    marginTop: 6,
    backgroundColor: '#faf6ee',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
  },
  logPanelInner: { paddingVertical: 2 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f1ece2',
  },
  logTime: {
    width: 62,
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  logDot: { width: 8, height: 8, borderRadius: 8 },
  logText: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.black },

  // Mini button (Clear)
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#efe6d6',
  },
  miniBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

  // Empty state
  runsEmpty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.grey, marginTop: 12 },

  // Hero console
  heroSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f6f0e6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 10,
  },
  heroSearchInput: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.black,
  },
  hcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f6f0e6',
  },
  hcInfo: { flex: 1, gap: 4, minWidth: 0 },
  idrCandidates: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', maxWidth: 220 },
  idrChip: { backgroundColor: COLORS.navy + '12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  idrChipText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.navy },
  hcName: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  hcMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  hcPub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, maxWidth: 150 },
  hcFlag: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.red },
  hcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
  },
  hcBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
});
