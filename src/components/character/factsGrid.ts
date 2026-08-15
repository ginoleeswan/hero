// src/components/character/factsGrid.ts — which facts a character actually has,
// and how they tile.
//
// Named `factsGrid`, not `quickFacts`, because macOS's filesystem is
// case-insensitive and `quickFacts.ts` beside `QuickFacts.tsx` resolves to the
// same path — tsc rejects it outright. `deckSelection.ts` was renamed for
// exactly this a fortnight ago.
//
// Kept apart from the component for the reason `podGrid.ts` and
// `deckSelection.ts` are: a module that imports `expo-linear-gradient` cannot be
// reached by a unit test, and the interesting part here is not the JSX. It is
// the filtering — a fact grid whose value is "how much do we know about this
// character" is only worth anything if it never renders an empty tile, and the
// catalogue is full of characters where nine of twelve fields are blank.
import { isPresentableFact } from '../../lib/characterFacts';
import type { CharacterData } from '../../types';

/**
 * The alignment column stores the SuperheroAPI's lowercase vocabulary ('good',
 * 'bad', 'neutral'). Everywhere it is shown to a reader it is title-cased —
 * web's Quick Facts does it, the taxonomy chips do it — so a raw 'good' in a
 * tile is the only place the storage vocabulary leaks to the surface.
 */
function titleCase(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export interface Fact {
  key: string;
  label: string;
  value: string;
  /** Half-width tile (a short scalar) or a full-width row (prose). */
  wide: boolean;
}

/**
 * Web's desktop Quick Facts, in its order: the short scalars tile two-up, then
 * the prose fields run full width.
 *
 * Blank fields are dropped rather than rendered empty, so the grid is always
 * dense. That means the tile count varies per character and an ODD count is
 * normal — the last half-tile is left ragged deliberately. Stretching it to
 * fill the row would make one fact look more important than the rest, which is
 * the opposite of what a fact grid is for.
 */
export function factsFor(data: CharacterData, includeFirstAppearance: boolean): Fact[] {
  const { biography: bio, appearance: app, work, connections } = data.stats;
  const height = app.height.filter((v) => isPresentableFact(v)).join(' / ');
  const weight = app.weight.filter((v) => isPresentableFact(v)).join(' / ');
  const affiliation = data.details.teams?.length
    ? data.details.teams.join(', ')
    : connections['group-affiliation'];
  const aliases = bio.aliases.filter((a) => isPresentableFact(a));

  const candidates: (Omit<Fact, 'value'> & { value: string | null | undefined })[] = [
    {
      key: 'alignment',
      label: 'Alignment',
      value: isPresentableFact(bio.alignment) ? titleCase(bio.alignment as string) : null,
      wide: false,
    },
    { key: 'origin', label: 'Origin', value: data.details.origin, wide: false },
    { key: 'gender', label: 'Gender', value: app.gender, wide: false },
    { key: 'race', label: 'Race', value: app.race, wide: false },
    { key: 'height', label: 'Height', value: height, wide: false },
    { key: 'weight', label: 'Weight', value: weight, wide: false },
    { key: 'full-name', label: 'Full name', value: bio['full-name'], wide: true },
    { key: 'alter-egos', label: 'Alter egos', value: bio['alter-egos'], wide: true },
    { key: 'birthplace', label: 'Place of birth', value: bio['place-of-birth'], wide: true },
    ...(includeFirstAppearance
      ? [
          {
            key: 'first-appearance',
            label: 'First appearance',
            value: bio['first-appearance'],
            wide: true,
          },
        ]
      : []),
    { key: 'aliases', label: 'Aliases', value: aliases.join(', '), wide: true },
    { key: 'occupation', label: 'Occupation', value: work.occupation, wide: true },
    { key: 'base', label: 'Base', value: work.base, wide: true },
    { key: 'affiliations', label: 'Affiliations', value: affiliation, wide: true },
  ];

  return candidates.filter((f): f is Fact => isPresentableFact(f.value));
}

/**
 * Whether the grid is worth drawing at all.
 *
 * A card headed "Quick Facts" holding one fact is worse than no card: it frames
 * the gap instead of filling it. Three is the floor at which the grid reads as
 * a grid.
 */
export const FACTS_FLOOR = 3;

export function hasEnoughFacts(facts: Fact[]): boolean {
  return facts.length >= FACTS_FLOOR;
}
