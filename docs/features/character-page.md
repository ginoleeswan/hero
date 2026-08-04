# The character page

> The live reference for `/character/[id]` — the app's flagship screen and the
> repo's two biggest files — plus its satellite pages `/biography/[id]` and
> `/social-web/[id]`. Read this before touching either view file: the section
> anatomy below lets you jump straight to the part you need instead of reading
> four thousand lines to find it.

## Mental model (read this first)

One hook, two thick views. `src/hooks/useHeroDetail.ts` owns every fetch and
derived value; `app/character/[id].tsx` (native, ~2,300 lines) and
`[id].web.tsx` (web, ~4,300 lines) are two renderings of its output. The views
keep only UI state — sheets, lightbox, scroll, animations.

**The honest warning:** these two files have drifted far past the repo's "thin
view layer" rule. The data layer is genuinely shared, but each view carries
thousands of lines of platform-specific presentation (native: worklet dials and
a floating chip nav; web: a dot-rail, a desktop side rail, View Transitions).
Any change to *what* the page shows must land in both files, and nothing warns
you when they diverge. Prefer pushing new logic into the hook or into
`src/components/` — do not grow the views further.

The page's signature move is the **curtain scroll**: the portrait pins to the
top (native: parallax at ~0.3× scroll with overscroll zoom; web: fixed) while a
beige content sheet rises over it with a rounded lip (`SHEET_TOP` /
`SHEET_OVERLAP` in the native file; the `.web.tsx` styles literally call it
"the curtain"). Everything below lives on that sheet.

## Arrival transitions

- **Native** — the portrait is wrapped in `Link.AppleZoomTarget`, so iOS zooms
  the tapped card into the page.
- **Web** — a View Transitions morph. `src/lib/viewTransition.ts` holds the
  machinery: `withViewTransition()` runs navigation inside
  `document.startViewTransition` (with `flushSync` — rAF would deadlock), and
  the shared name `VT_PORTRAIT` (`'vt-hero-portrait'`) tags exactly one card
  and one portrait per navigation. Cards use `src/hooks/useHeroMorph.ts`; a
  one-shot `MorphArt` latch (`markMorphDeparture` / `consumeMorphArrival`)
  hands the card's already-cached art across so the morph target never blanks.
  The return morph (`beginMorphReturn` / `claimMorphReturn`) shrinks the
  portrait back into the exact card it came from — first claimant wins, because
  duplicate view-transition names abort the whole transition.

## Section anatomy (scroll order)

Each section registers a layout anchor (`registerAnchor` in the native file)
that feeds the floating quick-nav: a chip rail on native, a left dot-rail on
web. **Trap:** the native `presentSections` memo mirrors the render conditions
by hand — add a section without updating it and its chip either never appears
or scrolls to nothing.

| Section (nav key) | Components | Data |
| --- | --- | --- |
| Hero header | portrait, favourite heart, share, TraitBand | `heroRow`, `narrative.tags` (`hero_tags`) |
| Summary | `PullQuoteBio` | ComicVine `summary`/`description` |
| Stats — "Power Profile" | native: worklet-driven SVG arc `StatDial`s; web: bars with an average tick. Total `/ 600`, "Stronger than N%" percentile chip | powerstats, `useHeroPercentile` |
| Abilities | `SignaturePowerTiles` (`pickSignaturePowers`) + `AbilitiesSection` → `PowersDecoded` explainers | powers list, `narrative.powerExplainers` |
| Trivia | `DidYouKnowDeck` | `hero_narrative_facts` via `useHeroNarrative` → `src/lib/db/heroFacts.ts` |
| Dossier | collapsible label-value card (Profile / Appearance / Connections) | hero row fields |
| Allies | three `RelatedHeroStrip`s — Enemies, Allies, Teams | `useRelatedHeroes` (`hero_relationships`); teammates dedupe against allies |
| On Screen | `MovieStrip`(s), `PortrayedBySection`, `HeroLinksRow` | `useHeroTitles`, `useHeroPortrayals`, `useHeroLinks` |
| In Print | first-appearance feature, `ComicCoverRail`, `GalleryStrip` | `useHeroIssues`, `hero_images` via `getHeroImages` |
| Family | `FamilyCanvas` + `HouseLinks` | `useHeroFamily` — see `docs/architecture/family-trees-and-houses.md` |
| Footer | "Contribute to this character" expanding menu | — |

A sticky **Compare** CTA rides the bottom of the screen (`compareStrip`,
native) and sits contextually on the Power Profile card (web), routing to
`/compare/[id]/pick`. Modals: `FirstIssueModal`, `ImageLightbox`.

## Editing and reporting

Every editable section carries a `SectionPencil` (web: `WebSectionPencil`)
that opens `ContributeSheet` (`src/components/contribute/ContributeSheet.tsx`).
The allow-list of editable fields — `EDITABLE_FIELDS`, `SUMMARY_FIELD`,
`POWERS_FIELD`, `STAT_FIELDS` — lives in `src/lib/db/contributions.ts` and
mirrors the server-side allow-list in `_contrib_field_type`; change one, change
both. Submissions queue for admin review (`submit_contribution`); admins edit
directly via `admin_edit_hero`, which logs an auto-approved contribution.
Power stats are admin-only — they feed matchups. `ReportSheet`
(`src/components/report/ReportSheet.tsx`) covers the `page` and `image` report
contexts here. The whole system is documented in
`docs/features/profile-and-gamification.md`.

## Data flow gotchas

- `planHeroLoad` distinguishes a true 404 (no DB row → poster) from a transient
  failure (retryable). The DB is the *only* source of characters — never fall
  through to a live SuperheroAPI fetch; it resolves merged-away ids and used to
  fabricate phantom pages.
- The live ComicVine read-through is an **additive merge**: every null field
  falls back to what the row already had, so a throttled/partial response fills
  gaps but never erases good DB data.
- The re-fetch gate is the terminal `comicvine_status`, **not** field nullness
  (civilians legitimately have no powers/movies; the old gate re-fetched ~13
  calls per view forever). IGDB heroes never call ComicVine at all.
- Heroes with null stats and `ai_stats_status='pending'` lazily invoke the
  `generate-hero-stats` edge function (costs money — see
  `docs/architecture/data-pipelines.md`).
- Each section shows its own inline skeleton; there is no full-page spinner.

## Satellite pages

**`/biography/[id]`** (`app/biography/[id].tsx` + `.web.tsx`) re-typesets the
raw ComicVine biography HTML via `react-native-render-html` with editorial tag
styles. `preprocessHtml` strips `<noscript>` blocks and base64 placeholder
gifs and promotes `data-src`/`data-srcset` to real attributes, or images render
blank.

**`/social-web/[id]`** (`app/social-web/[id].tsx` + `.web.tsx`) draws a
force-directed relationship graph from the `get_hero_neighborhood` RPC
(`src/lib/db/heroes/neighborhood.ts`, layout in `src/lib/graph/forceLayout.ts`)
via `SocialWebCanvas` / `SocialWebGraph` / `SocialWebFocusCard` /
`SocialWebSearch`. The character page's doorway in is a constellation preview
below the relationship shelves — `SocialWebPreview`
(`src/components/web/character/`, web: CSS-gradient portal) and its native
sibling `SocialWebPortal` (`src/components/character/`, LinearGradient portal);
both render the shared `SocialWebGraph` at `nodeScale 0.8` and tap through to
the explorer. Edge copy comes from hand-written blurbs in
`hero_relationship_blurbs` where one exists, else the
`describeRelationship()` template (`src/lib/graph/relationshipReason.ts`) —
shared rosters, then mutual-count, then honest silence. Roughly 500 famous
pairs have been triaged across five migration batches (a large share
deliberately *declined* — the template already says the true thing), against a
queue of ~3,000 fame-gated pairs and a far larger graph, so the templated
fallback dominates everywhere off the A-list.

## History

Historical specs under `docs/superpowers/` (status lines may be stale):

- `docs/superpowers/specs/2026-04-12-character-screen-enrichment-design.md`
- `docs/superpowers/specs/2026-04-12-abilities-section-design.md`
- `docs/superpowers/specs/2026-07-02-character-dossier-redesign-design.md`
- `docs/superpowers/specs/2026-07-06-power-hex-profile-design.md`
- `docs/superpowers/specs/2026-06-14-llm-narrative-design.md` (TraitBand, Did You Know)
- `docs/superpowers/specs/2026-06-07-character-gallery-design.md` and `2026-06-28-character-image-gallery-design.md`
- `docs/superpowers/specs/2026-07-06-social-web-graph-design.md`, `2026-07-06-social-web-explorer-v2-design.md`, `2026-07-06-social-web-explorer-v3-enrichments-design.md`
- `docs/superpowers/specs/2026-07-27-relationship-blurbs-design.md`
- `docs/superpowers/specs/2026-07-16-web-motion-polish-plan.md` (view-transition morphs)
