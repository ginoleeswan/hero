# The character page

> The live reference for `/character/[id]` — the app's flagship screen and the
> repo's two biggest files — plus its satellite pages `/biography/[id]` and
> `/social-web/[id]`. Read this before touching either view file: the section
> anatomy below lets you jump straight to the part you need instead of reading
> four thousand lines to find it.

## Progressive mount on `/biography/[id]`

Native renders the document a couple of `<h2>` sections at a time
(`splitSections` in `src/hooks/useBiography.ts`, `FIRST_PAINT_SECTIONS` /
`SECTIONS_PER_BATCH` in the screen). Rendering it whole is what made a big
biography stall on open: `react-native-render-html` parses, builds a render tree
and mounts every node in one synchronous commit — thousands of views and ~240
image requests for Batman. Batches land via `InteractionManager`, so none of
them collide with a gesture.

Everything eventually mounts; this is **not** windowing. The contents rail jumps
to measured offsets, and a section that never mounted has none.

Images are the other half. ComicVine's markup carries **no width or height** —
only a `srcset` descriptor — so the default `img` renderer had to fetch each
image to measure it before it could lay out. On a document with ~240 of them
that is a continuous stream of reflows under the reader's thumb, which is what
"choppy" actually was. `BiographyImage` reserves a fixed box up front and shows
a `Skeleton` inside it until the image fades in, so the page height is final the
moment it mounts and nothing below an image ever moves.

The box is a guess (`contentFit="contain"` letterboxes rather than crops) and it
is deliberately **not** resized once the real dimensions are known — a
correction after paint is precisely the reflow this exists to remove. The
`srcset` width is used only to avoid upscaling a small image past its own
resolution.

Two things to keep in mind if you touch it:

- Margins only collapse **within** one `RenderHTML` instance, so each chunk
  after the first pulls back by the paragraph's bottom margin
  (`styles.sectionChunk`, derived from `TAG_STYLES.p` so the two can't drift).
  Without it every heading gains 14px of unintended air.
- `splitSections` is a pure re-slice — the chunks rejoin to the original, and a
  test asserts it. A `<h2>` nested inside another element would leave unbalanced
  tags in a chunk, which htmlparser2 auto-closes rather than failing on.

## The biography payload

`heroes.description` is ComicVine's long-form prose and it is **not fetched by
this screen**. The distribution is extreme — median 1.2 KB, p95 23 KB, and the
worst are the most-visited characters: Spider-Man 417 KB with ~240 `<img>`
tags, Batman 398 KB, 45 MB across the catalogue.

The character page never rendered a character of it; it only asked "does one
exist?" to decide whether to offer the link. So:

- `getHeroById` selects `HERO_ROW_SELECT` (`src/lib/db/heroes/columns.ts`) —
  every column except `description`, plus a `has_description` computed field
  (a SQL function, so no storage and no table rewrite). Measured against the
  live API, Spider-Man's row went from **447,000 bytes to 22,070**.
- `HeroDetails.description` became `HeroDetails.hasBiography: boolean`.
- `getHeroBiography` / `useHeroBiographyHtml` fetch the HTML, and only
  `/biography/[id]` calls them.
- Row fetches are typed `HeroRow`, not `Hero` — `Omit<Hero,'description'>`.
  Keeping the `Hero` type would have typechecked while `hero.description` read
  `undefined` at runtime and every biography silently looked absent.

**Trap:** PostgREST has no "all columns except" syntax, so `HERO_ROW_COLUMNS`
lists 83 names by hand. A column added by a later migration would exist in the
database and in the generated types, typecheck everywhere, and never arrive.
`__tests__/lib/heroColumns.test.ts` parses `database.generated.ts` and fails if
the two disagree — add the new column there and the test goes green.

One deliberate loss: the web character page used the biography as an SEO
description fallback, so 543 heroes with a biography but no summary now take the
generic line. Crawlers are unaffected — `api/bot-page.ts` does its own query and
still reads `description`.

## Mental model (read this first)

One hook, two thick views. `src/hooks/useHeroDetail.ts` owns every fetch and
derived value; `app/character/[id].tsx` (native, ~2,300 lines) and
`[id].web.tsx` (web, ~4,300 lines) are two renderings of its output. The views
keep only UI state — sheets, lightbox, scroll, animations.

**The honest warning:** these two files have drifted far past the repo's "thin
view layer" rule. The data layer is genuinely shared, but each view carries
thousands of lines of platform-specific presentation (native: worklet dials and
a floating chip nav; web: a dot-rail, a desktop side rail, View Transitions).
Any change to _what_ the page shows must land in both files, and nothing warns
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

| Section (nav key)       | Components                                                                                                                    | Data                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Hero header             | portrait, favourite heart, share, TraitBand                                                                                   | `heroRow`, `narrative.tags` (`hero_tags`)                                  |
| Summary                 | `PullQuoteBio` — `flat` on every narrow layout; see the card-language note below                                              | ComicVine `summary`/`description`                                          |
| Stats — "Power Profile" | native: worklet-driven SVG arc `StatDial`s; web: bars with an average tick. Total `/ 600`, "Stronger than N%" percentile chip | powerstats, `useHeroPercentile`                                            |
| Abilities               | `SignaturePowerTiles` (`pickSignaturePowers`) + `AbilitiesSection` → `PowersDecoded` explainers                               | powers list, `narrative.powerExplainers`                                   |
| Trivia                  | `DidYouKnowDeck`                                                                                                              | `hero_narrative_facts` via `useHeroNarrative` → `src/lib/db/heroFacts.ts`  |
| Dossier                 | collapsible label-value card (Profile / Appearance / Connections)                                                             | hero row fields                                                            |
| Allies                  | three `RelatedHeroStrip`s — Enemies, Allies, Teams                                                                            | `useRelatedHeroes` (`hero_relationships`); teammates dedupe against allies |
| On Screen               | `MovieStrip`(s), `PortrayedBySection`, `HeroLinksRow`                                                                         | `useHeroTitles`, `useHeroPortrayals`, `useHeroLinks`                       |
| In Print                | first-appearance feature, `ComicCoverRail`, `GalleryStrip`                                                                    | `useHeroIssues`, `hero_images` via `getHeroImages`                         |
| Family                  | `FamilyCanvas` + `HouseLinks`                                                                                                 | `useHeroFamily` — see `docs/architecture/family-trees-and-houses.md`       |
| Footer                  | "Contribute to this character" expanding menu                                                                                 | —                                                                          |

A sticky **Compare** CTA rides the bottom of the screen (`compareStrip`,
native) and sits contextually on the Power Profile card (web), routing to
`/compare/[id]/pick`. Modals: `FirstIssueModal`, `ImageLightbox`.

### The page's card language — there is no white card

Sections on the beige body are a **5% ink tint with a hairline border and no
shadow** (`statsCard` and its siblings in `app/character/[id].tsx`). Nothing
here is `#fff`.

`PullQuoteBio` used to be, and it showed: a white card with a drop shadow on
beige reads as a foreign box rather than a section of the page. Its comment
even claimed the card was "matching the page's other sections" — it wasn't,
and the comment two lines above it still described the intended treatment as
"no card chrome".

Every narrow layout (native + mobile web) now passes `flat`, which drops the
card **and** the accent bar together. That pairing is deliberate: the bar only
works as the card's left EDGE, cropped by the card's overflow. Standing alone
on the sheet it is a decorative stripe beside a paragraph. The pull-quote
effect comes from the type — 23px Flame against 15px FlameSans — not from
chrome. Desktop web keeps the card, where a wide column has room for it.

## Tablets: one body, two stages

`breakpointFor` is width-only, and that is not enough here. An iPad Pro 13" is
1032x1376 in portrait and 1376x1032 in landscape; both are `wide`, and they are
opposite shapes. On a screen built around one big portrait the **shape** is what
decides the layout, so `tabletShape(width, height)` (`src/constants/layout.ts`)
returns `tall` or `wide` and the page branches on that.

**The fault it fixes, as a number.** The hero was `winW * heroImageAspect(...)`,
and that aspect _floors at 1.1_. On a landscape iPad it therefore asked for a
**1514pt-tall** image inside a 1032pt viewport — one and a half screens of
portrait before a word of content. Portrait was 1135pt of 1376 (82%), which is
more than a phone's 66% but still shows the identity and the sheet's lip, so it
is left alone.

|            | phone 390x844 | iPad portrait 1032x1376 | iPad landscape 1376x1032 |
| ---------- | ------------- | ----------------------- | ------------------------ |
| hero block | 390 x 557     | 1032 x 1135             | **605 x 666**            |
| structure  | stacked       | stacked                 | split                    |

**`heroBlock(width, height)` narrows the block; it never caps the height.** That
is load-bearing, not a style choice: the Apple Zoom morph needs the rail card
and the hero image to be the same shape or navy shows through mid-flight (see
`heroImageAspect`'s own comment). Capping the height would squash the aspect and
break the morph. Shrinking the width and letting `width * aspect` follow keeps
the block a portrait at every size, which
`__tests__/constants/layout.test.ts` asserts directly.

**In `wide`:**

- the art is a fixed left column and the sheet scrolls beside it
  (`contentContainerStyle.paddingLeft = hero.width`);
- the parallax transform is dropped — the art no longer sits behind the
  scrolling sheet, so there is nothing to parallax against;
- `identityNode` is hoisted out of the JSX because it now has two homes: the
  bottom of the hero spacer when stacked, and the bottom of the art column when
  split. **`identityColumn` anchors `top: 0` with an explicit height, never
  `bottom: 0`** — the column is only as tall as the art, and anchoring to the
  screen drops identity text coloured for a dark scrim onto the beige below it,
  where it is beige on beige;
- the scroll needs its own `paddingTop`. The hero spacer used to supply it, so
  without it the first trait chip renders under the status bar.

**The gutter and the two caps.** Eight section styles hard-code
`paddingHorizontal: 20`; `sheetColumn` carries `sectionGutter(width, 20) - 20`
once so they all land on the tablet gutter and the phone delta is zero. It is
deliberately **not** capped and centred — that would put the sheet's left edge
at 78pt while the identity sits at 20pt, which is the two-left-edges fault. The
caps go where they cost no alignment: `PROSE_MAX_WIDTH` on the summary, and 420
on the Compare pill (unbounded it is a 1336pt band, and a phone's 362pt is
already under it).

**Still to do:** web's desktop body is `mainCol` beside a 300pt sticky `sideCol`
(`app/character/[id].web.tsx`), and native has no equivalent. It shows: in
landscape there is ~450pt of empty beige under the art column that the side
column is exactly the right shape to fill. Web splits from `width >= 700`, and
at 1032 with our gutter that is a 644 + 300 division — so this applies to
**both** tablet orientations, not just landscape.

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
  failure (retryable). The DB is the _only_ source of characters — never fall
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
raw ComicVine biography HTML with editorial tag styles — `react-native-render-html`
on native, a `<style>` + `dangerouslySetInnerHTML` block on web.

Both views are thin over **`src/hooks/useBiography.ts`**, which owns every
transform so the platforms can't drift:

| Step              | Why                                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preprocessHtml`  | strips `<noscript>` blocks and base64 placeholder gifs, promotes `data-src`/`data-srcset` — or images render blank                                                                                 |
| `flattenTables`   | `<table>` → `<ul>`; RNRH has no table support without the (uninstalled) plugin, and native used to bin tables via `ignoredDomTags`, silently losing ComicVine's power/appearance grids             |
| `extractHeadings` | anchors each `<h2>` and returns the `toc` the desktop contents rail reads                                                                                                                          |
| `splitLead`       | lifts the opening letter out so native can set a drop cap — web gets it from `::first-letter`, which RN has no equivalent for. Declines when the document opens with a tag, heading or punctuation |
| `resolveBioLink`  | ComicVine `/slug/4005-{cvId}/` links resolve to an in-app character page; everything else is absolutised. Only the _acting_ (`Linking.openURL` vs `window.open`) stays in the views                |

Native's identity stage mirrors the web header in four layers: a blurred
portrait backdrop (`HeroImage blurRadius`, scaled past the frame so the blur's
edges never show), a vertical scrim that guarantees the title's contrast over
any portrait, a deep-ink top cap that fuses the stage into the status bar, and
the orange seam at the beige boundary. The reading column closes on a colophon
rather than stopping dead — `PageEndCap` is web-only by design (it exists for
the iOS Safari toolbar zone) and correctly renders nothing on native.

The drop cap is absolutely positioned with the lead paragraph padded around it:
RN has no `float`, so the indent is paid by the whole paragraph.

### The contents pill

Desktop keeps its sticky numbered sidebar. Mobile — both platforms — gets
`src/components/biography/BiographyContents.tsx` instead: a pill docked at the
bottom showing `n of m`, the current section name and a progress hairline,
which opens into an ink `Sheet` listing every section. It hides on scroll-down,
returns on scroll-up, and doesn't render below `MIN_SECTIONS_FOR_CONTENTS` (3)
— which lives in `useBiography` because both screens gate on it _before_ the
pill exists. The chevron points **up**, and rotates down in the sheet header, so
one glyph both opens and dismisses; a `›` would promise navigation to a page.

The component is platform-neutral. The two things that genuinely differ are
injected by the screens:

|        | Active section                                                         | Progress + hide           | Jump             |
| ------ | ---------------------------------------------------------------------- | ------------------------- | ---------------- |
| Web    | `IntersectionObserver` on the `bio-s{n}` ids, `-45%` root margin       | passive `scroll` listener | `scrollIntoView` |
| Native | `measureLayout` per heading → offsets compared in a Reanimated worklet | same worklet              | `scrollTo`       |

Native's half is the awkward one — RNRH exposes no node positions, so
`SectionAnchor.tsx` supplies a custom `h2` renderer that wraps each heading and
measures it against the scroll content. Three things that bit:

- The renderer is a **module constant** reading deps from context. Built inside
  the screen's render it gets a new identity per state update, and RNRH remounts
  the subtree when a renderer's identity changes — re-measuring the whole
  document on every update the pill itself causes.
- `onLayout` reports `y` relative to the heading's immediate parent, deep in the
  transient render tree. It's only the trigger; `measureLayout` does the work.
- Unmeasured headings publish as `Infinity`, never `0`. At `0` every section
  reads as current the moment the page opens — and images loading in above a
  heading shift it later anyway, hence re-measuring on `onContentSizeChange`.

Only `activeIndex` and a whole-percent `progress` cross to JS, both gated on
actual change, so a full read costs a few dozen renders rather than one a frame.

The biography screen runs **`headerShown: false`** with its own floating back
control, and that is load-bearing rather than cosmetic. iOS 26 gives every
screen that has a header a `UIScrollEdgeEffect` over its content ScrollView —
a light blur band under the header items, on by default (`automatic`). Over
this page's flat deep-ink stage it read as a grey scrim across the status bar,
and it duplicates what the stage's own top cap already does. The surgical fix,
`scrollEdgeEffects: { top: 'hidden' }`, is **not reachable through
expo-router's Stack options** — only react-native-screens' raw `<Screen>` or
its gamma `<ScrollViewMarker>`, and the latter is a Fabric native component
that renders an empty view on any build predating it, so it is not OTA-safe.
No header means no header-anchored effect.

Any other native screen that pairs a transparent header with a dark full-bleed
top will hit the same thing on iOS 26+.

### One tint for both sides of the header

The character screen's header bar is two different mechanisms wearing the same
costume. The back chevron is the **native** back button, coloured by
`headerTintColor`. The share glyph is a custom `SymbolView` inside
`headerRight` — and a custom `headerRight` child **does not inherit the header
tint**, so it must be told the colour explicitly. It had been hard-coded to
`COLORS.black`, which iOS 26 then framed inside its glass header chip: a dark
smudge on the right, a brand-orange chevron on the left.

Both now read the module-level `HEADER_TINT`. If you add another
`headerRight` control here, tint it from that constant — hard-coding a colour
is how the two sides drifted apart in the first place.

Web's `scroll-margin-top` on `h2` must clear `TOPBAR_HEIGHT` — it was 32px
against a 64px fixed bar, so every desktop contents jump landed the heading
half-buried under the nav.

**`/social-web/[id]`** (`app/social-web/[id].tsx` + `.web.tsx`) — both
platforms now render the SAME three.js constellation, `UniverseScene.dom.tsx`
(a `'use dom'` component: an iframe on web, a WebView on native), fed by the
`get_hero_neighborhood` RPC (`src/lib/db/heroes/neighborhood.ts`) with
`SocialWebFocusCard` / `SocialWebSearch` / `UniverseTrail` /
`ShareUniverseButton` as chrome. The old native-only flat canvas
(`SocialWebCanvas` + `forceLayout`) is retired from this screen;
`SocialWebGraph` still powers the character-page portal previews. The character page's doorway in is a constellation preview
below the relationship shelves — `SocialWebPreview`
(`src/components/web/character/`, web: CSS-gradient portal) and its native
sibling `SocialWebPortal` (`src/components/character/`, LinearGradient portal);
both render the shared `SocialWebGraph` at `nodeScale 0.8` and tap through to
the explorer. Edge copy comes from hand-written blurbs in
`hero_relationship_blurbs` where one exists, else the
`describeRelationship()` template (`src/lib/graph/relationshipReason.ts`) —
shared rosters, then mutual-count, then honest silence. Roughly 500 famous
pairs have been triaged across five migration batches (a large share
deliberately _declined_ — the template already says the true thing), against a
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

## The header bar's two sides do not tint the same way

`HEADER_TINT` (`app/character/[id].tsx`) colours both sides of the floating
header — the back chevron via `headerTintColor`, and the share glyph explicitly,
because **a custom `headerRight` child does not inherit the header tint**.

Two consequences, both learned the hard way:

- **The glyph must be told a colour.** Remove `tintColor` and it does not fall
  back to the chevron's colour; it falls back to SymbolView's own default, which
  renders dark against the portrait this header floats over.
- **iOS may ignore `headerTintColor` for the native chevron.** Inside the glass
  header it draws that chevron in its own material colour, so setting the tint
  to an accent coloured only the half we own — an orange share glyph opposite a
  white chevron. The tint is therefore beige, matching what iOS actually draws,
  and the bar reads as one control set rather than two.

A nav-bar control is chrome. Colour there competes with the artwork it floats
over, and the accent belongs to the content below.
