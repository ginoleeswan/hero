// Pure builders for tagged marketing links — the single place the UTM
// convention lives in app code (scripts/social mirrors it; playbook:
// docs/marketing/utm-attribution.md). Used by the admin Ad Links panel so a
// promote's destination URL is copy-paste, never hand-assembled.
import { SITE_URL } from '../../constants/site';

export type AdSource = 'tiktok' | 'instagram' | 'reddit' | 'x';
export type AdMedium = 'paid' | 'social';

export interface AdLinkParams {
  source: AdSource;
  medium: AdMedium;
  /** Free-form campaign label; slugified into utm_campaign. */
  campaign: string;
  /** Site-absolute path, default '/'. */
  path?: string;
}

/** Campaign labels become lowercase-hyphen slugs so every spelling of the same
 *  campaign lands in one Acquisition row. */
export function slugifyCampaign(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** A fully-tagged link, e.g.
 *  https://mythique.app/battle/h_a/h_b?utm_source=tiktok&utm_medium=paid&utm_campaign=aqua-v2 */
export function buildAdLink({ source, medium, campaign, path = '/' }: AdLinkParams): string {
  const u = new URL(path, SITE_URL);
  u.searchParams.set('utm_source', source);
  u.searchParams.set('utm_medium', medium);
  u.searchParams.set('utm_campaign', slugifyCampaign(campaign) || 'untitled');
  return u.toString();
}

/** The instant-paint ad landing for a matchup (api/battle.ts). Pair order is
 *  normalized to the canonical id order the app uses. */
export function battlePath(heroAId: string, heroBId: string): string {
  const [lo, hi] = heroAId <= heroBId ? [heroAId, heroBId] : [heroBId, heroAId];
  return `/battle/${lo}/${hi}`;
}

/** The evergreen profile/bio link (organic attribution for a whole platform). */
export function bioLink(source: AdSource): string {
  return buildAdLink({ source, medium: 'social', campaign: 'bio' });
}
