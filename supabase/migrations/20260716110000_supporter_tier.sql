-- Supporter tier (monetization option A — see
-- docs/superpowers/specs/2026-07-16-monetization-options.md). Recognition-based,
-- Ko-fi-powered, NO paywall: a stored flag on user_profiles (the is_admin
-- additive pattern), surfaced as a badge + settings thank-you, and used to
-- suppress donation nudges for people who already gave. Set manually by an
-- admin from Ko-fi receipts at current scale (webhook automation later).

alter table public.user_profiles
  add column if not exists is_supporter boolean not null default false;
alter table public.user_profiles
  add column if not exists supporter_since timestamptz;

-- Admin-only toggle, following the resolve_hero_qid SECURITY DEFINER template.
create or replace function public.admin_set_supporter(p_user_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  update public.user_profiles
     set is_supporter = p_on,
         supporter_since = case when p_on then coalesce(supporter_since, now()) else null end
   where id = p_user_id;
end;
$function$;

do $$
begin
  revoke all on function public.admin_set_supporter(uuid, boolean) from public, anon;
  grant execute on function public.admin_set_supporter(uuid, boolean) to authenticated, service_role;
end $$;
