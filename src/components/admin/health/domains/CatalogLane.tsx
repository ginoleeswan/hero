// Catalog lane — everything about the catalogue's state: Coverage worklists,
// Distributions, Hygiene (search/re-enrich, duplicates, universe gaps), and
// Sources (per-provider coverage — provenance IS catalog health). Owns all its
// sub-tab + worklist state (formerly lifted into health.web.tsx); Review moved
// to the Inbox lane.
import { useEffect, useState } from 'react';
import { useUrlTabState } from '../../../../hooks/useUrlTabState';
import { Animated, ScrollView, View, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SubTabs } from '../SubTabs';
import { CatalogDomain } from './CatalogDomain';
import { SourcesDomain } from './SourcesDomain';
import { HeroConsole } from '../HeroConsole';
import { DuplicatesPanel } from '../DuplicatesPanel';
import { IntegrityPanel } from './IntegrityPanel';
import { UniverseGapsPanel } from '../UniverseGapsPanel';
import { SourcesSkeleton } from '../skeletons';
import {
  getCoverageGaps,
  getCatalogDistributions,
  searchHeroesAdmin,
  fetchSourceCoverage,
  type CatalogHealth,
  type CoverageMetric,
  type UnbrandedHero,
} from '../../../../lib/db/catalogHealth';
import type { LaneJump, LogTone } from '../format';

export type CatalogSub = 'coverage' | 'distributions' | 'hygiene' | 'sources';
export interface CatalogJump extends LaneJump<CatalogSub> {
  metric?: CoverageMetric;
  publisher?: string | null;
}

export interface CatalogLaneProps {
  h?: CatalogHealth;
  narrow: boolean;
  anim: Animated.Value;
  unbranded: UnbrandedHero[];
  unbrandedLoading: boolean;
  busy: string | null;
  onReenrich: (id: string, name: string) => void;
  flash: (msg: string, tone?: LogTone) => void;
  jump?: CatalogJump | null;
}

export function CatalogLane({
  h,
  narrow,
  anim,
  unbranded,
  unbrandedLoading,
  busy,
  onReenrich,
  flash,
  jump,
}: CatalogLaneProps) {
  const queryClient = useQueryClient();
  const [sub, setSub] = useUrlTabState<CatalogSub>('sub', 'coverage', [
    'coverage',
    'distributions',
    'hygiene',
    'sources',
  ] as const);
  const [metric, setMetric] = useState<CoverageMetric>('portrait');
  const [page, setPage] = useState(0);
  const [pubFilter, setPubFilter] = useState<string | null>(null);
  const [heroQuery, setHeroQuery] = useState('');

  // Cross-lane deep-link (Overview glance → a specific worklist).
  useEffect(() => {
    if (!jump) return;
    // A cross-lane deep link: another lane hands this one a target, and the
    // sub-tab has to follow it. Guarded by the `if (!jump) return` above.
    // A cross-lane deep link: another lane hands this one a target and the
    // whole lane state follows it. Guarded by the `if (!jump) return` above,
    // so it runs once per hand-off rather than on every render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSub(jump.sub);
    if (jump.metric) setMetric(jump.metric);
    setPubFilter(jump.publisher ?? null);
    setPage(0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [jump, setSub]);

  const gapsQ = useQuery({
    queryKey: ['coverageGaps', metric, page, pubFilter],
    queryFn: () => getCoverageGaps(metric, { page, publisher: pubFilter }),
    enabled: sub === 'coverage' || sub === 'distributions',
    staleTime: 60_000,
  });
  const distQ = useQuery({
    queryKey: ['distributions'],
    queryFn: getCatalogDistributions,
    enabled: sub === 'distributions',
    staleTime: 60_000,
  });
  const heroSearchQ = useQuery({
    queryKey: ['adminHeroSearch', heroQuery],
    queryFn: () => searchHeroesAdmin(heroQuery),
    enabled: sub === 'hygiene' && heroQuery.trim().length >= 2,
    staleTime: 30_000,
  });
  const sourceCovQ = useQuery({
    queryKey: ['sourceCoverage'],
    queryFn: fetchSourceCoverage,
    enabled: sub === 'sources',
    staleTime: 5 * 60_000,
  });

  // Distributions → coverage drill-down (was pickPublisher in the page).
  const pickPublisher = (publisher: string) => {
    setPubFilter(publisher);
    setPage(0);
    setSub('coverage');
  };

  return (
    <>
      <SubTabs<CatalogSub>
        tabs={[
          { key: 'coverage', label: 'Coverage', icon: 'stats-chart-outline' },
          { key: 'distributions', label: 'Distributions', icon: 'pie-chart-outline' },
          { key: 'hygiene', label: 'Hygiene', icon: 'git-merge-outline', badge: unbranded.length },
          { key: 'sources', label: 'Sources', icon: 'git-network-outline' },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === 'coverage' || sub === 'distributions' ? (
        <CatalogDomain
          h={h}
          gaps={gapsQ.data}
          gapsLoading={gapsQ.isLoading}
          dist={distQ.data}
          metric={metric}
          setMetric={setMetric}
          page={page}
          setPage={setPage}
          pubFilter={pubFilter}
          setPubFilter={setPubFilter}
          pickPublisher={pickPublisher}
          anim={anim}
          narrow={narrow}
          sub={sub}
          fill={!narrow}
        />
      ) : null}
      {sub === 'hygiene' ? (
        <ScrollView style={!narrow ? styles.fillScroll : undefined} nestedScrollEnabled>
          <HeroConsole
            heroQuery={heroQuery}
            setHeroQuery={setHeroQuery}
            heroResults={heroSearchQ.data ?? []}
            heroSearchLoading={heroSearchQ.isLoading}
            busy={busy}
            onReenrich={onReenrich}
          />
          <View style={styles.gapTop}>
            <IntegrityPanel />
          </View>
          <View style={styles.gapTop}>
            <DuplicatesPanel
              flash={flash}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ['catalogHealth'] });
                queryClient.invalidateQueries({ queryKey: ['distributions'] });
                queryClient.invalidateQueries({ queryKey: ['backfillGaps'] });
              }}
            />
          </View>
          <View style={styles.gapTop}>
            <UniverseGapsPanel
              heroes={unbranded}
              loading={unbrandedLoading}
              flash={flash}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ['unbrandedHeroes'] });
                queryClient.invalidateQueries({ queryKey: ['catalogHealth'] });
              }}
            />
          </View>
        </ScrollView>
      ) : null}
      {sub === 'sources' ? (
        sourceCovQ.isLoading ? (
          <SourcesSkeleton narrow={narrow} />
        ) : (
          <SourcesDomain cov={sourceCovQ.data} loading={sourceCovQ.isLoading} narrow={narrow} />
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fillScroll: { flex: 1, minHeight: 0 },
  gapTop: { marginTop: 14 },
});
