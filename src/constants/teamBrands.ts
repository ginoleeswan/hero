import type { BrandLogo } from './publishers';
import AvengersLogo from '../../assets/teams/avengers.svg';
import XMenLogo from '../../assets/teams/x-men.svg';
import JusticeLeagueLogo from '../../assets/teams/justice-league-of-america.svg';

// Curated logos for iconic teams — the team equivalent of PUBLISHER_BRANDS. Only
// the recognizable few get a real mark; every other team falls back to its name
// wordmark (masthead) / monogram (search rows).
//
// To light a team up:
//   1. Drop a TRANSPARENT logo (SVG — the repo bundles SVGs via
//      react-native-svg-transformer — or a transparent PNG) in assets/teams/.
//   2. Import it and add an entry below, keyed by the LOWERCASED team name
//      (matches teams.name), with badgeSize set to the art's real w/h aspect.
//   3. For a single-colour mark that needs to read on the dark masthead, set
//      logoTint: '#FFFFFF'. Leave multi-colour marks untinted. Use logoOnLight
//      for dark marks meant for a light chip.
//
// See PublisherBadge's BrandLogoView for how these render (SVG component or PNG).

export interface TeamLogo {
  logo: BrandLogo;
  /** Intrinsic art box — drives aspect ratio for the masthead + chip sizing. */
  badgeSize: { width: number; height: number };
  /** Logo reads best on a light chip (dark/coloured mark). */
  logoOnLight?: boolean;
  /** Recolour a single-colour silhouette to this ink (e.g. '#FFFFFF'). */
  logoTint?: string;
}

const norm = (s: string) => s.trim().toLowerCase();

// Default box for hosted (logo_url) logos whose true aspect we don't know — a wide
// wordmark slot; BrandLogoView contains within it so nothing distorts.
const URL_LOGO_BOX = { width: 132, height: 40 };

export const TEAM_LOGOS: Record<string, TeamLogo> = {
  // Single black wordmarks → tinted white so they read on the dark masthead.
  avengers: { logo: AvengersLogo, badgeSize: { width: 1621, height: 576 }, logoTint: '#FFFFFF' },
  'justice league of america': {
    logo: JusticeLeagueLogo,
    badgeSize: { width: 500, height: 402 },
    logoTint: '#FFFFFF',
  },
  // Multi-colour (red/yellow/black) — shown as-is.
  'x-men': { logo: XMenLogo, badgeSize: { width: 479, height: 256 } },

  // ── Remaining featured teams — add a file + entry to light them up ──
  // 'fantastic four':          { logo: FantasticFourLogo, badgeSize: { width: 64,  height: 40 } },
  // 'x-force':                 { logo: XForceLogo,        badgeSize: { width: 120, height: 30 } },
  // 'guardians of the galaxy': { logo: GuardiansLogo,     badgeSize: { width: 132, height: 36 } },
  // 'new mutants', 'suicide squad', 'injustice league', 'thunderbolts',
  // 'teen titans', 'legion of super-heroes', 'sinister six', 'birds of prey',
  // 'inhumans', 'young avengers', 'eternals', 'watchmen'
};

/**
 * Logo for a team: a curated bundled mark if we have one, else a hosted
 * `teams.logo_url` if set, else undefined (caller shows the wordmark/monogram).
 */
export function teamLogo(team: {
  name: string;
  logo_url?: string | null;
}): TeamLogo | undefined {
  const curated = TEAM_LOGOS[norm(team.name)];
  if (curated) return curated;
  if (team.logo_url) return { logo: { uri: team.logo_url }, badgeSize: URL_LOGO_BOX };
  return undefined;
}
