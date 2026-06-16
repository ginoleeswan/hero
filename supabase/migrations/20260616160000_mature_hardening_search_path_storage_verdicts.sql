-- Round 2 hardening: pin search_path on the remaining (SECURITY INVOKER) RPCs,
-- take the maintenance rebuild off the public RPC surface, make the verdicts
-- cache client-read-only (the generate-verdict edge function becomes the sole
-- writer, via service_role), and stop the public storage buckets from being
-- listable.

-- ── 1. Pin search_path on the app's SECURITY INVOKER read/maintenance RPCs ────
-- These run as the caller (lower risk than DEFINER), but pinning clears the
-- advisor's function_search_path_mutable warnings and is best practice. Every
-- object they touch — including the pg_trgm operators used by search — lives in
-- public, so `= public` is sufficient.
alter function public.catalog_distributions()                                            set search_path = public;
alter function public.catalog_health()                                                   set search_path = public;
alter function public.category_facet_counts(text, text, text, text, boolean, text)       set search_path = public;
alter function public.get_active_campaigns(integer, integer)                             set search_path = public;
alter function public.get_era_timeline(integer)                                          set search_path = public;
alter function public.get_family_opponents(text, integer)                                set search_path = public;
alter function public.get_most_feared(integer)                                           set search_path = public;
alter function public.get_related_heroes(text, text, integer, boolean)                   set search_path = public;
alter function public.get_relationship(text, text)                                       set search_path = public;
alter function public.get_top_rivalries(integer)                                         set search_path = public;
alter function public.get_trending_for_user(uuid, integer)                               set search_path = public;
alter function public.get_trending_heroes(text, integer)                                 set search_path = public;
alter function public.get_trending_titles(text, integer, integer)                        set search_path = public;
alter function public.heroes_aliases_text(text[])                                        set search_path = public;
alter function public.rebuild_hero_relationships()                                       set search_path = public;
alter function public.search_heroes(text, text, text, integer, integer)                  set search_path = public;

-- ── 2. rebuild_hero_relationships: maintenance only, never a client RPC ───────
-- It TRUNCATEs + repopulates hero_relationships. As SECURITY INVOKER a client
-- call already fails on the missing TRUNCATE privilege, but it has no business
-- on the REST surface — restrict it to service_role (cron / edge functions).
revoke all on function public.rebuild_hero_relationships() from public, anon, authenticated;
grant execute on function public.rebuild_hero_relationships() to service_role;

-- ── 3. verdicts: make the shared AI cache client-read-only ───────────────────
-- Previously any signed-in user could INSERT arbitrary verdict text for any
-- hero pair into a cache every other user reads (cache poisoning). The
-- generate-verdict edge function now writes the cache with the service_role key
-- (which bypasses RLS), so clients only ever read. Keep the authenticated SELECT
-- policy from the previous migration; drop the client INSERT path.
drop policy if exists verdicts_insert on public.verdicts;

-- ── 4. Storage: stop public buckets from being listable ──────────────────────
-- Both buckets are public (objects are served via /object/public/… which does
-- not consult these policies) and currently empty. The broad SELECT policies
-- only enable the authenticated `list`/`select` API, letting any client
-- enumerate every file. The app never lists (it uses getPublicUrl / direct
-- URLs; the maintenance scripts use service_role), so remove them.
drop policy if exists "Public read hero portraits" on storage.objects;
drop policy if exists "Public read user media" on storage.objects;
