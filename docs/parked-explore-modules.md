# Parked Explore modules

Editorial modules that were built for the Explore home, then **cut in the
curation pass** (Explore was an overloaded "dumping ground" of horizontal
rails). They are intentionally **kept, not deleted** — each is a finished,
good-looking component with a real data source, waiting for the right home.

Both platform variants exist for each (`src/components/home/<Name>.tsx` native +
`src/components/web/home/<Name>.tsx` web). They are **not imported anywhere** —
that is by design. Before re-adding any to a screen, check it still matches the
current design system (surface tokens, fonts, spacing).

The app's IA is a deliberately tight 4-tab structure — **Explore · Search ·
Arena · Profile** — with no menu room for new top-level destinations. So these
wait for either an Arena/Discovery expansion or a future browse surface, **not**
a new orphan route reachable from nowhere.

| Module | What it is | Data source | Candidate home |
| --- | --- | --- | --- |
| `EraTimeline` | "Comics History" — heroes bucketed by comic age, hung off an orange spine (Golden → Modern) | `getEraTimeline()` (`db/heroes/categories`) | A future Discovery/browse surface, or a section on a "Browse the Universe" page |
| `CoverGallery` | "Origins" — first-appearance comic covers as a gallery wall; taps open the character | first-appearance covers | A future Origins/discovery surface |
| `GreatestRivalries` | "Settle the Debate" — split-portrait matchup carousel into the compare arena | `getTopRivalries()` | **Redundant today** — Arena already ships `versus/RivalriesRail`. Keep only if it later replaces that rail as a richer treatment |

## Placed (no longer parked)

- `HallOfInfamy` ("Public Enemies" — villains by enemy in-degree, `getMostFeared()`)
  now lives on the **Arena** (`/versus`, both platforms), after the rivalries
  rail. The web variant takes a `flush` prop to drop its self-gutter inside the
  Versus feed column.

_Last reviewed: 2026-06-29._
