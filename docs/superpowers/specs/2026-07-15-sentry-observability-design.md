# Production error reporting — Sentry + native ErrorBoundary

**Status:** spec, ready to execute
**Priority:** 1 of 4 in the 2026-07-15 hardening batch (see `2026-07-15-hardening-execution-plan.md`)
**Size:** medium (1 PR + owner setup)

## What exists today (do not duplicate it)

The repo already has a **self-hosted** error feed — keep it, Sentry slots
*alongside*:

- `src/lib/db/clientErrors.ts` — `recordClientError(kind, message, opts)`
  inserts into the Supabase `client_errors` table (deduped via a `seen` Set,
  throttled `MAX_PER_LOAD = 25`); `installGlobalErrorCapture()` attaches
  `window` `error` + `unhandledrejection` listeners (**web only** — no-op on
  native). Feeds the command-center Errors domain via
  `admin_recent_client_errors` RPC.
- `app/_layout.web.tsx:29-49` — a real `ErrorBoundary` export (expo-router
  route boundary): on-brand crash screen (`#0b1820` bg, `Flame-Regular` title
  "Something went wrong", `Nunito_400Regular` body, orange "Try again" →
  `retry`), logs via `recordClientError('boundary', …)`. Styles at `:51-85`.
- `installGlobalErrorCapture()` is called from `_layout.web.tsx:201` (cleanup
  `:205`).

**The actual gaps:**
1. **Native has nothing** — no ErrorBoundary export in `app/_layout.tsx`, no
   global JS error handler (`ErrorUtils` never touched). A native render crash
   is a silent white screen.
2. No aggregation/alerting/release-tagging — `client_errors` is a raw feed you
   must remember to read; minified web stacks are unreadable (no source maps).

## Design

### Package + config

- `yarn expo install @sentry/react-native` (the deprecated `sentry-expo` is NOT
  used; note `package.json` `transformIgnorePatterns` already whitelists
  `sentry-expo` — leftover template naming, harmless, leave it, but add
  `@sentry/react-native` to that allowlist).
- `app.config.ts` plugins array (`:52-105`): add
  `['@sentry/react-native/expo', { organization: '<org>', project: 'mythique' }]`.
- `metro.config.js`: wrap with `getSentryExpoConfig` from
  `@sentry/react-native/metro` **carefully** — this file has a custom SVG
  transformer (`react-native-svg-transformer/expo`), custom
  `sourceExts`/`assetExts` moves, and a custom `resolver.resolveRequest`
  (`:23-28`) aliasing native-only modules to `src/web-stubs/*` on web.
  `getSentryExpoConfig(__dirname)` replaces `getDefaultConfig`; re-apply every
  customization on top of it. **Verify after: `yarn expo export -p web`
  succeeds and `src/web-stubs` aliasing still works (spot-check the export has
  no native module in the bundle).**

### Init: new `src/lib/sentry.ts`

```ts
import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// No-op without a DSN (local dev, tests, forks) — same fail-soft posture as
// the sitemap generator. Errors-only: tracing/replay off to protect the
// hard-won landing bundle size (three.js split saved 911 KB; don't give it
// back to an APM bundle).
export function initSentry(): void {
  if (!dsn || process.env.NODE_ENV === 'test') return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    enableAutoPerformanceTracing: false,
    sendDefaultPii: false,
  });
}

export { Sentry };
```

Call `initSentry()` at module scope (top, before component definitions) in
**both** `app/_layout.tsx` and `app/_layout.web.tsx`.

Env: add `EXPO_PUBLIC_SENTRY_DSN=` to `.env.example`; test value in
`jest.setup.env.js` is NOT needed (init guards on NODE_ENV).

### Native ErrorBoundary (the real gap): `app/_layout.tsx`

Add an `export function ErrorBoundary({ error, retry }: ErrorBoundaryProps)`
mirroring the web one at `_layout.web.tsx:29-49` — same visual (port the `eb`
styles), same `recordClientError('boundary', …)` call, plus
`Sentry.captureException(error)`. Note `recordClientError` is currently
web-gated internally? — check: the *install* function is web-only but
`recordClientError` itself inserts via supabase-js and works on native; if it
has a Platform guard, remove it for the insert path.

### Wire Sentry beside the existing hooks (never instead of)

- `_layout.web.tsx` ErrorBoundary: add `Sentry.captureException(error)` next to
  the existing `recordClientError` call.
- `src/lib/db/clientErrors.ts`: in `recordClientError`, after the dedupe/
  throttle checks pass, also `Sentry.captureMessage`/`captureException` — this
  gives Sentry the same deduped stream the self-hosted feed gets, including the
  web global handlers, with zero new listeners. (Import from `src/lib/sentry`
  so the no-DSN guard applies.)
- Native global fatal-error coverage comes free from `Sentry.init` (it installs
  the `ErrorUtils` handler). Do NOT add a hand-rolled native handler.
- Optionally tag the route: in `AnalyticsProvider` (`src/components/Analytics.tsx`
  + `.web.tsx`), `Sentry.setTag('route', route)` inside the existing page-view
  effect. Cheap, high-value for triage.

### Source maps (web) — fail-soft, same posture as the sitemap

`vercel.json` buildCommand becomes:

```
yarn expo export -p web && node scripts/generate-sitemap.mjs && node scripts/upload-sourcemaps.mjs
```

New `scripts/upload-sourcemaps.mjs`: if `SENTRY_AUTH_TOKEN` is absent, log and
`exit 0` (never break a deploy). Otherwise run `npx sentry-cli sourcemaps
inject dist && npx sentry-cli sourcemaps upload dist --org <org> --project
mythique --release <version>` using `version` from `app.config.ts` (`1.0.0`) +
the Vercel commit SHA (`process.env.VERCEL_GIT_COMMIT_SHA`). `sentry-cli` as a
devDependency.

Native source maps (EAS builds) come via the config plugin automatically when
`SENTRY_AUTH_TOKEN` is present at build time — no extra work; note it in the
owner checklist.

### Jest

`__mocks__/@sentry/react-native.js` following the repo's plain-CommonJS mock
style (see `__mocks__/svgMock.js`): no-op `init`, `captureException`,
`captureMessage`, `setTag`, `wrap: (x) => x`. Wire via `moduleNameMapper` in
`package.json` jest block (`:127-132`).

## Owner actions (blocking, ~10 min)

1. Create a Sentry org/project (platform: React Native) → copy the **DSN**.
2. Vercel env: `EXPO_PUBLIC_SENTRY_DSN` (all envs), `SENTRY_AUTH_TOKEN`
   (build). EAS secrets: same two, for native builds.
3. `.env.local`: add the DSN (optional for local dev).

## Non-goals

- Performance tracing, session replay, profiling (all off — bundle discipline).
- Replacing `client_errors` / the admin Errors domain (it stays the in-app feed).
- Alert-rule configuration inside Sentry (owner can do it in the UI later).

## Tests / verification

- `yarn test:ci` green with the mock; `npx tsc --noEmit` clean.
- `yarn expo export -p web` succeeds; bundle diff sanity: main entry chunk
  growth < ~40 KB gzip (errors-only SDK). If it's way more, tracing got
  enabled — fix the init.
- Manual: with DSN set, throw from a dev screen → event in Sentry with the
  `route` tag; boundary screens still render on both platforms.

## Acceptance criteria

1. Native root exports an ErrorBoundary visually matching the web one; a thrown
   render error on native shows the branded screen (not a white screen).
2. With no DSN configured, the app behaves exactly as today (init no-ops, zero
   network calls to Sentry).
3. With DSN: web boundary errors, web global errors/rejections, and native
   fatal JS errors all arrive in Sentry; `client_errors` rows still written.
4. A deploy without `SENTRY_AUTH_TOKEN` still succeeds (fail-soft upload step).
