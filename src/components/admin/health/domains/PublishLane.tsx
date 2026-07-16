// Publish lane — outbound content in one place, ordered by the actual flow:
// Social (what to post) → Promote (put money/a link behind it) → Insights
// (what it earned on-platform) → Campaigns / Debate / OG (editorial surfaces).
// The app-side results (visitors/engaged/signups per campaign) live in
// Audience → Acquisition; Promote cross-links there.
import { useUrlTabState } from '../../../../hooks/useUrlTabState';
import { SubTabs } from '../SubTabs';
import { SocialDomain } from './SocialDomain';
import { PromotePanel } from './PromotePanel';
import { CampaignsDomain } from './CampaignsDomain';
import { DebatePickerPanel } from './DebatePickerPanel';
import { SocialInsightsDomain } from './SocialInsightsDomain';
import { OgCardsDomain } from './OgCardsDomain';

export type PublishSub = 'social' | 'promote' | 'insights' | 'campaigns' | 'debate' | 'og';

export function PublishLane({ onOpenAcquisition }: { onOpenAcquisition?: () => void }) {
  const [sub, setSub] = useUrlTabState<PublishSub>('sub', 'social', [
    'social',
    'promote',
    'insights',
    'campaigns',
    'debate',
    'og',
  ] as const);
  return (
    <>
      <SubTabs<PublishSub>
        tabs={[
          { key: 'social', label: 'Social', icon: 'share-social-outline' },
          { key: 'promote', label: 'Promote', icon: 'rocket-outline' },
          { key: 'insights', label: 'Insights', icon: 'stats-chart-outline' },
          { key: 'campaigns', label: 'Campaigns', icon: 'megaphone-outline' },
          { key: 'debate', label: 'Debate', icon: 'flash-outline' },
          { key: 'og', label: 'OG Cards', icon: 'image-outline' },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === 'social' ? (
        <SocialDomain />
      ) : sub === 'promote' ? (
        <PromotePanel onOpenAcquisition={onOpenAcquisition} />
      ) : sub === 'insights' ? (
        <SocialInsightsDomain />
      ) : sub === 'campaigns' ? (
        <CampaignsDomain />
      ) : sub === 'debate' ? (
        <DebatePickerPanel />
      ) : (
        <OgCardsDomain />
      )}
    </>
  );
}
