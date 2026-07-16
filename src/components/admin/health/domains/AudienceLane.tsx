// Audience lane — "how is the app doing with people": self-hosted traffic
// analytics, community engagement, and the client-error feed as sub-tabs of one
// read-only lane (formerly three top-level tabs). Each sub-tab's query runs only
// while it's active; query keys match the old page-level ones so nothing else
// changes.
import { useState } from 'react';
import { useUrlTabState } from '../../../../hooks/useUrlTabState';
import { useQuery } from '@tanstack/react-query';
import { SubTabs } from '../SubTabs';
import { TrafficDomain } from './TrafficDomain';
import { AcquisitionDomain } from './AcquisitionDomain';
import { CommunityDomain } from './CommunityDomain';
import { ErrorsDomain } from './ErrorsDomain';
import { fetchTrafficOverview } from '../../../../lib/db/traffic';
import { fetchCommunityOverview } from '../../../../lib/db/community';
import { fetchClientErrorOverview } from '../../../../lib/db/clientErrors';

export type AudienceSub = 'traffic' | 'acquisition' | 'community' | 'errors';

export function AudienceLane({
  narrow,
  onOpenReview,
  onOpenPromote,
}: {
  narrow: boolean;
  onOpenReview: () => void;
  /** Jump to Publish → Promote (the ad-link builder) from Acquisition. */
  onOpenPromote?: () => void;
}) {
  const [sub, setSub] = useUrlTabState<AudienceSub>('sub', 'traffic', [
    'traffic',
    'acquisition',
    'community',
    'errors',
  ] as const);
  const [trafficDays, setTrafficDays] = useState(28);

  // Traffic and Acquisition both read admin_traffic_overview() — one shared query
  // (same key) powers both sub-tabs, so switching between them is instant.
  const trafficQ = useQuery({
    queryKey: ['trafficOverview', trafficDays],
    queryFn: () => fetchTrafficOverview(trafficDays),
    enabled: sub === 'traffic' || sub === 'acquisition',
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev, // keep the chart up while switching ranges
  });
  const communityQ = useQuery({
    queryKey: ['communityOverview'],
    queryFn: fetchCommunityOverview,
    enabled: sub === 'community',
    staleTime: 60_000,
  });
  const errorsQ = useQuery({
    queryKey: ['clientErrorOverview'],
    queryFn: () => fetchClientErrorOverview(7),
    enabled: sub === 'errors',
    staleTime: 60_000,
  });

  return (
    <>
      <SubTabs<AudienceSub>
        tabs={[
          { key: 'traffic', label: 'Traffic', icon: 'trending-up-outline' },
          { key: 'acquisition', label: 'Acquisition', icon: 'magnet-outline' },
          { key: 'community', label: 'Community', icon: 'people-outline' },
          { key: 'errors', label: 'Errors', icon: 'bug-outline' },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === 'traffic' ? (
        <TrafficDomain
          data={trafficQ.data ?? null}
          loading={trafficQ.isLoading}
          narrow={narrow}
          days={trafficDays}
          onDaysChange={setTrafficDays}
        />
      ) : null}
      {sub === 'acquisition' ? (
        <AcquisitionDomain
          data={trafficQ.data ?? null}
          loading={trafficQ.isLoading}
          narrow={narrow}
          days={trafficDays}
          onDaysChange={setTrafficDays}
          onOpenPromote={onOpenPromote}
        />
      ) : null}
      {sub === 'community' ? (
        <CommunityDomain
          data={communityQ.data ?? null}
          loading={communityQ.isLoading}
          narrow={narrow}
          onOpenReview={onOpenReview}
        />
      ) : null}
      {sub === 'errors' ? (
        <ErrorsDomain data={errorsQ.data ?? null} loading={errorsQ.isLoading} narrow={narrow} />
      ) : null}
    </>
  );
}
