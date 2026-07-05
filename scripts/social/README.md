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
