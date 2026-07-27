# Command Center IA Consolidation — Design

**Date:** 2026-07-08
**Status:** SHIPPED (2026-07-27 correction — this line originally said
"pre-implementation" and went stale). The six-lane shell in the code is this
spec realised; only the deferred UX-polish follow-up remains open. As-shipped
reference: `docs/features/admin-command-center.md`.
**Scope note:** This spec covers the IA consolidation, orchestrator refactor, and
inline bug/jank fixes. A separate deep design/UX polish pass follows afterwards
(user-requested follow-up; out of scope here).

## Problem

The command center (`app/admin/health.web.tsx` + `src/components/admin/health/`,
~16.4k lines) has grown to **11 top-level tabs** that actually serve 5 jobs. Pain
confirmed by the user: mobile layout issues, slow/janky loads, confusing controls.

Structural issues found in the audit:

- `health.web.tsx` is a 604-line god-orchestrator: 20+ pieces of `useState` and
  queries, alert derivation, run-log streaming, backlog-ETA math, all inline;
  domain switching is a `{domain === 'x' && …}` ladder.
- Two moderation inboxes live in different places: **Reports** is a top-level tab
  while **Review** hides under Catalog › Review (CommunityDomain deep-links across
  them).
- **Spend** is a 105-line tab — a stat, not a destination. The Build tab's
  VitalsBar already shows spend.
- Mobile nav: 4 fixed tabs + a "More" sheet holding **7 domains** — over half the
  tool is behind an overflow menu.
- Tab knowledge is scattered: `DOMAINS` in `format.ts`, `MOBILE_TABS` hardcoded in
  `CommandShell.tsx`, `fill={domain === …}` hardcoded in the page.
- Sources / Publish / Inbox-class lanes have no skeletons (janky loads).

## New IA — 6 lanes

| Lane | Merges | Sub-tabs | Badge |
| --- | --- | --- | --- |
| **Overview** | (unchanged concept) | — | — |
| **Catalog** | + Sources | Coverage · Distributions · Hygiene · Sources | pending backfill |
| **Build** | + Spend | Add · Enrich · Generate · Activity · Runs · Spend | — |
| **Inbox** | Reports + Review | Reports · Review | open reports + pending contributions |
| **Audience** | Traffic + Community + Errors | Traffic · Community · Errors | — |
| **Publish** | Social + Campaigns | Social · Campaigns | — |

- Mobile bottom bar shows **all 6 lanes**; the "More" sheet is deleted.
- Desktop rail: 6 items instead of 11.
- Overview gains a "needs you" inbox count deep-linking to Inbox.
- Catalog › Review sub-tab is removed (its content moves to Inbox › Review).

## Execution approach (chosen: lane-by-lane)

Touch each lane once, in blast-radius order; the command center works at every
commit. Rejected alternatives: big-bang restructure (broken midpoint, risky at
~16k lines) and registry-only (leaves the god-orchestrator and split inboxes).

Order:

1. **Domain registry becomes authoritative** (`format.ts`): each lane declares
   `key, label, icon, badge, fill, subTabs`. `CommandShell` and the page read the
   registry — `MOBILE_TABS` and the `fill` ladder are deleted.
2. **Merged lanes**, one commit each: Inbox, Audience, Publish. Each is a thin
   lane component owning its own sub-tab state, composing the existing domain
   panels unchanged (re-homed, not rewritten) via the existing `SubTabs`.
3. **Fold-ins:** Sources → Catalog sub-tab; Spend → Build sub-tab. Delete the
   standalone tabs and `PlaceholderDomain` if orphaned.
4. **Slim the orchestrator:** `health.web.tsx` → ~150 lines (auth gate + shell +
   lane switch). Extract into hooks: alert derivation, run-log streaming
   (`useRunLogStream`), backlog ETA (`useBacklogEta`). Per-lane state (`catSub`,
   `metric`, `page`, `pubFilter`, `trafficDays`, `historyLimit`,
   `ambiguousLimit`) moves into the lane that owns it. Cross-lane deep-links
   (pickPublisher, goToBackfill, open-review) become a small navigation callback
   passed to lanes, not lifted state.

## Inline bug/jank audit (per lane, as it's touched)

- Mobile spill: the Panel `flex`-vs-content sizing class of bug
  (narrow → `flexBasis: 'auto'`; gate Bento `fill` on `!narrow`).
- Skeletons for lanes that lack them (Sources, Publish, Inbox) using the existing
  `skeletons/kit`.
- Query-key invalidation still correct after re-homing panels.
- Deep-links updated: alert texts pointing at "Catalog › Hygiene" / "the Build
  tab", CommunityDomain's open-review, CommandHome jump targets.

## Constraints / invariants

- `useCatalogQueries`' `enabled: domain === …` gating must be remapped to the new
  lane keys so merged lanes still lazy-load their data (e.g. Sources data loads
  only when Catalog › Sources is active).
- Vitals ribbon remains Build-only.
- The universal Stop (BuildBoard kill switch) stays at page level.
- Web-only screen; `health.tsx` (native stub) untouched.
- No visual redesign in this pass — spacing/typography/layout polish is the
  follow-up UX pass.

## Testing

- Existing tests must stay green (`yarn test:ci`); typecheck clean.
- New pure logic extracted into hooks (ETA math, alert derivation) gets unit
  tests — that's the code most at risk in the move.
- Manual verification on device by the user (desktop + iPhone) per usual flow.
