-- Email-first auth: one screen asks for the email FIRST, then either asks for
-- the password (account exists), offers account creation (no account), or
-- points at the right OAuth button (account exists but was created with
-- Apple/Google and has no password — a password prompt would be a dead end).
--
-- SECURITY DEFINER because auth.users is not readable by anon. The function
-- exposes exactly two facts about an address: whether an account exists, and
-- which providers it uses. That is deliberate, standard email-first UX
-- (Apple, Google, Shopify all do it); the enumeration surface is accepted in
-- exchange for never dead-ending a real user. It returns nothing else — no
-- ids, no timestamps, no metadata.
create or replace function public.auth_lookup_email(p_email text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'exists', true,
        -- raw_app_meta_data->'providers' is the authoritative list ("email",
        -- "apple", "google"). Old rows may predate the array; fall back to the
        -- singular 'provider' key, then to email.
        'providers', coalesce(
          u.raw_app_meta_data->'providers',
          jsonb_build_array(coalesce(u.raw_app_meta_data->>'provider', 'email'))
        )
      )
      from auth.users u
      where lower(u.email) = lower(trim(p_email))
        and u.deleted_at is null
      limit 1
    ),
    jsonb_build_object('exists', false)
  );
$$;

revoke all on function public.auth_lookup_email(text) from public;
grant execute on function public.auth_lookup_email(text) to anon, authenticated;
