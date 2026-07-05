# Social reel pipeline

Generates fast-cut 9:16 "who would win" videos (TikTok / Reels / Shorts) from
real matchup data, styled like the app's matchup screen. One command produces a
batch of ready-to-post `.mp4`s plus captions.

## What it does

For each matchup it pulls **real data** using only the public (publishable)
Supabase key — the same read path the app uses, no secret key:

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
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY` in `.env.local`

## Usage

```sh
# preview the matchups it would pick (no rendering)
node scripts/social/generate-reels.mjs --count 8 --dry-run

# generate 8 videos + captions into out/social/<slug>/
node scripts/social/generate-reels.mjs --count 8

# force a specific matchup
node scripts/social/generate-reels.mjs --matchup "Goku,Superman"
```

Each matchup lands in `out/social/<a>-vs-<b>/` as `video.mp4` + `caption.txt`.

## Posting

The videos are **silent by design**. Upload to TikTok / Reels and add a
**trending sound** in-app — the cuts are spaced to snap to a beat, and in-app
audio gets far more reach than baked-in music. (Use a **Creator** account, not
Business: Business accounts can only use the commercial music library, which
excludes trending sounds.)

`out/` is git-ignored; nothing generated is committed.
