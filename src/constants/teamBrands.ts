import type { ImageSourcePropType } from 'react-native';

// Curated transparent-PNG logos for iconic teams — the team equivalent of
// PUBLISHER_BRANDS. Only the recognizable few get a real mark; every other team
// falls back to its name wordmark (masthead) / monogram (search rows).
//
// To light a team up:
//   1. Drop a TRANSPARENT PNG at  assets/teams/<slug>.png  (white/light mark so it
//      reads on the dark masthead + brand-coloured chip; use logoOnLight for dark
//      marks, or logoTint to recolour a single-colour silhouette).
//   2. Uncomment its line below and tune badgeSize to the art's real aspect ratio.
//
// Keyed by the LOWERCASED team name (matches teams.name). See PublisherBadge's
// BrandLogoView for how these render (PNG source or, if you ever swap to one, an
// SVG component).

export interface TeamLogo {
  logo: ImageSourcePropType;
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
  // ── Featured teams (assets/teams/<slug>.png) — uncomment once the PNG exists ──
  // 'avengers':                 { logo: require('../../assets/teams/avengers.png'),                 badgeSize: { width: 132, height: 26 } },
  // 'x-men':                    { logo: require('../../assets/teams/x-men.png'),                    badgeSize: { width: 92,  height: 40 } },
  // 'justice league of america':{ logo: require('../../assets/teams/justice-league-of-america.png'),badgeSize: { width: 120, height: 40 } },
  // 'fantastic four':           { logo: require('../../assets/teams/fantastic-four.png'),           badgeSize: { width: 64,  height: 40 } },
  // 'x-force':                  { logo: require('../../assets/teams/x-force.png'),                  badgeSize: { width: 120, height: 30 } },
  // 'guardians of the galaxy':  { logo: require('../../assets/teams/guardians-of-the-galaxy.png'),  badgeSize: { width: 132, height: 36 } },
  // 'new mutants':              { logo: require('../../assets/teams/new-mutants.png'),              badgeSize: { width: 120, height: 30 } },
  // 'suicide squad':            { logo: require('../../assets/teams/suicide-squad.png'),            badgeSize: { width: 120, height: 36 } },
  // 'injustice league':         { logo: require('../../assets/teams/injustice-league.png'),         badgeSize: { width: 120, height: 36 } },
  // 'thunderbolts':             { logo: require('../../assets/teams/thunderbolts.png'),             badgeSize: { width: 132, height: 28 } },
  // 'teen titans':              { logo: require('../../assets/teams/teen-titans.png'),              badgeSize: { width: 120, height: 36 } },
  // 'legion of super-heroes':   { logo: require('../../assets/teams/legion-of-super-heroes.png'),   badgeSize: { width: 120, height: 36 } },
  // 'sinister six':             { logo: require('../../assets/teams/sinister-six.png'),             badgeSize: { width: 120, height: 36 } },
  // 'birds of prey':            { logo: require('../../assets/teams/birds-of-prey.png'),            badgeSize: { width: 120, height: 36 } },
  // 'inhumans':                 { logo: require('../../assets/teams/inhumans.png'),                 badgeSize: { width: 110, height: 36 } },
  // 'young avengers':           { logo: require('../../assets/teams/young-avengers.png'),           badgeSize: { width: 132, height: 30 } },
  // 'eternals':                 { logo: require('../../assets/teams/eternals.png'),                 badgeSize: { width: 120, height: 30 } },
  // 'watchmen':                 { logo: require('../../assets/teams/watchmen.png'),                 badgeSize: { width: 120, height: 36 } },
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
