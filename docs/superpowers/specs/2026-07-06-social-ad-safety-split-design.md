# Social content: organic / advertising safety split

**Date:** 2026-07-06
**Status:** Design approved, pending implementation plan
**Area:** `scripts/social/`

> **Not legal advice.** This spec is an engineering design that encodes a
> conservative, risk-reducing posture for using third-party franchise names and
> character imagery in Mythique's marketing. It is not a legal opinion. Before
> putting real ad spend behind creative that depicts high-value IP, get an IP
> attorney's review.

## 1. Problem

`scripts/social/` generates on-brand social content (reels, matchup carousels,
character files, rankings) from the real catalogue. Selection is fame-gated, and
in this catalogue "famous" overwhelmingly means the most aggressively-policed IP
(Marvel/Disney → 316 famous chars, DC → 199, Pokémon/Nintendo → 89, manga → ~48).
The portrait layer ([lib.mjs](../../../scripts/social/lib.mjs) `portraitDataUri`)
shows an AI-generated depiction of the character, falling back to the **literal
ComicVine/IGDB studio asset** when no AI render exists.

Two different uses carry very different risk:

- **Organic posts** to Mythique's own accounts are the broadly-tolerated
  fan-content zone. Community votes, the proprietary `fame_score`, original
  commentary and design make the content transformative-leaning. Main risk is
  platform Content-ID / takedowns, not litigation.
- **Paid advertising** (boosted posts, paid user-acquisition creative, website
  hero art) is commercial promotion — spending money to distribute the imagery to
  grow the product. This is where high-value rights-holders actually act, and
  where ad platforms review creative for trademarks.

The app itself is **not monetized** (donations only), which is a favorable
non-commercial factor — but paid promotion is still the sharp edge.

## 2. Goals / non-goals

**Goals**

1. Cleanly separate the two contexts: **organic stays unrestricted**; **ads run
   through a strict, conservative safety layer**.
2. Encode a **risk-tier model** (per publisher, with per-character overrides) as
   the single source of truth for what may be depicted in an ad.
3. Make "what do we have?" a **repeatable audit** — classify the catalogue by
   risk tier and quantify the safe-to-depict pool.
4. Ship **bespoke, data-first ad generators** per surface, so paid creative leans
   on what is genuinely Mythique's (data, votes, fame_score, brand) rather than
   on copyrighted character art.

**Non-goals**

- No change to the legal status of anything; this reduces exposure, it does not
  grant rights.
- No true cut-out silhouette in v1 (needs background-removal; deferred to Phase 3).
- No change to organic generators' visual behavior (only an internal refactor so
  they can share the data layer).
- Not a monetization or App Store listing effort.

## 3. Risk-tier model

Every hero is assigned a tier by `heroes.publisher`, with a per-character override
map for exceptions. The tier governs **paid-ad depiction only**. Organic is never
tier-restricted.

### 3.1 Ad rule matrix

| Tier | Meaning | In a paid ad, a character may show… |
| --- | --- | --- |
| **S** | Do not depict | **Nothing.** Name + data only, used nominally, never as the ad's hook. No portrait and **no silhouette** (iconic silhouettes — Batman ears, Mickey ears, Superman cape — are themselves trademark/trade-dress). |
| **A** | Stylized only | **Stylized/duotone/poster only**, never the raw portrait, and never the sole subject — always inside a data-dominant composition. |
| **B** | Restrained | Stylized freely; a **small** raw portrait tolerable only when data clearly dominates the frame. |
| **C** | Safe | **Full-fidelity portrait OK.** |

### 3.2 Starting publisher → tier assignment

Derived from the current catalogue. Refined over time via the audit's
untiered-publisher report.

- **S:** Marvel, Disney, Star Wars, Pokémon, Nintendo, Shueisha, Kodansha,
  The Muppets, Sesame Street, Looney Tunes, Hanna-Barbera, Bongo, Star Trek,
  The Terminator, Conan, Teenage Mutant Ninja Turtles, Hasbro, Mattel.
- **A:** DC Comics, Image, Archie Comics, Top Cow Productions, Rebellion,
  Harvey Comics, Hellboy (Dark Horse), Capcom, Square Enix, Sega,
  NetherRealm Studios, Konami, CD Projekt Red, PlayStation Studios,
  Xbox Game Studios, Atlus, Dupuis, NBC Studios, The Boys.
- **B:** Company-Licensed, and other small/minor licensed publishers.
- **C:** In the Public Domain, Non-Fictional / historical / mythological,
  and Mythique-original imagery (not sourced from the heroes table).

### 3.3 Hard defaults (safe-by-construction)

1. **Unknown / missing / unlisted publisher → Tier A** (restricted), never C. The
   safe failure mode is "don't show the face."
2. **Official-art fallback (`image_url` / `image_md_url`) is never used in an ad**,
   any tier. Ads emit a Mythique render or nothing.

## 4. `safety.mjs` API

Single source of truth. Small, testable surface consumed by the audit and every
ad script.

```js
tierOf(hero)                      // 'S'|'A'|'B'|'C' — override map → publisher map → default 'A'
adImagery(hero)                   // 'none'|'stylized'|'small-raw'|'full' — derived from tierOf
safePortrait(hero, { context, style })  // context: 'organic'|'ad'; returns data-URI or null
safePool(sb, { maxTier, minFame })      // selection pool restricted to allowed tiers
DISCLAIMER                        // "Unofficial fan encyclopedia. Characters © their respective owners."
```

- **`tierOf`, `adImagery`** — pure functions. Unit-tested (precedence, mapping).
- **`safePortrait`** — the choke point:
  - `context:'organic'` → current behavior preserved: `portrait_url` → `image_url`
    → `image_md_url`. (Organic is the tolerated zone; dropping the fallback would
    blank long-tail heroes for no benefit.)
  - `context:'ad'` → obeys `adImagery(hero)`: `none` → `null`; `stylized` → run the
    transform on the Mythique render; `small-raw` (Tier B) → raw Mythique render
    (the composition is responsible for keeping it small/data-dominant); `full` →
    raw Mythique render. **Never** the official-art fallback.
- **`safePool`** — wraps the existing famous-pool query, keeping only heroes whose
  tier is no riskier than `maxTier`. Risk order (most → least restricted):
  `S > A > B > C`; e.g. `maxTier:'B'` admits B and C, excludes A and S. So ad
  selection cannot pull a Tier-S face.

## 5. Stylization

Implemented as **CSS/SVG filters applied in the slide HTML at render time** — zero
new dependencies, since the renderer is already Chrome (Playwright). Lives in
`ads/stylize.mjs`.

- `duotone` — SVG `feColorMatrix` two-tone map (brand navy/gold).
- `poster` — posterize via SVG `feComponentTransfer` discrete steps.
- `halftone` — SVG pattern mask over a desaturated render.

These operate on the rectangular portrait as-is and give a "clearly transformed
graphic" rather than the source render.

**Deferred — Phase 3:** a *true cut-out silhouette* (subject isolated from
background) requires background-removal (ML model or API) because the portraits
are full-frame, not alpha cutouts. Out of scope for v1; the data-first posture
means faces are incidental, so duotone/poster covers the near-term need.

## 6. Audit script — `audit-safety.mjs`

`node scripts/social/audit-safety.mjs` reads the catalogue via the public key and
writes `out/social/safety-report.md` plus a console summary:

1. **Tier coverage** — every distinct `publisher` → assigned tier, with a loud
   list of **untiered publishers** so nothing important silently defaults to A.
2. **Safe-face pool** — count of **Tier-C** characters at each fame band: exactly
   who may be shown full-fidelity in an ad.
3. **Sample exposure** — run a sample ad selection and flag each pick as
   `none` / `stylized` / `full`.

This is the "analyse what we have" deliverable, repeatable as the catalogue grows.

## 7. Bespoke ad scripts — `scripts/social/ads/`

Four data-first generators. Each appends `DISCLAIMER`, writes ad copy + alt-text,
routes all imagery through `safePortrait(..., { context:'ad' })`, and draws
selection from `safePool`.

| Script | Leans on (Mythique-owned) | Character imagery | Sizes |
| --- | --- | --- | --- |
| `ad-brand.mjs` — catalogue-scale statement | "30,000+ heroes & villains, ranked & rated," brand/type | **None** | 1:1, 9:16, 16:9, OG 1200×630 |
| `ad-matchup.mjs` — "who would win," data-forward | Community vote split + 6-stat bars + AI verdict; name plates | Default none; Tier-C full / A–B stylized | 1:1, 4:5, 9:16 |
| `ad-ranking.mjs` — leaderboard | Proprietary `fame_score` / stat ranking + metric bars | Tier-C full; others stylized or text-row | 1:1, 4:5, 9:16 |
| `ad-web-hero.mjs` — landing + share | Brand + catalogue scale | None or Tier-C | 16:9 hero, OG 1200×630 |

**Shared shell — `ads/shell.mjs`:** the current `slide()` is hardcoded to
1080×1350. Extract a parametric `{w,h}` brand shell (dots / grain / footer /
disclaimer) so all ad aspect ratios reuse one shell. Organic generators keep their
existing shell untouched.

**Common flags:** `--size 1x1|4x5|9x16|16x9|og`, `--count N`, `--dry-run`; matchup
and ranking accept their existing selection args, but the pool is `safePool()`.

## 8. File layout

```
scripts/social/
  safety.mjs          NEW  tiers, adImagery, safePortrait, safePool, DISCLAIMER
  audit-safety.mjs    NEW  catalogue risk report → out/social/safety-report.md
  ads/
    shell.mjs         NEW  parametric {w,h} brand shell + disclaimer footer
    stylize.mjs       NEW  duotone / poster / halftone CSS+SVG filters
    ad-brand.mjs      NEW
    ad-matchup.mjs    NEW
    ad-ranking.mjs    NEW
    ad-web-hero.mjs   NEW
  lib.mjs             EDIT small — expose data helpers reused by safety.mjs
  README.md           EDIT — "Advertising vs organic" section
```

## 9. Testing

- Unit tests for the pure functions in `safety.mjs`: `tierOf` (override → publisher
  → default-A precedence) and `adImagery` (tier → allowance mapping). No I/O.
  Confirm the repo's jest roots include `scripts/social/` (or colocate a small
  test) as an implementation detail.
- `audit-safety.mjs` doubles as the integration check against real data.

## 10. Phasing

- **Phase 1 — foundation:** `safety.mjs` + `audit-safety.mjs`. Runnable
  immediately to see current exposure; no visual changes yet.
- **Phase 2 — ad generators:** `ads/shell.mjs` + `ads/stylize.mjs` + the four ad
  scripts + README "Advertising vs organic" section.
- **Phase 3 — later, optional:** true cut-out silhouette via background-removal.

## 11. Organic side — explicitly unchanged

Existing generators keep their visual behavior and shell. The only refactor is
internal: organic portrait sourcing routes through
`safePortrait(hero, { context:'organic' })`, which preserves the current fallback
chain. No organic post loses an image.
