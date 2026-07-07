# Social content pipelines

Generate on-brand social content from **real catalogue data**, styled like the
app. Four generators share one data layer (`lib.mjs`):

| Script | Output | Content |
| --- | --- | --- |
| `generate-reels.mjs` | 9:16 `.mp4` | fast-cut "who would win" video (TikTok / Reels / Shorts) |
| `generate-carousels.mjs` | 4:5 `.png` set | matchup breakdown carousel (Instagram) |
| `generate-bios.mjs` | 4:5 `.png` set | rich character-file carousel |
| `generate-rankings.mjs` | 4:5 `.png` set | Top-N leaderboard carousel |

Everything reads off the **public (publishable) Supabase key** — the same read
path the app uses, no secret key. Per matchup it pulls portraits, the six stats,
`fame_score`, the community vote split (`get_matchup_tally`), the computed winner,
and the verdict (`generate-verdict`). Matchup selection favours popular, closely
voted (argument-starting) pairs.

## One-time setup

```sh
git pull
yarn add -D playwright-core        # the renderer
brew install ffmpeg                # reels (video) only; carousels need no ffmpeg
# also: Google Chrome installed (used by default), and
# EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY set in .env.local
```

Node >= 18. If Chrome is elsewhere, set `PW_CHROME=/path/to/chrome`. If `ffmpeg`
is not on `PATH`, set `FFMPEG=/path/to/ffmpeg`.

## Commands

Add `--dry-run` to any of these to preview the picks without rendering.

```sh
# 1. Reels (TikTok / Reels / Shorts)
node scripts/social/generate-reels.mjs --count 8
node scripts/social/generate-reels.mjs --matchup "Goku,Superman"

# 2. Matchup carousels (Instagram, 4 slides)
node scripts/social/generate-carousels.mjs --count 8
node scripts/social/generate-carousels.mjs --matchup "Goku,Superman"

# 3. Character files (Instagram, up to 8 slides)
node scripts/social/generate-bios.mjs --count 8
node scripts/social/generate-bios.mjs --character "Batman"

# 4. Rankings (Instagram, Top-N leaderboard)
node scripts/social/generate-rankings.mjs --alignment bad          # most famous villains
node scripts/social/generate-rankings.mjs --alignment good         # most famous heroes
node scripts/social/generate-rankings.mjs --by strength            # strongest
node scripts/social/generate-rankings.mjs --by intelligence --publisher "Marvel Comics"
node scripts/social/generate-rankings.mjs --alignment bad --title "TOP 10 SCARIEST VILLAINS"
```

`--count N` sets how many to make (default 6, or the leaderboard size for
rankings). `--by` accepts: `fame` (default), `strength`, `speed`, `intelligence`,
`durability`, `power`, `combat`.

## Output

Everything lands in the git-ignored `out/social/` folder, each with a ready
`caption.txt`:

- reels → `out/social/<a>-vs-<b>/video.mp4`
- matchup carousels → `out/social/<a>-vs-<b>/carousel/slide-1..4.png`
- character files → `out/social/bio-<name>/slide-1..N.png`
- rankings → `out/social/ranking-<title>/slide-1..N.png`

The matchup carousel is 4 slides: cover / hook, head to head, verdict + winner,
fan vote + CTA.

## Advertising vs organic

There are **two tracks**, and they follow different rules:

- **Organic** (the four generators above) — content for Mythique's own accounts.
  The broadly-tolerated fan-content zone; **unrestricted** (uses AI portraits and,
  as a fallback, the source ComicVine/IGDB image).
- **Advertising** (`ads/`) — creative for anything you'd put **ad spend** behind
  (paid social, paid UA, the website hero). This is commercial promotion, so it
  runs through a strict, conservative **safety layer** and is **data-first** — it
  leans on what's genuinely ours (catalogue scale, community votes, the fame
  score, the design system), not on franchise characters.

Design + rationale: `docs/superpowers/specs/2026-07-06-social-ad-safety-split-design.md`.

### The safety layer — `safety.mjs`

Single source of truth for what a character may show **in a paid ad**. Each hero
gets a risk tier from its `publisher` (`S/A/B/C`, with per-character overrides):

| Tier | In a paid ad… | Who |
| --- | --- | --- |
| **S** | nothing (name + data only) | Marvel, Disney, Nintendo/Pokémon, manga, DC-adjacent majors, HP, LOTR, Alien… |
| **A** | stylized only (duotone) | DC Comics, Dark Horse, major game studios |
| **B** | small raw portrait when data dominates | smaller / licensed publishers |
| **C** | full-fidelity portrait | public-domain, non-fictional, Mythique-original |

Hard invariants: unknown publisher → **Tier A** (never C); **ads never use the
official-art fallback** (`safePortrait(hero, {context:'ad'})` emits your render or
nothing); every ad slide carries the disclaimer footer. `matchup`/`ranking` are
extra-conservative: **no franchise faces** — plates/names + data only.

### Audit — what's in the catalogue

```sh
node scripts/social/audit-safety.mjs   # → out/social/safety-report.md
```

Classifies all ~35k heroes by tier, lists untiered publishers to review, and
quantifies the safe-to-depict pool. Re-run after catalogue growth.

### Ad generators — `ads/`

```sh
# Brand ads — six concepts, each a different facet of the app, zero character IP
node scripts/social/ads/ad-brand.mjs --style constellation --size all
#   --style scale | constellation | powerstats | versus | leaderboard | dossier | all
#   --size  1x1 | 4x5 | 9x16 | 16x9 | og | all

# Matchup — data-first "who would win" (community vote + stat tug-of-war, no faces)
node scripts/social/ads/ad-matchup.mjs --matchup "Goku,Superman" --size all   # 1x1|4x5|9x16

# Ranking — leaderboard on the fame score / a stat (names + rank countdown)
node scripts/social/ads/ad-ranking.mjs --by fame --count 10 --size all
#   --by fame | strength | speed | intelligence | durability | power | combat

# Website hero + OG share card (left-aligned landing composition)
node scripts/social/ads/ad-web-hero.mjs --size all   # 16x9 | og | wide

# A full posting week in one command → out/social/week-YYYY-MM-DD/
# 7 day-prefixed posts (brand/matchup/ranking mix, rotates weekly) + captions + PLAN.md
node scripts/social/ads/batch-week.mjs               # 4x5 feed; --size 9x16 for stories
node scripts/social/ads/batch-week.mjs --dry-run     # print the plan only
```

Shared: `ads/shell.mjs` (parametric `{w,h}` brand shell + disclaimer) and
`ads/stylize.mjs` (zero-dep SVG duotone/poster/halftone). Everything lands in
`out/social/ad-*/`.

**The line not to cross:** paid ads that show a recognizable Tier-S face (even
stylized). The safety layer is built to make that hard, but it's a judgment call —
keep ad spend on the data-first material.

Unit tests for the safety logic: `yarn test:social`.

## Posting

- **Reels are silent by design.** Add a **trending sound** in-app; the cuts are
  spaced to snap to a beat, and in-app audio gets far more reach than baked-in
  music. Use a **Creator** account, not Business (Business accounts can only use
  the commercial music library, which excludes trending sounds).
- **Carousels** drive swipes and saves; the payoff (winner / #1) is intentionally
  held to the last slide so people swipe to the end. Upload slides in order.
- Paste the caption from each folder's `caption.txt`.

## Files

- `lib.mjs` — shared: env, public-key Supabase client, matchup selection, data
  hydrate, relationships/facts helpers, fonts/portraits, the slide shell, and the
  render helpers (`renderPng`, `renderVideo`).
- `generate-reels.mjs`, `generate-carousels.mjs`, `generate-bios.mjs`,
  `generate-rankings.mjs` — the four templates + CLI.
