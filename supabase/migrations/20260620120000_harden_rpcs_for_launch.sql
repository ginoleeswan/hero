-- Harden the data layer for public web launch.
--
-- 1. Admin RPCs already enforce an internal is_admin() check, but they should
--    never be reachable by the anonymous role. Revoke EXECUTE from anon + PUBLIC
--    (authenticated admins still pass the internal gate). Clears the Supabase
--    "anon can execute SECURITY DEFINER function" advisories.
-- 2. Pin the search_path on the one function that was still role-mutable.
-- 3. Constrain the anonymous daily-result write to today/yesterday so it can't be
--    used to flood arbitrary or future dates. (Full per-IP rate limiting would
--    need an edge function; this removes the obvious abuse vector.)
revoke execute on function public.admin_add_comicvine_heroes(p_heroes jsonb) from anon, public;
revoke execute on function public.admin_cron_status() from anon, public;
revoke execute on function public.admin_delete_campaign(p_id uuid) from anon, public;
revoke execute on function public.admin_delete_hero(p_hero_id text) from anon, public;
revoke execute on function public.admin_edit_hero(p_hero_id text, p_kind text, p_target_field text, p_new_value text) from anon, public;
revoke execute on function public.admin_merge_heroes(p_loser text, p_winner text) from anon, public;
revoke execute on function public.admin_reenrich_hero(p_id text) from anon, public;
revoke execute on function public.admin_reschedule_cron(p_jobname text, p_schedule text, p_limit integer) from anon, public;
revoke execute on function public.admin_retry_failed() from anon, public;
revoke execute on function public.admin_review_contribution(p_id bigint, p_decision text, p_reason text) from anon, public;
revoke execute on function public.admin_review_queue(p_limit integer, p_offset integer) from anon, public;
revoke execute on function public.admin_run_drain(p_limit integer) from anon, public;
revoke execute on function public.admin_run_wikidata_enrich(p_limit integer) from anon, public;
revoke execute on function public.admin_run_wikidata_resolve(p_limit integer) from anon, public;
revoke execute on function public.admin_set_drain_cron(p_enabled boolean) from anon, public;
revoke execute on function public.admin_snapshot_now() from anon, public;
revoke execute on function public.admin_stop_run(p_run_id bigint) from anon, public;
revoke execute on function public.admin_toggle_cron(p_jobname text, p_enabled boolean) from anon, public;
revoke execute on function public.admin_upsert_campaign(p_label text, p_headline text, p_ends_at timestamp with time zone, p_id uuid, p_blurb text, p_accent text, p_franchise text, p_title_id text, p_hero_ids text[], p_priority integer, p_starts_at timestamp with time zone) from anon, public;

alter function public.category_facet_counts(p_slug text, p_publisher text, p_alignment text, p_gender text, p_has_stats boolean, p_search text)
  set search_path = public;

create or replace function public.record_daily_result(p_date date, p_won boolean, p_guesses int)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.daily_game_results (puzzle_date, won, guesses)
  select p_date, p_won, greatest(1, least(coalesce(p_guesses, 1), 10))
  where p_date is not null and p_date between current_date - 1 and current_date;
$function$;

grant execute on function public.record_daily_result(date, boolean, int) to anon, authenticated, service_role;
