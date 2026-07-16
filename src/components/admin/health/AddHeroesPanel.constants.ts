import { COLORS } from '../../../constants/colors';
import type { BuildStage } from '../../../lib/db/build';

// A character added during this session — enough to show it, build it, or undo it.
// heroId is the minted internal id (PK, used to build/delete/poll); comicvineId is
// the source id (used to dedupe against ComicVine search results).
export type AddedHero = { heroId: string; comicvineId: string; name: string; image: string | null };

// Live build-stage badge for an added hero (updates as the pipeline runs).
export const STAGE_BADGE: Record<BuildStage, { label: string; color: string }> = {
  comicvine: { label: 'ComicVine', color: COLORS.orange },
  resolve: { label: 'resolving', color: COLORS.orange },
  appearances: { label: 'appearances', color: COLORS.orange },
  review: { label: 'needs review', color: COLORS.yellow },
  unresolved: { label: 'no match', color: COLORS.grey },
  failed: { label: 'failed', color: COLORS.red },
  done: { label: 'built', color: COLORS.green },
};

export type Mode =
  'name' | 'popular' | 'team' | 'volume' | 'person' | 'movie' | 'publisher' | 'power';
export type Flash = (msg: string, tone?: 'info' | 'success' | 'error' | 'pending') => void;
export const MODES: { key: Mode; label: string }[] = [
  { key: 'popular', label: '★ Popular gaps' },
  { key: 'name', label: 'By name' },
  { key: 'team', label: 'By team' },
  { key: 'volume', label: 'By series' },
  { key: 'person', label: 'By creator' },
  { key: 'movie', label: 'By film' },
  { key: 'publisher', label: 'By publisher' },
  { key: 'power', label: 'By power' },
];
// Group-mode icon + search placeholder per resource.
type IconName = 'people' | 'book' | 'brush' | 'film' | 'business' | 'flash';
export const GROUP_ICON: Record<string, IconName> = {
  team: 'people',
  volume: 'book',
  person: 'brush',
  movie: 'film',
  publisher: 'business',
  power: 'flash',
};
export const PLACEHOLDER: Record<Mode, string> = {
  name: 'Character name… (e.g. Darth Vader)',
  popular: '',
  team: 'Team name… (e.g. Jedi Order)',
  volume: 'Comic series… (e.g. Star Wars)',
  person: 'Creator name… (e.g. Jack Kirby)',
  movie: 'Film title… (e.g. The Empire Strikes Back)',
  publisher: 'Publisher… (e.g. Valiant)',
  power: 'Power… (e.g. Telepathy)',
};
