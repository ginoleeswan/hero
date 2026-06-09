# /explore Cohesion Pass — Spec

**Date:** 2026-06-09
**Goal:** Make the `/explore` home flow as one cohesive, fluid, beautiful page — turning a pile of strong-but-scattered modules into a clear narrative with motivated rhythm.

**Apply when:** after the in-flight mobile-parity work on `explore.web.tsx` merges (both touch the same file — do not run concurrently).

**Guiding principle:** Cohesion ≠ uniformity. Every variation (a dark band, a different module) must be *motivated*. Unmotivated variation reads as noise; motivated variation reads as rich.

---

## 1. Calm the canvas

The **dark stage at the top is the one cinematic dark statement.** Below the ticker, beige is a single continuous surface — the "bright universe." No scattered dark bands competing with the opening.

Exception: one deliberate **Dark Side** zone (see §3).

## 2. Order the page as chapters (the narrative)

Replace the current arbitrary section order with a deliberate arc:

| Chapter | Surface | Sections |
|---|---|---|
| **Open** | dark stage | Spotlight → Stat Pods → Today's Matchup |
| **Continue** | beige | Jump Back In *(only if signed in + has history)* |
| **The Universe** | beige | Most Iconic · Marvel Universe · DC Universe |
| **The Dark Side** | one dark zone | Villains · Anti-Heroes *(consolidated, see §3)* |
| **Discover** | beige | Era Timeline · First Appearances · Recently Added |
| **By the Numbers** | beige | Strongest Heroes · Brightest Minds |
| **For You** | beige | Your Favourites *(only if signed in)* |
| | | Footer |

Notes:
- "Jump Back In" stays high (returner value); "Your Favourites" is the warm close. Both render nothing when logged out, so no empty gaps.
- "Recently Added" is *global freshness*, not personal — it lives in **Discover**, grouping with the facet pieces.
- The two facet/feature pieces (Era Timeline, First Appearances) sit **together** in Discover so they reinforce the "explore deeper" beat instead of interrupting browse rows.
- The two ranking rows (Strongest, Brightest Minds) sit **together** in By the Numbers.

## 3. Consolidate dark into one motivated "Dark Side" zone

- Dark treatment is **reserved for villain / morally-dark content** — there it's tonal storytelling (shadow = danger), not decoration.
- Merge **Villains + Anti-Heroes** into a single dark band ("The Dark Side") so darkness is a *place* in the narrative, not scattered punctuation.
- **X-Men → normal beige row.** Its dark treatment was arbitrary (no thematic reason mutants are in shadow); removing it calms the page and loses nothing.
- Result: exactly **two motivated dark moments** — the cinematic open, and the villains' zone. Both earn their contrast.

## 4. Demote Universe Breakdown (the donut)

The donut is the one module that fights the page's horizontal-scroll motion (it's a static centerpiece amid scrolling rows). Remove it from the scroll flow:
- **Preferred:** fold its publisher counts into the **Stat Pods** (the "Encyclopedia" pod already shows the Marvel·DC split), and offer the full donut as a **bottom sheet / expand** off that pod.
- **Acceptable fallback:** keep the donut but move it into the dark stage as a compact companion to the stat pods, not as a standalone beige-canvas section.
- Either way: no standalone donut block interrupting the carousel rhythm.

## 5. Unify motion & detail

Across every card family (RowCard, RankingCard, CoverGallery card, EraTimeline card, matchup portraits):
- **One** hover behaviour (lift + shadow) and timing.
- **One** corner-radius scale.
- **One** image treatment (contentFit/contentPosition, transition).
- Consistent first-card alignment to the page gutter and consistent vertical spacing between sections (the shared accent-bar + eyebrow + title header is already consistent — keep it).

---

## Sequencing

1. **§1 + §2 + §3** first — calm + reorder + consolidate dark. ~80% of the felt improvement, low risk (mostly moving/retreating existing JSX in `explore.web.tsx`).
2. **§4** — demote the donut.
3. **§5** — motion/detail polish.

## Out of scope (deliberately)

- No new routes. The facet pieces (era, first appearances) remain home modules that route into existing destinations (`category/[slug]`, `character/[id]`, `compare/...`). If "browse by era" later wants a real slice, it extends `category/[slug]` — not a new page.
- Mobile parity is its own in-flight workstream; this pass assumes the unified (all-width) dark stage from that work is in place.
