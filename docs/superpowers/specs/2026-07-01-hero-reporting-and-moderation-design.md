# Hero-page reporting & image moderation — design

_Date: 2026-07-01_

## Problem

Users need a way to flag problems on a character page — wrong data, an
offensive/duplicate page, a bad gallery image, or (specifically) an AI portrait
that doesn't look like the character. Today a narrow "Report incorrect info"
flow exists (a `kind='report'` row in `contributions`, surfaced in the command
center's Review queue), but it: requires sign-in (kept), is framed only as data
inaccuracy, **cannot target an image or the AI portrait**, and sends **no
notification**. This work closes those gaps: broaden to "report for any reason,"
add image / AI-portrait reporting, give the command center a dedicated Reports
lane, and email the admin instantly on each new report.

## Requirements (decided)

- **Who can report:** signed-in users only (matches the existing flow; every
  report has a real `user_id` for accountability, dedupe, and rate-limiting).
  Signed-out users get a "sign in to report" prompt.
- **Reportable targets (v1):** character pages and their images only — the
  character page itself (any reason), the AI portrait (`heroes.portrait_url`),
  and any gallery image (`hero_images`). Other page types (universe/title/team)
  are out of scope.
- **Email:** instant, one email per new report, to the admin.
- **Data model:** a dedicated `reports` table (Approach B), separate from
  `contributions`. Rationale: `contributions` is built around _edits that apply
  a change on approve_; reports are a different lifecycle (open → resolved /
  dismissed), never mutate a field, and can reference images. A dedicated table
  mirrors the existing `client_errors` pattern (own-insert, RLS-locked, admin
  reads via `SECURITY DEFINER` RPC).

## Non-goals (v1)

- No anonymous reporting.
- Resolving a report does **not** auto-mutate the hero or delete/regenerate an
  image — remediation stays a separate, deliberate admin action using existing
  tooling.
- No report types for non-character pages.
- No daily digest email (instant only).

---

## Section 1 — Data model & reason taxonomy

New table `public.reports`:

| column            | type                          | notes |
| ----------------- | ----------------------------- | ----- |
| `id`              | `bigint generated always identity` PK | |
| `user_id`         | `uuid not null` → `auth.users(id)` on delete cascade | signed-in only |
| `hero_id`         | `text not null` → `heroes(id)` on delete cascade | reported character |
| `target_type`     | `text not null`               | `page` \| `image` \| `ai_portrait` |
| `image_url`       | `text`                        | reported image's URL; null for `page`; = `portrait_url` for `ai_portrait` |
| `reason`          | `text not null`               | category code (see below) |
| `detail`          | `text`                        | free-text note, capped ~1000 chars client-side |
| `status`          | `text not null default 'open'`| `open` \| `resolved` \| `dismissed` |
| `resolved_by`     | `uuid` → `auth.users(id)`     | admin who closed it |
| `resolved_at`     | `timestamptz`                 | |
| `resolution_note` | `text`                        | |
| `created_at`      | `timestamptz not null default now()` | |

Indexes: `(status, created_at)`, `(hero_id)`.
Check constraints on `target_type`, `status`, and `reason` (union of the two
reason sets below).

**Reason codes** (the UI shows only the set that fits the target):

- **Page** (`target_type = page`): `inaccurate` · `offensive` · `duplicate` ·
  `spam` · `other`
- **Image / AI portrait** (`target_type = image` or `ai_portrait`):
  `wrong_subject` (isn't this character) · `ai_inaccurate` (AI portrait looks
  wrong) · `offensive` · `low_quality` · `other`

The "AI portrait looks wrong" case is reached from the **page** entry point (see
Section 3) but is stored as `target_type = ai_portrait` + `reason = ai_inaccurate`
with `image_url = portrait_url`.

**RLS & security:**

- Enable RLS. `authenticated` may `insert` their own row (`user_id = auth.uid()`)
  and `select` their own rows. No public/anon read.
- All admin reads/writes go through `SECURITY DEFINER` RPCs gated on
  `user_profiles.is_admin`, matching `admin_review_queue`.
- `submit_report` enforces the abuse boundary: validates `target_type`/`reason`
  against allow-lists, verifies the hero exists, blocks a duplicate **open**
  report on the same `(hero_id, target_type, image_url)` by the same user, and
  caps open reports per user (e.g. 30).

---

## Section 2 — RPCs & app data layer

Three `SECURITY DEFINER` RPCs, same grant/revoke pattern as the contributions
RPCs (revoked from `anon`/`public`; granted to `authenticated` + `service_role`):

- **`submit_report(p_hero_id text, p_target_type text, p_image_url text,
  p_reason text, p_detail text) returns json`** — auth required; validates
  everything (see Section 1); inserts `status='open'`; returns `{ id }`. All
  validation lives here, not the client.
- **`admin_reports_queue(p_status text default 'open', p_reason text default
  null, p_limit int, p_offset int) returns json`** — `is_admin`-gated; returns
  reports joined to `heroes` (name, current `portrait_url`) + submitter
  `display_name` from `user_profiles`, newest-first, optionally filtered by
  reason. Returns `[]` for non-admins (silent lock, matching existing RPCs).
- **`admin_resolve_report(p_id bigint, p_decision text, p_note text) returns
  json`** — `is_admin`-gated; `decision ∈ {resolve, dismiss}`; sets `status`,
  `resolved_by`, `resolved_at`, `resolution_note`. No hero/image mutation.

**New `src/lib/db/reports.ts`** (screens never import `supabase` directly):

- `REPORT_REASONS`: single source of truth mapping `target_type → { code, label }[]`,
  shared by the report sheet and the command-center reason filter.
- `submitReport(opts) → { ok: true; id } | { ok: false; error }`
- `ReportRow` type + `fetchReportsQueue(status, reason?) → ReportRow[]`
- `resolveReport(id, decision, note?) → { ok; error? }`

After the migration, regenerate `src/types/database.generated.ts`
(`mcp__supabase__generate_typescript_types`) so `reports` types flow through.

---

## Section 3 — User-facing report UI

**Principle:** you report the thing you're looking at, and the UI only forces
disambiguation where ambiguity exists. There is exactly **one** AI portrait per
page but **many** gallery images — that asymmetry collapses reporting into two
clean entry points with **no new chrome on the immersive hero art**.

**New `src/components/report/ReportSheet.tsx`** — a cross-platform bottom sheet
styled like the existing `ContributeSheet` (beige sheet, grabber, sign-in gate,
warm success state). Props: `heroId`, `heroName`, `context: 'page' | 'image'`,
`imageUrl?`, `user`, `onClose`, `onRequestSignIn`.

- **Reason-first, not a form:** a tap-to-pick **list of reasons** (the set for
  the context, from `REPORT_REASONS`), an optional **"Add details"** field
  (required only for `other`), then a **"Submit report"** CTA.
- **Image / AI-portrait context** shows a **thumbnail** of what's being flagged.
- Signed-out → "Sign in to report"; success → "Thanks — we'll take a look."
- Always a queued signal; no admin direct-apply path.

**Entry point 1 — "Report a problem" (page-level).** Lives in the character
page's existing overflow / contribute menu (already the "something about this
page" surface). Opens `ReportSheet` in **page** context. Because there is only
one portrait, _"The main image looks wrong / AI portrait isn't accurate"_ is one
of the reasons here — no bespoke affordance on the parallax hero art. Choosing
that reason sets `target_type = ai_portrait`, `reason = ai_inaccurate`, and
`image_url = heroes.portrait_url`, and shows the portrait thumbnail to confirm.
Every other reason → `target_type = page`. The existing "Report incorrect info"
menu item is renamed to the neutral **"Report a problem."**

**Entry point 2 — "Report this image" (in the lightbox).** Gallery images already
open in the shared `src/components/ImageLightbox.tsx`. Add a small report icon
next to its existing close button via a new **optional `onReport?: (image) =>
void` prop** (one shared component; no web/native drift). It knows the current
image → opens `ReportSheet` in **image** context (`target_type = image`, current
URL). Per-image reporting stays where users go to _look_ at images, off the main
page.

**Both `app/character/[id].tsx` and `app/character/[id].web.tsx`** get the same
changes (these two files drift — both must be edited): the menu-item rename +
`ReportSheet` mount + the `onReport` wiring on the lightbox.

**Retiring the old path:** `ContributeSheet`'s `report` mode and
`submit_contribution`'s report handling stop being entry points (repointed to
`ReportSheet` / `reports`). Leave the `contributions.kind='report'`
check-constraint value and `ReviewDomain`'s report rendering intact so any
historical report rows still display — no destructive migration.

---

## Section 4 — Command-center surfacing & email pipeline

**New `ReportsDomain` (dedicated command-center lane).** Added to
`app/admin/health.web.tsx` (web-only, like the rest of the command center) via
`SubTabs` + `Panel`, calling `fetchReportsQueue`:

- **Rows** (open, newest-first): hero name (links to the hero page), a
  `target_type` badge (**Page** / **Image** / **AI portrait**), the reason chip,
  detail text, submitter + time.
- **Image reports show the reported thumbnail**; **AI-portrait reports show the
  reported portrait next to the hero's current `portrait_url`** for comparison.
- **Filters:** status (Open / Resolved / Dismissed) + reason.
- **Per-row actions:** **Resolve** (optional note) / **Dismiss** via
  `resolveReport`. No hero/image mutation on resolve.
- **Alert badge:** the open-report count is published into
  `CommandAlertsContext` so the existing notification bell / vitals show a badge
  when reports are waiting.

**Email pipeline (instant per report → Resend):**

- An **`AFTER INSERT` trigger on `reports`** calls `net.http_post` (pg_net,
  already installed) to a new **`report-alert` edge function**, passing the new
  report's id. Trigger-based so every insert path fires it; pg_net is
  async/fire-and-forget so a failed email can never roll back or block the
  insert.
- **`report-alert` edge function:** loads the report + hero name + submitter,
  formats an email (subject `New report: <reason> — <hero>`, body with
  reason/detail/target, a thumbnail link for image reports, and deep links to
  the hero page + command center), and sends via the **Resend API**.
- **Config/secrets (the one external dependency to provision):** a
  `RESEND_API_KEY` edge-function secret, a verified Resend sender, and a
  recipient address (env var, default `ginoswanepoel@gmail.com`). The DB/UI all
  works without it — email just no-ops until the key is set.

---

## Testing

Per `__tests__/` convention (unit-test pure logic + client wrappers with mocked
supabase; no screen/render tests):

- `REPORT_REASONS` mapping + the page-context → `target_type`/`reason` derivation
  (the "AI portrait" reason resolves to `ai_portrait` + `ai_inaccurate` +
  `portrait_url`).
- `src/lib/db/reports.ts` wrappers (`submitReport`, `fetchReportsQueue`,
  `resolveReport`) against a mocked supabase client.

RPC validation (auth, allow-lists, dedupe, open-cap) is exercised by the
migration itself.

## Files touched (summary)

- **New:** `supabase/migrations/<ts>_reports_backbone.sql` (table + RLS + 3
  RPCs + insert trigger), `supabase/functions/report-alert/index.ts`,
  `src/lib/db/reports.ts`, `src/components/report/ReportSheet.tsx`,
  `src/components/admin/health/domains/ReportsDomain.tsx`, tests under
  `__tests__/`.
- **Edited:** `app/character/[id].tsx` + `app/character/[id].web.tsx` (menu
  rename + `ReportSheet` + lightbox wiring), `src/components/ImageLightbox.tsx`
  (optional `onReport` prop), `app/admin/health.web.tsx` (register
  `ReportsDomain` + open-report alert), `src/types/database.generated.ts`
  (regenerated).
