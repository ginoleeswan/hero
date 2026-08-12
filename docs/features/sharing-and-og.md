# Sharing and the crawler surface

> How a Mythique moment leaves the app: the in-app share posters, the emoji
> grid for the daily game, and the Vercel `api/` layer that makes pasted links
> unfurl for social crawlers and read cleanly for AI/search bots. Read this
> before touching anything in `api/`, `vercel.json`, or a share button — the
> crawler half has already broken silently in production once.

## Mental model

Sharing is two entirely separate systems that happen to produce similar-looking
cards:

1. **In-app shares** are client-side snapshots. A hidden RN view is rendered
   off-screen, captured to a PNG with react-native-view-shot, and handed to the
   OS/browser share sheet. They run inside the app bundle, are covered by the
   normal build, and fail loudly.
2. **The crawler surface** is server-side, in `api/` at the repo root — Vercel
   serverless functions that only crawlers ever see, routed there by user-agent
   rewrites in `vercel.json`. It is **not** part of the Expo build, has its own
   module system, and fails invisibly (a human browsing mythique.app never
   exercises it).

When a link unfurl looks wrong, start at system 2; when the "Share image"
button misbehaves, start at system 1. They share brand tokens
(`src/constants/colors.ts`, `brandMark.ts`, `cardTexture.ts`) but no runtime.

## In-app share images

| Artefact | Hook / lib | Card component |
| --- | --- | --- |
| VS poster (matchup) | `src/hooks/useMatchupShareImage.tsx` → `src/lib/shareMatchupImage[.web].ts` | `src/components/compare/ShareableMatchupCard.tsx` |
| "My Universe" poster (profile) | `src/hooks/useUniverseShareImage.tsx` → `src/lib/shareUniverseImage[.web].ts` | `src/components/profile/ShareableUniverseCard.tsx` |
| Daily-game emoji grid | `buildShareGrid` in `src/lib/game/shareGrid.ts`, wired by `src/hooks/useDailyHero.ts` | (text only — Wordle-style spoiler-free row) |

Two decisions worth keeping: the VS poster's split uses the **stat scorecard**
(`winsA`/`winsB`), not the live crowd tally — a freshly shared matchup has ~1
vote and "100% · 1 fan voted" makes a poor poster. And on web the poster is
**drawn from data**, not DOM-snapshotted (the snapshot path renders blank);
native snapshots the rendered card via the ref. Share copy AND share links are
pure string logic in `src/lib/share.ts`, shared with the bot-facing meta.

### Every share carries a link

This is a rule now because it was not one, and almost nothing obeyed it. The
character page — the flagship, and the most-shared surface in the app — sent
`Check out <name> on Hero`: no URL, so the character card `api/og` already
rendered had nothing to unfurl from, and "Hero" is the repo slug rather than the
product. The arena's text fallback and the daily game's emoji grid were linkless
too; the grid is a Wordle format whose entire growth loop IS the third line.

So: **`shareLink.*` for the URL, a `*ShareLine` for the copy, `nativeShare()` to
compose the payload.** That last one matters — iOS takes `message` and `url` as
two activity items (Messages renders the sentence and unfurls the link), while
Android has no `url` field at all and silently drops it, which is half of why
these shares were empty. `ShareHeaderButton` wraps the whole pattern for the
house/event/title headers so there is one call site, not three.

## The crawler surface (`api/`)

`vercel.json` rewrites by user-agent: **social link-preview crawlers**
(Facebook, Twitter, WhatsApp, Slack, Discord, Telegram…) on `/character/:id`,
`/social-web/:id`, `/house/:slug`, `/event/:slug`, `/title/:id` and
`/compare/:a/:b` go to `api/share-meta.ts`; **AI and
search bots** (Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot…) on
character/title/team/compare/category/universe/franchise routes go to
`api/bot-page.ts`. Everyone else falls through to the SPA shell.

| Function | Runtime | Does |
| --- | --- | --- |
| `api/share-meta.ts` | Node | Page-specific OG tags (character / universe / vs / debate / house / event / title, with live tally via `get_matchup_tally`); humans get a meta-refresh to the real page |
| `api/bot-page.ts` | Node | Server-rendered HTML for AI/search bots (`api/_lib/botPage.ts`) |
| `api/og/index.tsx` | **Edge** | 1200×630 `@vercel/og` card renderer: character, VS, universe poster, daily-debate, house, event, title, brand card; any failure redirects to static `public/og.png` |
| `api/battle.ts` | Node | `/battle/:a/:b` — instant-paint ad-landing vote page (`api/_lib/battlePage.ts`): portraits, live tally via anon `get_matchup_tally_v2`, vote buttons, CTA into `/compare` with UTM tags passed through; any failure 302s to the compare page |
| `api/health.ts` | Node | Zero-import liveness probe (asserted by `yarn smoke`) — see its header comment for why it exists |

The OG renderer must stay on the Edge runtime: standalone `@vercel/og`
functions need Edge for the satori/resvg WASM to bundle, and fonts load via URL
imports because Edge has no `node:fs`. That is also why it lives in its own
directory: `api/og/tsconfig.json` sets the ES-module options `import.meta`
needs, while `api/tsconfig.json` stays CommonJS so the emitted Node functions
load under Node's default module system. Don't merge the two configs — one
directory's requirement crashing the other's functions is exactly the incident
below. The site-wide brand card is snapshotted to `public/og.png` by
`scripts/fetch-og-site.mjs`.

## The trap: `api/` has two runtimes, and nothing watches it

In July 2026 **every Node function in `api/` was crashing at load in
production** — `FUNCTION_INVOCATION_FAILED` on all routes — while the app, the
build, and every test stayed green for thirteen days. Root cause:
`api/tsconfig.json` emitted ESM (`module: ESNext`, needed only by the OG
renderer for `import.meta`), but without a `"type": "module"` beside it the
output landed in a CommonJS package and died at import time — before any
handler ran. Two attempted fixes (a `"type": "module"` package.json inside
`api/`, then `vercel.json` `includeFiles` to ship it) never took effect because
those builds errored outright. The landed fix (`1d4571f`) splits the runtimes by
directory: the OG renderer moved to `api/og/index.tsx` with its own ESM
tsconfig, and `api/tsconfig.json` reverted to CommonJS for its Node
neighbours.

The standing lesson: **the crawler surface is outside the app build and has no
user-facing failure signal.** After touching anything in `api/` or
`vercel.json`, verify with a real request post-deploy, e.g.
`curl -A Twitterbot https://mythique.app/compare/<a>/<b>` and
`curl https://mythique.app/api/health`.

## Attribution and analytics

First-touch UTM capture is `src/lib/attribution.ts` (web only): UTMs or the
cross-origin referrer are pinned per browser session, written once to
`session_attribution`, and stamped onto every analytics event. The link-tagging
convention lives in `docs/marketing/utm-attribution.md` — read that, don't
duplicate it here.

`src/lib/analytics.ts` exposes `trackEvent` — web-only Vercel custom events
(native has no beacon; it hard-gates on platform). The event names: `sign_up`,
`log_in`, `matchup_vote`, `favourite_add`, `search`, `sponsor_impression`,
`sponsor_click`. Keep them snake_case and stable; they surface as rows in the
Vercel dashboard.

## The social content factory

`scripts/social/` is a separate outbound pipeline: generators for reels,
matchup carousels, character-file carousels, rankings, brand/organic packs and
the daily-debate asset (which fetches `api/og?type=debate`), an ad-safety gate
(`safety.mjs` / `audit-safety.mjs`), a local studio GUI (`studio.mjs`), a
publish pipeline (`publish-posts.mjs` + the `social_posts` tables) and IG /
TikTok sync (`ig-sync`, `tiktok-sync` edge functions). It reads only the public
Supabase key. Start at `scripts/social/README.md`; visual rules are in
`docs/brand/design-language.md`.

## History

- `docs/superpowers/specs/2026-06-18-matchup-og-unfurl-design.md` — the unfurl
  design. The feature **is shipped** (share-meta, og.tsx, the vercel.json
  rewrites); the spec's status header now carries that correction.
- `docs/superpowers/specs/2026-07-06-social-ad-safety-split-design.md` and
  `docs/superpowers/specs/2026-07-08-ad-safe-content-factory-design.md` — the
  safety gate around the content factory.
- `docs/superpowers/specs/2026-07-07-social-studio-design.md` — the studio GUI.
- `docs/superpowers/specs/2026-07-27-event-attribution-design.md` — event-level
  attribution follow-on.

## The card inventory, and how a card gets reached

A card that nothing links to is not a feature. `debateCard` — the richest one in
the renderer, with both portraits, the live split bar and the crowned take —
shipped and then sat unreachable for its whole life: no route, no rewrite and no
share in the product ever produced a `type=debate` URL, so the only thing that
ever rendered it was the admin health preview. Three page types (`/house`,
`/event`, `/title`) had no card at all and unfurled as the generic brand card;
`api/bot-page.ts` serves those routes but emits no `og:` tags, so it was never
going to cover them.

| Card | URL | Reached from |
| --- | --- | --- |
| character | `?hero=` | character page share |
| vs | `?a=&b=` | arena share (text fallback), any `/compare` link |
| debate | `?type=debate&a=&b=` | "Today's Battle" share → `/compare/a/b?debate=1` |
| universe | `?type=universe&hero=` | `ShareUniverseButton` |
| house | `?type=house&slug=` | house page header share |
| event | `?type=event&slug=` | event dossier header share |
| title | `?type=title&title=` | title page header share |
| brand | no params | every fallback, and `public/og.png` |

The debate rewrite is keyed on the `?debate=1` query and **must stay ordered
before** the plain vs rule in `vercel.json` — first match wins, so reversing them
silently downgrades every daily share to the plain head-to-head card.

Two of the new cards carry the thing that makes their page worth reading rather
than a generic layout: the house card draws real member faces (the members ARE
the house; a crest is decoration) tinted by the house's own `sigil_tint`, and the
event card draws the readership curve as an inline SVG polyline, because "no
calendar told us this was on, the readership did" is the page's whole argument
and the shape of the spike is the evidence for it.
