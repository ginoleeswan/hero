# Profiles & Contributions — Product + Technical Design

> Status: **proposal / for review**. No code yet. This doc defines the vision,
> data model, flows, and rollout for turning a Mythique account from a
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
*suggestions* until an admin (later: a trusted contributor) approves them. We get
the "I contributed" feeling without importing the open-wiki vandalism problem
before we have the contributor mass to police it. Quality of the existing
enriched data is never put at risk by an anonymous edit.

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
- **approved**: an admin (or trusted contributor) accepts → the change is applied
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
  trust      text not null default 'new',  -- new|trusted|steward (drives auto-approve)
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
  mark `approved`, set `reviewed_by/at`, update both parties' `contributor_stats`,
  re-evaluate trust tier. On `reject`: mark `rejected` + reason.
- (later) auto-approve path: when a `trusted`/`steward` user submits a low-risk
  kind (tag add, fact), insert directly as `approved` + applied, skipping the queue.

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
- **Trust tiers** (`contributor_stats.trust`): `new` → everything queues;
  `trusted` (e.g. ≥10 approved, <20% reject) → low-risk kinds auto-approve;
  `steward` → may also review others' low-risk items (future).
- **Reversibility**: every applied change keeps `old_value`, so an approval can be
  rolled back. Approvals are admin-audited via `reviewed_by`.
- **Reports** (`kind='report'`) never mutate data — they only raise a flag in the
  queue for an admin to act on.

## 7. UI surfaces

- **Hero page**: "Help complete this page" card on under-enriched heroes (driven by
  empty fields); inline "suggest an edit" / "add a fact" / "flag" affordances.
- **Profile**: identity layer (collections, taste, battle record, badges) + a
  **Contributions** section ("12 accepted · 3 pending") and a Steward badge.
- **Admin console**: a new **Review** domain alongside Campaigns / Catalog /
  Pipelines / Sources / Spend — the pending queue with approve/reject, reusing the
  existing `is_admin`-gated command-centre patterns.
- **Submission UX**: a small modal/sheet per contribution kind; optimistic "under
  review" state; the author sees status in their profile.

## 8. Rollout phases

| Phase | Ships | Risk |
| --- | --- | --- |
| **0** | This doc, agreed scope | — |
| **1** | Identity layer (taste profile, battle record, streaks, badges) | none |
| **2a** | `contributions` + `contributor_stats` tables, `submit_contribution` + admin review RPCs, **Review** admin domain | low (admin-only review) |
| **2b** | Hero-page "Help complete this page" + suggest/flag UI; profile Contributions section + attribution | low |
| **2c** | Trust tiers + auto-approve for trusted contributors | medium (relaxes the gate) |
| **3** | Social (follows, public profiles, leaderboard) | medium |

## 9. Open questions (need product calls)

1. **Auto-approve threshold** — do we ever let `trusted` users skip the queue, or
   keep everything admin-reviewed until volume forces the issue?
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
