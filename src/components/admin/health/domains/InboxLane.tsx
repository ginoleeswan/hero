// Inbox lane — every queue that needs a human decision, in one place:
// user reports (pages / AI portraits / gallery images) and community
// contributions (field edits, "Did You Know" facts). Merges the old top-level
// Reports tab and the old Catalog › Review sub-tab. Sub-tab badges are live
// queue counts; both panels self-fetch and stay unchanged.
import { useEffect } from 'react';
import { useUrlTabState } from '../../../../hooks/useUrlTabState';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SubTabs } from '../SubTabs';
import { ReportsDomain } from './ReportsDomain';
import { ReviewDomain } from './ReviewDomain';
import { ComicvineReview } from './ComicvineReview';
import { fetchReportsQueue } from '../../../../lib/db/reports';
import { getReviewQueue } from '../../../../lib/db/contributions';
import { countComicvineNeedsReview } from '../../../../lib/db/comicvineReview';
import type { LaneJump, LogTone } from '../format';

export type InboxSub = 'reports' | 'review' | 'comicvine';

export function InboxLane({
  jump,
  flash,
}: {
  jump?: LaneJump<InboxSub> | null;
  flash: (msg: string, tone?: LogTone) => void;
}) {
  const queryClient = useQueryClient();
  const [sub, setSub] = useUrlTabState<InboxSub>('sub', 'reports', [
    'reports',
    'review',
    'comicvine',
  ] as const);
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
  const cvReviewQ = useQuery({
    queryKey: ['comicvineReviewCount'],
    queryFn: () => countComicvineNeedsReview(),
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
          {
            key: 'comicvine',
            label: 'Collisions',
            icon: 'git-compare-outline',
            badge: cvReviewQ.data ?? 0,
          },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === 'reports' ? (
        <ReportsDomain />
      ) : sub === 'review' ? (
        <ReviewDomain />
      ) : (
        <ComicvineReview
          flash={flash}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: ['comicvineReviewCount'] })
          }
        />
      )}
    </>
  );
}
