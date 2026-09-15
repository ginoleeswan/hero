// Audience › Visitors — who was on the site, from where, how they got here and
// on what. Reads admin_audience_breakdown() for the grouped view (countries,
// cities, sources, landings, devices, browsers, OS, languages, viewports,
// hour-of-day / weekday) and admin_audience_sessions() for the per-visitor
// drill-down. Every breakdown row is a filter: tap "Germany" and the sessions
// list below becomes the people behind that bar. Desktop lays the groups out
// in bento rows; mobile stacks them, sessions last.
import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Text } from '../../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { EmptyState, LoadMore, PillGroup, StatTile, Chip, LoadFailed } from '../ui';
import { TrafficSkeleton } from '../skeletons';
import { BreakdownList, type BreakdownRow } from './audience/BreakdownList';
import { HourBars } from './audience/HourBars';
import { SessionCard } from './audience/SessionCard';
import {
  fetchAudienceBreakdown,
  fetchAudienceSessions,
  countryName,
  type SessionFilters,
  type SessionsPage,
} from '../../../../lib/db/audience';

const RANGES = [
  { label: '7d', value: 7 },
  { label: '28d', value: 28 },
  { label: '90d', value: 90 },
];
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${h}`);
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SESSIONS_PAGE = 25;

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

/** Breakdown rows → tappable list rows. Pure; exported for tests. */
export function toRows(
  rows: { label: string; visitors: number; views?: number }[],
  keyOf: (label: string) => string = (l) => l,
): BreakdownRow[] {
  return rows.map((r) => ({
    key: keyOf(r.label),
    label: r.label,
    value: r.visitors,
    note: r.views != null ? `${r.views.toLocaleString()} views` : undefined,
  }));
}

export function VisitorsDomain({
  narrow,
  days,
  onDaysChange,
}: {
  narrow: boolean;
  days: number;
  onDaysChange: (d: number) => void;
}) {
  const [filters, setFilters] = useState<SessionFilters>({});
  const setFilter = (k: keyof SessionFilters) => (v: string | null) =>
    setFilters((f) => ({ ...f, [k]: v }));
  const activeFilters = (Object.keys(filters) as (keyof SessionFilters)[]).filter(
    (k) => filters[k],
  );

  const breakdownQ = useQuery({
    queryKey: ['audienceBreakdown', days],
    queryFn: () => fetchAudienceBreakdown(days),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
  const sessionsQ = useInfiniteQuery<SessionsPage | null, Error>({
    queryKey: ['audienceSessions', days, filters],
    queryFn: ({ pageParam }) =>
      fetchAudienceSessions({
        days,
        before: (pageParam as string | null) ?? null,
        limit: SESSIONS_PAGE,
        filters,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextBefore ?? undefined,
    staleTime: 60_000,
  });
  const sessions = useMemo(
    () => (sessionsQ.data?.pages ?? []).flatMap((p) => p?.sessions ?? []),
    [sessionsQ.data],
  );

  const data = breakdownQ.data ?? null;
  if (breakdownQ.isLoading && !data) return <TrafficSkeleton narrow={narrow} />;
  if (breakdownQ.isError || (breakdownQ.isFetched && !data)) {
    return (
      <LoadFailed
        what="the audience breakdown (is migration 20260915120000 applied?)"
        onRetry={() => void breakdownQ.refetch()}
      />
    );
  }
  if (!data) return null;

  const { totals, newVsReturning: nvr } = data;
  const engaged = totals.sessions - totals.bounced;

  const countryRows: BreakdownRow[] = data.countries.map((c) => ({
    key: c.code,
    label: countryName(c.code),
    value: c.visitors,
    note: `${c.views.toLocaleString()} views`,
  }));
  const cityRows: BreakdownRow[] = data.cities.map((c) => ({
    key: `${c.code ?? ''}:${c.city}`,
    label: c.code ? `${c.city}, ${countryName(c.code)}` : c.city,
    value: c.visitors,
  }));
  const regionRows: BreakdownRow[] = data.regions.map((r) => ({
    key: `${r.code ?? ''}:${r.region}`,
    label: r.code ? `${r.region}, ${r.code}` : r.region,
    value: r.visitors,
  }));
  const sourceRows: BreakdownRow[] = data.sources.map((r) => ({
    key: r.source,
    label: [r.source, r.medium, r.campaign].filter(Boolean).join(' · '),
    value: r.visitors,
    note: `${pct(r.engaged, r.visitors)} engaged · ${r.signedIn} signed in`,
  }));
  const landingRows: BreakdownRow[] = data.landings.map((r) => ({
    key: r.path,
    label: r.path,
    value: r.sessions,
    note: `${pct(r.engaged, r.sessions)} stayed`,
  }));

  const filterChips = activeFilters.map((k) => {
    const v = filters[k] as string;
    const label = k === 'country' ? countryName(v) : v;
    return <Chip key={k} bg="rgba(231,115,51,0.14)" fg={COLORS.orange} text={`${k}: ${label}`} />;
  });

  const sessionsPanel = (
    <Panel
      title="Sessions"
      hint="One row per visit — tap to expand the page trail"
      action={
        activeFilters.length > 0 ? (
          <Text style={s.clear} onPress={() => setFilters({})}>
            Clear filters
          </Text>
        ) : undefined
      }
    >
      {filterChips.length > 0 ? <View style={s.chips}>{filterChips}</View> : null}
      {sessionsQ.isLoading ? (
        <EmptyState text="Loading sessions…" />
      ) : sessions.length === 0 ? (
        <EmptyState
          text={
            activeFilters.length > 0
              ? 'No sessions match those filters in this window.'
              : 'No sessions recorded in this window yet.'
          }
        />
      ) : (
        <View style={s.sessions}>
          {sessions.map((sess, i) => (
            <SessionCard key={sess.sessionId} session={sess} defaultOpen={i === 0 && !narrow} />
          ))}
        </View>
      )}
      {sessionsQ.hasNextPage ? (
        <LoadMore
          onPress={() => void sessionsQ.fetchNextPage()}
          loading={sessionsQ.isFetchingNextPage}
          label="Load older sessions"
        />
      ) : null}
    </Panel>
  );

  return (
    <Bento>
      {/* Headline — how many people, how sticky, how spread out */}
      <Panel
        title="Visitors"
        hint={`Sessions over the last ${data.rangeDays} days`}
        action={<PillGroup options={RANGES} value={days} onChange={onDaysChange} />}
      >
        <View style={s.tiles}>
          <StatTile label="Sessions" value={totals.sessions.toLocaleString()} tint={COLORS.navy} />
          <StatTile
            label="New visitors"
            value={pct(nvr.new, nvr.new + nvr.returning)}
            tint={COLORS.green}
          />
          <StatTile label="Engaged" value={pct(engaged, totals.sessions)} tint={COLORS.orange} />
          <StatTile
            label="Pages / session"
            value={Number(totals.avgViews).toFixed(1)}
            tint={COLORS.blue}
          />
          <StatTile
            label="Avg minutes"
            value={Number(totals.avgMinutes).toFixed(1)}
            tint={COLORS.blue}
          />
          <StatTile
            label="Signed in"
            value={pct(totals.signedIn, totals.sessions)}
            tint={COLORS.orange}
          />
          <StatTile
            label="Countries"
            value={totals.countries.toLocaleString()}
            tint={COLORS.navy}
          />
        </View>
        {totals.sessions === 0 ? (
          <View style={s.note}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.grey} />
            <Text style={s.noteText}>
              Geo, browser and viewport fill in for views recorded after the enrichment shipped;
              older rows show as unknown.
            </Text>
          </View>
        ) : null}
      </Panel>

      {/* Where from */}
      <Bento.Row narrow={narrow}>
        <Panel title="Countries" hint="Tap to filter sessions" style={s.flex1}>
          <BreakdownList
            rows={countryRows}
            empty="No geo recorded yet."
            selected={filters.country}
            onSelect={setFilter('country')}
          />
        </Panel>
        <Panel title="Cities" hint="Most active cities" style={s.flex1}>
          <BreakdownList rows={cityRows} empty="No city data yet." />
        </Panel>
        <Panel title="Regions" hint="States and provinces" style={s.flex1}>
          <BreakdownList rows={regionRows} empty="No region data yet." />
        </Panel>
      </Bento.Row>

      {/* How they got here */}
      <Bento.Row narrow={narrow}>
        <Panel
          title="How they arrived"
          hint="First touch: campaign · source · referrer"
          style={s.flex15}
        >
          <BreakdownList
            rows={sourceRows}
            empty="No attribution yet — tag links or wait for referrals."
            selected={filters.source}
            onSelect={setFilter('source')}
          />
        </Panel>
        <Panel title="Landing pages" hint="First page of each session" style={s.flex1}>
          <BreakdownList rows={landingRows} empty="No landings yet." unit="sessions" />
        </Panel>
        <Panel title="Referring sites" hint="Cross-origin hosts, any page" style={s.flex1}>
          <BreakdownList
            rows={data.referrers.map((r) => ({
              key: r.host,
              label: r.host,
              value: r.visitors,
              note: `${r.views.toLocaleString()} views`,
            }))}
            empty="No external referrers yet."
          />
        </Panel>
      </Bento.Row>

      {/* On what */}
      <Bento.Row narrow={narrow}>
        <Panel title="Devices" hint="Tap to filter sessions" style={s.flex1}>
          <BreakdownList
            rows={toRows(data.devices)}
            empty="No device data yet."
            selected={filters.device}
            onSelect={setFilter('device')}
          />
        </Panel>
        <Panel title="Browsers" hint="Tap to filter sessions" style={s.flex1}>
          <BreakdownList
            rows={toRows(data.browsers)}
            empty="No browser data yet."
            selected={filters.browser}
            onSelect={setFilter('browser')}
          />
        </Panel>
        <Panel title="Operating systems" style={s.flex1}>
          <BreakdownList rows={toRows(data.os)} empty="No OS data yet." />
        </Panel>
      </Bento.Row>
      <Bento.Row narrow={narrow}>
        <Panel title="Viewports" hint="By the width the layout branches on" style={s.flex1}>
          <BreakdownList rows={toRows(data.screens)} empty="No viewport data yet." />
        </Panel>
        <Panel title="Languages" hint="Browser locale" style={s.flex1}>
          <BreakdownList rows={toRows(data.languages)} empty="No language data yet." />
        </Panel>
        <Panel title="Timezones" style={s.flex1}>
          <BreakdownList rows={toRows(data.timezones)} empty="No timezone data yet." />
        </Panel>
      </Bento.Row>

      {/* When */}
      <Bento.Row narrow={narrow}>
        <Panel title="Hour of day" hint="Visitors by hour (UTC)" style={s.flex15}>
          {data.hours.length === 0 ? (
            <EmptyState text="No views yet." />
          ) : (
            <HourBars
              values={data.hours.map((h) => h.visitors)}
              labels={HOUR_LABELS}
              labelEvery={narrow ? 6 : 3}
            />
          )}
        </Panel>
        <Panel title="Day of week" hint="Visitors by weekday" style={s.flex1}>
          {data.weekdays.length === 0 ? (
            <EmptyState text="No views yet." />
          ) : (
            <HourBars
              values={data.weekdays.map((d) => d.visitors)}
              labels={DOW_LABELS}
              tint={COLORS.navy}
            />
          )}
        </Panel>
      </Bento.Row>

      {/* Who, one by one */}
      {sessionsPanel}
    </Bento>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  flex15: { flex: 1.5 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  noteText: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  clear: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange },
  sessions: { gap: 8 },
});
