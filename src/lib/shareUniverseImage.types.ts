// Shared between shareUniverseImage.ts (native) and .web.ts so the poster payload
// has one definition. Mirrors ShareableUniverseCard's props.
import type { UniverseHero } from '../components/profile/ShareableUniverseCard';

export interface UniversePosterData {
  displayName: string;
  avatarUri: string | null;
  insight: string;
  chips: string[];
  topHeroes: UniverseHero[];
  savedCount: number;
  badgesEarned: number;
}
