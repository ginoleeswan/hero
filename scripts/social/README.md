# Social content pipelines

Generate on-brand social content from **real matchup data**, styled like the
app's matchup screen. Two tools share one data layer (`lib.mjs`):

- **`generate-reels.mjs`** — fast-cut 9:16 videos for TikTok / Reels / Shorts (`.mp4`)
- **`generate-carousels.mjs`** — 4:5 matchup carousel slides (`.png` set)
- **`generate-bios.mjs`** — 4:5 character-showcase "character file" carousel (portrait, power stats, profile dossier, aliases) — flexes the catalogue depth
- **`generate-rankings.mjs`** — 4:5 "Top N" countdown leaderboard carousel, built on `fame_score` or any stat (e.g. most famous villains, strongest characters)

## What they do

Per matchup, using only the public (publishable) Supabase key — the same read
path the app uses, no secret key:

- portraits + the six stats + `fame_score` from the `heroes` table
- the community vote split from the `get_matchup_tally` RPC
- the winner, computed from the stats (more stat wins), matching the app
- the verdict line from the `generate-verdict` edge function (cached, else Gemini)

**Selection** favours matchups people actually argue about: popular characters,
a real vote history (`>= 40` votes), and a close split (within 18 points of
50/50). It seeds with curated marquee rivalries, then fills with random popular
cross-universe pairs. Pass `--matchup "A,B"` to force one.

## Requirements (run locally, not in CI)

- Node >= 18
- `yarn add -D playwright-core` and a Chrome/Chromium
  (defaults to `channel: "chrome"`; or set `PW_CHROME=/path/to/chromium`)
- `ffmpeg` on `PATH` (`brew install ffmpeg`), or set `FFMPEG=/path/to/ffmpeg`
  — **reels only**; carousels need no ffmpeg
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY` in `.env.local`

## Usage

```sh
# preview the matchups either tool would pick (no rendering)
node scripts/social/generate-reels.mjs --count 8 --dry-run

# TikTok/Reels videos -> out/social/<slug>/video.mp4 + caption.txt
node scripts/social/generate-reels.mjs --count 8

# Instagram matchup carousels -> out/social/<slug>/carousel/slide-1..4.png + caption.txt
node scripts/social/generate-carousels.mjs --count 8

# Character-file carousels -> out/social/bio-<slug>/slide-1..N.png + caption.txt
node scripts/social/generate-bios.mjs --count 8
node scripts/social/generate-bios.mjs --character "Batman"

# Ranking carousels -> out/social/ranking-<slug>/slide-1..N.png + caption.txt
node scripts/social/generate-rankings.mjs --alignment bad          # most famous villains
node scripts/social/generate-rankings.mjs --by strength            # strongest characters
node scripts/social/generate-rankings.mjs --by intelligence --publisher "Marvel Comics"

# force a specific matchup
node scripts/social/generate-carousels.mjs --matchup "Goku,Superman"
```

The carousel is 4 slides: cover / hook, tale of the tape, verdict + winner,
fan vote + CTA. Upload them in order.

## Posting

**Reels** are **silent by design** — add a **trending sound** in-app. The cuts
are spaced to snap to a beat, and in-app audio gets far more reach than baked-in
music. Use a **Creator** account, not Business: Business accounts can only use
the commercial music library, which excludes trending sounds.

**Carousels** drive swipes and saves; keep the payoff (winner) off slide 1 so
people swipe to the end.

`out/` is git-ignored; nothing generated is committed.

## Files

- `lib.mjs` — shared: env, Supabase (public key), selection, data hydrate,
  fonts/portraits, and the render helpers (`renderPng`, `renderVideo`).
- `generate-reels.mjs` / `generate-carousels.mjs` — the two templates + CLI.
