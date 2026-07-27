# Matchup link-unfurl OG images — design (plan for "(b)")

**Date:** 2026-06-18
**Status (updated 2026-07-27): SHIPPED — this line originally said "not yet
scheduled" and went stale.** The crawler surface lives in `api/` (`og.tsx`,
`share-meta.ts`, `bot-page.ts`) wired via `vercel.json` UA rewrites; the
as-shipped reference is `docs/features/sharing-and-og.md`.
Sibling of the shipped in-app share image
(`ShareableMatchupCard` + `useMatchupShareImage`, captured client-side).

## Goal

When someone pastes a `mythique` compare link (`/compare/[a]/[b]`) into Discord,
X, iMessage, Reddit, WhatsApp, etc., the link should **unfurl into a VS poster**
in-feed — the share *is* the link, and it blooms into a card without the reader
clicking. This is the single highest-leverage growth mechanic for a web-community
launch, because it makes every shared link advertise itself.

This is distinct from the in-app "Share image" button already shipped (which hands
a PNG to the OS/browser share sheet). That covers deliberate sharing; this covers
*every* pasted link, including ones shared outside the app.

## Why it isn't already possible

The web app is `output: 'static'` (see `app.config.ts`) with a catch-all SPA
rewrite in `vercel.json` (`/(.*) → /index.html`). There is **no server runtime**,
so:

1. There's no endpoint that can render a per-matchup OG image.
2. Crawlers/unfurlers (Discordbot, Twitterbot, iMessage, Slackbot) fetch the
   rewritten `index.html` and see the app's **generic** `<meta og:*>` tags — every
   link previews identically (or not at all). They do **not** run JS, so the
   runtime head-patching the app does (per the `project_expo_single_ignores_html`
   memory) never executes for them.

So two things must change: a server able to render images + per-route meta tags.

## Approach (recommended): migrate web to `output: 'server'`

Expo Router supports `output: 'server'` with API routes (`+api.ts`) and
server-rendered routes, deployable to EAS Hosting or Vercel functions. Steps:

1. **Switch `output: 'static'` → `'server'`** in `app.config.ts`; adjust
   `vercel.json` so non-asset routes hit the server handler instead of the SPA
   rewrite. (Risk surface: every existing route must still render; the
   `+html.tsx`/runtime-head workarounds get revisited.)
2. **OG image API route** `app/compare/[hero]/[opponent]/og+api.ts` that renders a
   1200×630 PNG. Reuse the **exact visual design** of `ShareableMatchupCard` so the
   unfurled image matches the in-app one. Server image rendering options:
   - `@vercel/og` (satori) — JSX → SVG → PNG. Fonts (Flame, Nunito) must be loaded
     as buffers; the RN `StyleSheet` card must be re-expressed as satori-compatible
     JSX/flexbox (satori supports a subset of CSS). **Most likely path.**
   - A headless screenshot of the existing card route — heavier, slower, avoids the
     re-expression. Not recommended for per-request latency.
3. **Per-matchup meta tags.** The compare route (server-rendered) emits
   `<meta property="og:image" content=".../compare/a/b/og">`, `og:title`
   (`{A} vs {B}`), `og:description` (the verdict or stat line), plus the
   `twitter:card=summary_large_image` equivalents. Data comes from the same
   `compareStats` + cached verdict the page already uses.
4. **Data for the renderer.** The OG route needs names, portrait URLs, winner, and
   the stat split for `[a]` vs `[b]`. Fetch hero stats server-side (same source as
   `useCompareMatchup`) keyed by id. Cache aggressively (`Cache-Control:
   s-maxage`, and/or persist generated PNGs) — unfurlers hammer the endpoint and
   the inputs are deterministic per pair.

## Open questions for the brainstorming pass (when scheduled)

1. EAS Hosting vs Vercel functions for `output: 'server'` (current deploy is
   Vercel/`dist`). Which runtime hosts the OG route + SSR with least migration
   pain?
2. Does migrating off `static` regress anything relying on the SPA rewrite / the
   runtime head-patching (`+html.tsx` ignored under single/static)? Audit needed.
3. Image format: re-express the card as satori JSX (fast, some visual drift risk)
   vs screenshot the real component (pixel-perfect, slow). Lean satori.
4. Portrait CORS/fetch from the server (Cloudinary/Supabase) — satori needs image
   bytes; confirm both sources serve server-side fetches.
5. Caching/persistence of generated PNGs (regenerate when a verdict changes).
6. Should the same OG route also back the in-app share (replace client capture)
   for a single source of truth, or keep client capture for offline/native?

## Scope / sequencing

Bigger than a component — it changes how the **whole web app deploys**. Should be
its own brainstorming → spec → plan cycle, sequenced deliberately (ideally right
before the community launch, since it's a launch-day multiplier, but after the
core bounce-killers are done). Not a blocker for the in-app share, which already
ships.
