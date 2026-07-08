// Inbox lane — every queue that needs a human decision, in one place:
// user reports (pages / AI portraits / gallery images) and community
// contributions (field edits, "Did You Know" facts). Merges the old top-level
// Reports tab and the old Catalog › Review sub-tab. Sub-tab badges are live
// queue counts; both panels self-fetch and stay unchanged.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SubTabs } from '../SubTabs';
import { ReportsDomain } from './ReportsDomain';
import { ReviewDomain } from './ReviewDomain';
import { fetchReportsQueue } from '../../../../lib/db/reports';
import { getReviewQueue } from '../../../../lib/db/contributions';
import type { LaneJump } from '../format';

export type InboxSub = 'reports' | 'review';

export function InboxLane({ jump }: { jump?: LaneJump<InboxSub> | null }) {
  const [sub, setSub] = useState<InboxSub>('reports');
  useEffect(() => {
    if (jump) setSub(jump.sub);
  }, [jump]);

  // Counts share query keys with the panels (and the page-level badge), so the
  // cache is filled once and every surface agrees.
  const reportsQ = useQuery({
    queryKey: ['reportsQueue', 'open'],
    queryFn: () => fetchReportsQueue('open'),
    staleTime: 30_000,
  });
  const reviewQ = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: () => getReviewQueue(),
    staleTime: 30_000,
  });

  return (
    <>
      <SubTabs<InboxSub>
        tabs={[
          {
            key: 'reports',
            label: 'Reports',
            icon: 'flag-outline',
            badge: reportsQ.data?.length ?? 0,
          },
          {
            key: 'review',
            label: 'Review',
            icon: 'shield-checkmark-outline',
            badge: reviewQ.data?.length ?? 0,
          },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === 'reports' ? <ReportsDomain /> : <ReviewDomain />}
    </>
  );
}
