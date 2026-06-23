# Web Observability — Apply & Finish (handoff for a Supabase-MCP session)

**Branch:** `claude/web-observability-tools-625r23`
**Why this exists:** Phases 1–3 (Community, Presence, Traffic) are code-complete and
pushed, but the session that built them had **no Supabase MCP connected**, so the
migrations were never applied and `database.generated.ts` was never regenerated. The
client code compiles via a few temporary `as never` / `page_views` casts that must be
dropped once types are regenerated.

Run this in a Claude Code chat **with the Supabase MCP connected (write enabled)** and the
branch checked out. Paste the prompt at the bottom, or follow the steps directly.

---

## Step 1 — Apply the 4 migrations, in this order

Use `mcp__supabase__apply_migration` once per file. Pass the file's full contents as the
query and the listed name. Order matters (later ones `create or replace` earlier objects and
reference earlier tables):

| # | Migration file | `name` arg |
|---|---|---|
| 1 | `supabase/migrations/20260623120000_admin_community_overview.sql` | `admin_community_overview` |
| 2 | `supabase/migrations/20260623130000_user_presence.sql` | `user_presence` |
| 3 | `supabase/migrations/20260623140000_page_views.sql` | `page_views` |
| 4 | `supabase/migrations/20260623150000_admin_traffic_overview.sql` | `admin_traffic_overview` |

Sanity check after applying (via `mcp__supabase__execute_sql`):

```sql
-- objects exist
select to_regclass('public.page_views') is not null as page_views_ok,
       (select count(*) from pg_proc where proname in
         ('admin_community_overview','admin_traffic_overview','touch_last_seen')) as fns,
       (select count(*) from information_schema.columns
         where table_name='user_profiles' and column_name='last_seen_at') as last_seen_col;
```

> NOTE on verifying the RPCs directly: `admin_community_overview()` / `admin_traffic_overview()`
> self-guard on `auth.uid()` + `is_admin`. Called through the MCP (no auth context) they return
> `{"authorized": false}` — that's expected, not a bug. To see real data, call them from the app
> while signed in as an admin (ensure `user_profiles.is_admin = true` for your account), or test
> the inner `select`s directly.

## Step 2 — Regenerate types

Run `mcp__supabase__generate_typescript_types` and **overwrite** `src/types/database.generated.ts`
with the result. Do not hand-edit it.

## Step 3 — Drop the temporary casts (now that the RPCs/table are typed)

- **`src/lib/db/community.ts:85`**
  `supabase.rpc('admin_community_overview' as never)` → `supabase.rpc('admin_community_overview')`
  (keep the `data as unknown as OverviewJson` line — the RPC returns `Json`.)

- **`src/lib/db/presence.ts:10`**
  `supabase.rpc('touch_last_seen' as never)` → `supabase.rpc('touch_last_seen')`

- **`src/lib/db/traffic.ts:47-52`**
  ```ts
  const { data, error } = await supabase.rpc('admin_traffic_overview', { p_days: days });
  ```
  (remove both `as never`.)

- **`src/lib/db/pageViews.ts`** — remove the `InsertOnly` interface (line ~52) and the cast at
  line ~63; insert directly:
  ```ts
  await supabase.from('page_views').insert({
    route, path,
    user_id: session?.user?.id ?? null,
    session_id: getSessionId(),
    referrer: getReferrerHost(),
    device: getDevice(),
  });
  ```

## Step 4 — Verify

```sh
yarn tsc --noEmit          # must be clean
yarn test:ci               # 431 tests should pass
yarn lint                  # 0 errors (pre-existing ref warnings in health.web.tsx are fine)
```

## Step 5 — Commit & push (stay on the branch)

```sh
git add -A
git commit -m "chore(admin): apply web-observability migrations; regen types; drop temp casts"
git push -u origin claude/web-observability-tools-625r23
```

## Optional — confirm the feature end to end
- Sign in as an admin and open `/admin/health` (web). The **Community** and **Traffic** rail
  items should populate (or show calm empty states pre-traffic).
- Navigate a few pages, then check **Traffic** → rows should appear in `page_views`
  (`select count(*) from public.page_views;`).
- **Before launch:** make sure `app/privacy.tsx` / `app/privacy.web.tsx` mention first-party
  page-view + presence analytics.

---

## Copy-paste prompt for the other chat

> On branch `claude/web-observability-tools-625r23`, finish the web-observability work using the
> Supabase MCP. Open `docs/superpowers/plans/2026-06-23-web-observability-APPLY-STEPS.md` and do
> exactly that: apply the 4 migrations in order (`apply_migration`), regenerate
> `src/types/database.generated.ts` (`generate_typescript_types`), drop the temporary `as never`
> / `page_views` casts in `community.ts`, `presence.ts`, `traffic.ts`, `pageViews.ts`, then run
> `yarn tsc --noEmit && yarn test:ci`, and commit + push to the same branch. Don't open a PR
> unless I ask.
