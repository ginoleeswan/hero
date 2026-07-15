# Hardening batch — execution plan (2026-07-15)

Four specs, four PRs, executed **in this order**. Each spec is self-contained
with exact file:line anchors (as of commit `d4b653e4`), decided trade-offs, and
acceptance criteria — **do not relitigate scope decisions**; they were made
deliberately with the owner.

| # | Spec | Size | Blocking owner action |
| --- | --- | --- | --- |
| 1 | [`2026-07-15-auth-returnto-design.md`](2026-07-15-auth-returnto-design.md) | S | none |
| 2 | [`2026-07-15-sentry-observability-design.md`](2026-07-15-sentry-observability-design.md) | M | Sentry DSN + auth token |
| 3 | [`2026-07-15-comicvine-collision-gate-design.md`](2026-07-15-comicvine-collision-gate-design.md) | M-L | none |
| 4 | [`2026-07-15-web-push-daily-design.md`](2026-07-15-web-push-daily-design.md) | L | VAPID keys + secrets |

**Why this order:** returnTo is small and self-contained (warm-up, instant user
value). Sentry next so the two bigger features ship with observability. The
ComicVine gate before push because it has no owner dependency. Push last — it
has the most moving parts (SW + migration + cron + edge function + UI) and its
failures should land in an already-working Sentry.

Each PR: branch off `main` → PR → owner merges. Never commit to `main`.

## Hard rules (violating any of these is a defect)

1. **yarn only** — never npm/bun. Expo-managed packages via `yarn expo install`.
2. **Migrations** via `mcp__supabase__apply_migration` with a matching file in
   `supabase/migrations/YYYYMMDDHHMMSS_description.sql`; regenerate
   `src/types/database.generated.ts` (`mcp__supabase__generate_typescript_types`)
   after every migration. Never edit the generated file by hand.
3. **Edge functions** deployed via `mcp__supabase__deploy_edge_function`.
4. Screens never import `supabase` directly — all DB access through
   `src/lib/db/` (or `src/lib/` for non-table concerns like push).
5. TypeScript strict habits: no `any`, `unknown` for caught errors; functional
   components; `StyleSheet.create`; fonts `Flame-Bold`/`FlameSans-Regular`/
   `Nunito_*`; clamped Flame text needs `lineHeight ≥ 1.22× fontSize`.
6. Platform-split screens (`foo.tsx` + `foo.web.tsx`): shared logic lives in a
   platform-neutral hook/lib — never duplicate effects across the pair.
7. Before finishing any PR: `npx tsc --noEmit` clean AND `yarn test:ci` green
   (baseline: 686 passing). New logic gets unit tests per each spec's Tests
   section.
8. Any new SQL touching user-facing reads: benchmark as the **anon role**
   (`set local role anon`), not postgres — see the RLS planner-shackle lesson.
9. Commit trailer: `Co-Authored-By:` the executing model, per repo convention.
10. Line-number anchors in the specs may drift — re-locate by grepping the
    quoted code, don't trust offsets blindly.

## Owner setup (can happen in parallel, blocks only the marked step)

- **Sentry (blocks PR 2 going live, not the code):** create org/project →
  `EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` into Vercel env and EAS
  secrets. The code must no-op gracefully without them, so the PR can merge
  first.
- **VAPID (blocks PR 4's send path):** `npx web-push generate-vapid-keys` →
  public key to Vercel env as `EXPO_PUBLIC_VAPID_PUBLIC_KEY`; both keys to
  Supabase function secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).

## Verification gate per PR (in addition to each spec's acceptance criteria)

```
npx tsc --noEmit
yarn test:ci
yarn expo export -p web        # PRs 2 and 4 only (metro/SW changes) — must succeed
```

For PR 3 additionally: run the matcher unit tests, and verify against prod (via
MCP `execute_sql`) that the smell-test predicate count ≈ 80 BEFORE running the
audit UPDATE.

## Context you'd otherwise have to rediscover

- The AuthGate (`app/_layout.tsx:57-73`) is a second redirect that races any
  post-login navigation — spec 1's design routes returnTo THROUGH the gate.
  Both root layouts exist (`_layout.tsx` native, `_layout.web.tsx` web); check
  both for gate logic.
- The repo already has self-hosted error reporting
  (`src/lib/db/clientErrors.ts` + web ErrorBoundary in `_layout.web.tsx:29-49`)
  — Sentry goes BESIDE it, never replaces it. Native has no boundary at all.
- `metro.config.js` has a custom SVG transformer + web-stub resolver that must
  survive the `getSentryExpoConfig` wrap.
- `daily_debate` (UTC-keyed, cron-guaranteed) is the ONLY server-authoritative
  daily surface; the team battle is client-computed — that's why push v1 is
  debate-only.
- The ComicVine matcher exists in TWO byte-identical copies (`enrich-comicvine-batch`
  and `get-comicvine-hero`) — spec 3 extracts it to
  `supabase/functions/_shared/`; never fix one copy alone.
- The cron + `net.http_post` + hardcoded anon-bearer pattern:
  `supabase/migrations/20260712100000_schedule_pull_social_stats.sql` is the
  canonical template.
- Admin review-queue UI precedent: `NeedsYou.tsx` (candidates + inline accept +
  manual-ID escape hatch), `ReviewDomain.tsx` (approve/reject + admin RPC),
  `DuplicatesPanel.tsx` (same-name disambiguation).

## Issue hygiene

- PR 3 closes #65 (`Closes #65` in the PR body).
- After all four merge: update `docs/ROADMAP.md` (add a "Hardening" shipped
  bullet; move #65 out of Data quality).
