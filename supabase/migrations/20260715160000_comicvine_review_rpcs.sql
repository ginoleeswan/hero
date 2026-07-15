-- Admin RPCs for the ComicVine review queue (issue #93). heroes has no client
-- write grant (see 20260715104931_heroes_reads_without_rls.sql), so resolving a
-- needs_review row must go through a SECURITY DEFINER RPC that self-checks
-- is_admin — same pattern as resolve_hero_qid / mark_hero_unresolved.

-- Accept a ComicVine match: point the hero at the confirmed id and re-queue it
-- so the enrichment drain re-fetches the RIGHT character by id (overwriting the
-- bad data the collision left). Also used for a manually-entered id.
create or replace function public.admin_set_comicvine_match(p_hero_id text, p_comicvine_id text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  update public.heroes
     set comicvine_id = p_comicvine_id,
         comicvine_status = 'pending'
   where id = p_hero_id;
end;
$function$;

-- Terminal: ComicVine genuinely has no right match for this hero.
create or replace function public.admin_mark_comicvine_unmatched(p_hero_id text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  update public.heroes
     set comicvine_status = 'unmatched'
   where id = p_hero_id;
end;
$function$;

-- Admins (guard enforces is_admin at runtime) + service_role only; revoke PUBLIC/anon.
do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_set_comicvine_match(text, text)',
    'public.admin_mark_comicvine_unmatched(text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end $$;
