# Profiles & Contributions — Product + Technical Design

> Status: **historical proposal — largely shipped since.** Layers 1 (identity:
> taste profile, battle record, streaks, badges) and 2 (admin-vetted
> contributions) are live; Layer 3 (social) deliberately is not. The as-shipped
> reference is `docs/features/profile-and-gamification.md` — read that first;
> this doc remains the vision + decision record (notably the "review-queued,
> not live" and "no auto-approve" decisions).

> Original status: proposal / for review, no code yet. This doc defined the
> vision, data model, flows, and rollout for turning a Mythique account from a
> "favourites sync" into something people genuinely want — and for letting
> signed-in users improve the shared catalogue, wiki-style, the mature way.

## 1. The problem

Today an account is a **sync utility**: log in so your favourites and history
follow you, plus cosmetic profile fields (`display_name`, `avatar_url`,
`cover_url`) and account settings. The only action that touches shared state is
the new matchup vote. There is no reason to value the account beyond "my saved
list," and no way for a user to make the catalogue better.

Meanwhile the catalogue is large (3,000+ heroes) and **unevenly enriched** — and
we already measure exactly where the gaps are (`catalog_health_snapshots`:
portrait / summary / first_issue / stats coverage). The data model already
carries a `source` concept (`hero_facts.source`, `hero_relationships.source`,
`hero_people.source`, `heroes.stats_source`) and a `needs_review` flag on
`hero_narrative_facts`. The architecture is half-built for human contribution; we
just haven't exposed it.

## 2. Vision

A profile should answer three questions, each a layer we build in order:

1. **"This is mine."** — Identity. Collections, taste stats, your battle record,
   streaks, badges. Cheap, sticky, zero moderation risk.
2. **"My work matters here."** — Stewardship. You improve the shared catalogue;
   your accepted edits persist and are attributed to you. This is the real
   differentiator and the reason an account is worth *more* than a saved list.
3. **"I'm part of a community."** — Social (optional, later). Follow, compare
   picks, debate, leaderboards.

Guiding principle for stewardship: **review-queued, not live.** Contributions are
*suggestions* until an admin approves them. **Decision: every contribution is
admin-vetted — there is no auto-approve path, regardless of contributor
reputation.** We get the "I contributed" feeling without importing the open-wiki
vandalism problem, and the quality of the existing enriched data is never put at
risk by an unreviewed edit. Reputation (below) is cosmetic — it earns badges, not
a bypass of review.

---

## 3. Layer 1 — Identity (make the account feel earned)

No new content model; mostly derives from data we already store.

| Surface | Source | Notes |
| --- | --- | --- |
| **Collections** (rename/extend Favourites) | `user_favourites` | Optional named lists later; v1 = the existing favourites presented richer. |
| **Taste profile** ("Your Universe") | `user_favourites` + `user_view_history` | Top publishers / franchises / tags / alignment derived from what you save & view. A small RPC aggregates it. |
| **Battle record** | `matchup_votes` | "47 battles called · agreed with the crowd 68% of the time." We already have the votes. |
| **Streaks** | `user_view_history.viewed_at` | Daily-open / daily-vote streak. |
| **Badges** | derived | e.g. *Day One*, *Curator* (N favourites), *Oracle* (voted N days running), and later *Steward* (contributions accepted). |

Why first: it's high emotional ROI, no new moderation surface, and it gives
accounts a reason to exist *while* we build Layer 2.

---

## 4. Layer 2 — Contribution (the wiki, done maturely)

### 4.1 What a user can contribute

Scoped, structured, low-risk — never free-form HTML.

1. **Fill a missing field** ("Help complete this page"). The strongest hook.
   Because `catalog_health` tells us which fields are empty for a hero, we ask a
   *targeted* question on under-enriched pages: "No origin yet — know it?" This
   converts far better than a blank editor and directs effort where it's needed.
   Targets: the human-authored text fields on `heroes` — `origin`, `occupation`,
   `base`, `place_of_birth`, `first_appearance`, `full_name`, plus list fields
   (`powers`, `aliases`).
2. **Suggest a correction** to an existing field (with the old value shown).
3. **Propose a fact** → `hero_narrative_facts` (kind `did_you_know`, etc.) — the
   table already has `needs_review`, so this slots straight in.
4. **Add / remove a tag** → `hero_tags` (constrained to `hero_tag_vocab`).
5. **Flag bad data** — a lightweight report (no edit, just "this looks wrong").

Out of scope for v1: editing stats (curated/AI-sourced), images, relationships
graph (auto-built), anything destructive.

### 4.2 Contribution lifecycle (state machine)

```
draft? → pending → (approved | rejected | superseded)
                      │
                      └─ approved ⇒ applied to target table, attributed, scored
```

- **pending**: queued for review. Visible to the author as "under review."
- **approved**: an admin accepts → the change is applied
  to the target table with `source = 'community'` and the author credited.
- **rejected**: with an optional reason; counts against nothing fatal but affects
  trust weighting.
- **superseded**: the field changed elsewhere before review; contribution is
  stale and closed.

### 4.3 Schema (new)

Follows existing conventions: snake_case, RLS, `SECURITY DEFINER` RPCs with
pinned `search_path`, revoked from `anon`.

```sql
-- One row per proposed change. Polymorphic over a small, validated set of
-- targets so we don't need a table per field.
create table public.contributions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  hero_id       text not null references public.heroes(id) on delete cascade,
  kind          text not null,         -- 'field' | 'fact' | 'tag_add' | 'tag_remove' | 'report'
  target_field  text,                  -- for kind='field': 'origin','occupation',...
  old_value     text,                  -- snapshot at submit time (for 'field' / supersede check)
  new_value     text,                  -- proposed value (or fact content, or tag slug)
  note          text,                  -- optional submitter note / report reason
  status        text not null default 'pending',  -- pending|approved|rejected|superseded
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now(),
  constraint contributions_kind_chk
    check (kind in ('field','fact','tag_add','tag_remove','report')),
  constraint contributions_status_chk
    check (status in ('pending','approved','rejected','superseded'))
);
create index contributions_status_idx on public.contributions (status, created_at);
create index contributions_user_idx   on public.contributions (user_id);
create index contributions_hero_idx   on public.contributions (hero_id);

-- Reputation, kept as a denormalised counter row per user (cheap to read on the
-- profile; updated in the review RPC). Could be a view, but a table lets us
-- award discretionary badges too.
create table public.contributor_stats (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  approved   int not null default 0,
  rejected   int not null default 0,
  pending    int not null default 0,
  level      text not null default 'new',  -- cosmetic badge tier (new|curator|steward); NEVER gates review
  updated_at timestamptz not null default now()
);
```

Allow-list of editable fields lives in SQL (a `case`/lookup in the apply RPC),
**not** taken from the client — the client can only propose values for fields we
explicitly permit.

### 4.4 RPCs

- `submit_contribution(p_hero_id, p_kind, p_target_field, p_new_value, p_note)`
  — auth required; validates kind + field allow-list; snapshots `old_value`;
  rate-limited (see anti-abuse); inserts `pending`; bumps `contributor_stats.pending`.
- `get_my_contributions()` — the author's own list (also enforced by RLS).
- `get_review_queue(p_limit, p_offset)` — admin only; pending items + hero +
  submitter context.
- `review_contribution(p_id, p_decision, p_reason)` — admin only. On `approve`:
  apply to the target table inside the same transaction (set `source='community'`),
  mark `approved`, set `reviewed_by/at`, update the author's `contributor_stats`
  and recompute their cosmetic `level`. On `reject`: mark `rejected` + reason.

There is intentionally **no** client-callable apply path — every approval goes
through the admin-only `review_contribution`.

### 4.5 RLS

- `contributions`: a user may `select`/`insert` their own rows; no `update`/`delete`
  from clients (status transitions happen only via the admin RPC). Admins read
  all via the `SECURITY DEFINER` queue RPC.
- `contributor_stats`: public `select` (drives public profiles / leaderboards);
  writes only via RPC.

### 4.6 Attribution & provenance

- Applied contributions set `source = 'community'` on the target row/record so the
  catalogue can distinguish human vs pipeline data (consistent with existing
  `source` columns).
- Hero pages show a subtle **"Contributors"** affordance for community-sourced
  fields ("Origin added by @ava"). Builds pride and accountability.
- A per-hero contribution history is queryable from `contributions` (approved).

---

## 5. Layer 3 — Social (optional, later)

Follows, public profile pages (`/u/[handle]`), a contributor leaderboard
(`contributor_stats` ordered by `approved`), and surfacing others' matchup picks.
Deferred until Layers 1–2 prove engagement.

---

## 6. Anti-abuse & moderation

- **Auth-gated**: only signed-in users can submit (tabs are already auth-gated;
  the RPC also enforces `auth.uid()`).
- **Rate limits**: cap pending contributions per user per day (checked in
  `submit_contribution`), and one open contribution per (user, hero, field).
- **Everything queues**: there is no reputation-based bypass. A `steward` badge is
  recognition only; their submissions are reviewed like everyone's. This keeps the
  moderation surface a single, predictable admin queue.
- **Reversibility**: every applied change keeps `old_value`, so an approval can be
  rolled back. Approvals are admin-audited via `reviewed_by`.
- **Reports** (`kind='report'`) never mutate data — they only raise a flag in the
  queue for an admin to act on.

## 7. Editability UX (hero pages)

### 7.1 The core tension

Today, empty fields render as `null` — `InfoRow` and the `valid()` guard drop any
missing value, and whole sections are conditionally hidden. **Incompleteness is
invisible.** That's great for the reader (the page always looks finished and
premium) but fatal for contribution (you can't fill a gap you can't see).

We resolve this with a **mode split**, not by littering the page with controls:

- **Read mode (default):** unchanged. Pristine, gaps hidden, zero edit chrome. The
  reading experience we have today is never degraded.
- **Contribute mode (opt-in):** the page shifts into a "completion view" that
  *reveals* gaps as fillable slots and adds a quiet "suggest" affordance to filled
  fields. Entered deliberately; exited with **Done**.

This is the Wikipedia-app / Notion pattern: editing is a chosen activity, not
ambient noise. It keeps the design-led reader UI intact while giving contributors
a focused surface.

### 7.2 Entry points (how a user discovers they *can* help)

1. **Data-driven nudge (primary, high-intent).** On under-enriched heroes — which
   `catalog_health` lets us detect per hero — show a calm card under the identity
   block: *"Help complete V. Mortis's profile — 4 details missing."* Tapping it
   enters contribute mode with the missing fields scrolled into view. On a complete
   hero, this card is absent.
2. **Always-available, low-key entry.** A subtle *"Suggest an edit"* / *"Improve
   this page"* action in the overflow menu or page footer, for corrections even
   when nothing is "missing."
3. **No always-on inline pencils.** Edit affordances exist only inside contribute
   mode, so read mode stays clean.

### 7.3 Two interaction patterns, by intent

- **Fill a missing field (add).** In contribute mode, a hidden field appears as a
  **ghost slot** that matches the `InfoRow` layout: a dashed row reading
  *"Origin — + Add"* in muted/orange. Tapping opens a focused sheet for that one
  field. This is the emotional core — turning a blank into a contribution.
- **Suggest a correction (existing value).** Filled fields gain a small, quiet
  edit glyph in contribute mode (web: reveal on hover). The sheet shows the
  **current value** alongside the proposed one. Framing is *"Suggest a change,"*
  never *"Edit"* — the user must understand they are not overwriting curated data.

### 7.4 The submission sheet

One squircle bottom sheet, scoped to a **single** field or fact:

- **Header**: the field name + a one-line guideline (*"Where does this hero come
  from? A sentence or two."*). For corrections, the current value is shown above.
- **Input** matched to type: single-line, multiline (origin/summary), chip editor
  (powers/aliases), or a `hero_tag_vocab` picker (tags). Never free-form HTML.
- **Optional source/note** field (*"Where did you find this? (optional)"*) — feeds
  the contribution `note` and helps the reviewer.
- **Primary action**: **"Submit for review."** Copy is explicit that a moderator
  checks it before it goes live — this is *required* given the admin-vetted
  decision, so expectations are set up front.

### 7.5 Post-submission feedback (honoring admin-vetted)

Because nothing publishes instantly, the UI must make "pending" feel like success,
not failure:

- **Immediate**: optimistic toast — *"Thanks — sent for review."*
- **Author-only pending marker**: the field shows a subtle *"Your suggestion is
  under review"* pill **to that user only**. The live page does **not** change for
  anyone else. (This is the most important detail — without it, users think their
  edit "didn't work.")
- **Cross-user dedupe**: if any suggestion is already pending for a field, other
  contributors in contribute mode see a quiet *"a suggestion is pending review"*
  marker so they don't pile on duplicates.
- **On approval**: the value appears live with attribution (§4.6), the author's
  `contributor_stats` ticks up, and (later) a notification / badge progress.
- **On rejection**: surfaced gently in the user's profile Contributions list with
  the reason; never a punitive interruption.

### 7.6 Visual language (fits the design system)

- Ghost/add slots: dashed beige rows, `+ Add` in `COLORS.orange`, aligned to the
  existing `InfoRow` grid so they read as part of the section.
- Edit glyph + pending pill: muted navy/orange, low-emphasis.
- Sheets: the app's squircle bottom-sheet treatment; Flame headings, Nunito body.
- Contribute-mode chrome: a slim top bar — *"Contributing · Done"* — to signal the
  mode and offer a clean exit.

### 7.7 Other surfaces

- **Profile**: identity layer (collections, taste, battle record, badges) + a
  **Contributions** section (*"12 accepted · 3 pending"*) and the cosmetic level
  badge (Curator / Steward).
- **Admin console**: a new **Review** domain beside Campaigns / Catalog / Pipelines
  / Sources / Spend — the pending queue with side-by-side old/new values and
  approve/reject, reusing the existing `is_admin`-gated command-centre patterns.

## 8. Rollout phases

| Phase | Ships | Risk |
| --- | --- | --- |
| **0** | This doc, agreed scope | — |
| **1** | Identity layer (taste profile, battle record, streaks, badges) | none |
| **2a** | `contributions` + `contributor_stats` tables, `submit_contribution` + admin review RPCs, **Review** admin domain | low (admin-only review) |
| **2b** | Hero-page contribution mode + "Help complete this page" + suggest/flag UI; profile Contributions section + attribution | low |
| **3** | Social (follows, public profiles, leaderboard) | medium |

(No auto-approve phase — admin review is permanent by decision.)

## 9. Open questions (need product calls)

1. ~~Auto-approve threshold~~ — **decided: everything is admin-vetted, always.**
2. **Public profiles** — are profiles public (`/u/handle`) or private-by-default?
   Affects RLS on `user_profiles` and whether `display_name` must be unique.
3. **Anonymous read of contributor credit** — do logged-out web visitors see
   "added by @x"? (Privacy vs pride.)
4. **Scope of editable fields in v1** — start with just `origin` + `did_you_know`
   facts to learn, or open the whole text-field allow-list at once?
5. **Incentives** — are badges/leaderboard enough, or do we tie contribution to
   something tangible (e.g. early access, Ko-fi supporter perks)?
6. **Stats/images** — explicitly out of v1; confirm we're comfortable leaving
   those pipeline-only for now.

---

### TL;DR recommendation

Build **Layer 1 (identity)** now for immediate account value, then a **single
vertical slice of Layer 2** — "Help complete this page" for one field (`origin`)
+ the review queue — to prove the stewardship loop end-to-end before widening the
allow-list. Keep it review-queued until contributor volume justifies trust-based
auto-approve. This makes a profile feel *yours* and makes your work *matter*,
without risking the catalogue you've carefully enriched.
