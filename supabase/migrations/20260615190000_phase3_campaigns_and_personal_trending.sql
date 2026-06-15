-- Phase 3: editorial campaigns + personalized trending.

-- ── 1. featured_campaigns ───────────────────────────────────────────────────
-- Admin-scheduled editorial moments TMDB popularity can't see (premieres,
-- Comic-Con, game launches). A start/end window; targets a set of characters by
-- explicit ids, a franchise, or a title.
create table if not exists public.featured_campaigns (
  id uuid primary key default gen_random_uuid(),
  label text not null,                 -- eyebrow, e.g. "In Theaters"
  headline text not null,              -- row title, e.g. "Masters of the Universe"
  blurb text,
  accent text,                         -- optional hex accent
  franchise text,
  title_id text references public.titles(id) on delete set null,
  hero_ids text[],
  priority integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists featured_campaigns_window_idx
  on public.featured_campaigns (ends_at, starts_at, priority desc);

alter table public.featured_campaigns enable row level security;
drop policy if exists "featured_campaigns_public_read" on public.featured_campaigns;
create policy "featured_campaigns_public_read"
  on public.featured_campaigns for select using (true);
-- Writes go through the admin-gated security-definer RPC only.

-- Active campaigns (window contains now), highest priority first, resolved to
-- hero cards. Resolution precedence: explicit hero_ids > franchise > title.
create or replace function public.get_active_campaigns(
  p_limit integer default 3,
  p_chars integer default 16
)
returns table (
  campaign_id uuid, label text, headline text, blurb text, accent text,
  hero_id text, hero_name text, hero_image_url text, hero_portrait_url text
)
language sql
stable
as $$
  with active as (
    select * from public.featured_campaigns
    where now() between starts_at and ends_at
    order by priority desc, starts_at desc
    limit p_limit
  ),
  resolved as (
    select c.id as campaign_id, c.label, c.headline, c.blurb, c.accent,
           c.priority, c.starts_at,
           h.id as hero_id, h.name as hero_name,
           h.image_url as hero_image_url, h.portrait_url as hero_portrait_url,
           row_number() over (
             partition by c.id order by h.issue_count desc nulls last
           ) as rn
    from active c
    join public.heroes h on (
      (c.hero_ids is not null and h.id = any(c.hero_ids))
      or (c.hero_ids is null and c.franchise is not null and h.franchise = c.franchise)
      or (c.hero_ids is null and c.franchise is null and c.title_id is not null
          and exists (
            select 1 from public.hero_media_appearances a
            where a.title_id = c.title_id and a.hero_id = h.id
          ))
    )
    where (h.portrait_url is not null or h.image_url is not null)
  )
  select campaign_id, label, headline, blurb, accent,
         hero_id, hero_name, hero_image_url, hero_portrait_url
  from resolved
  where rn <= p_chars
  order by priority desc, starts_at desc, rn;
$$;
grant execute on function public.get_active_campaigns(integer, integer) to anon, authenticated, service_role;

-- Admin upsert (insert when p_id is null, else update). is_admin gated.
create or replace function public.admin_upsert_campaign(
  p_label text,
  p_headline text,
  p_ends_at timestamptz,
  p_id uuid default null,
  p_blurb text default null,
  p_accent text default null,
  p_franchise text default null,
  p_title_id text default null,
  p_hero_ids text[] default null,
  p_priority integer default 0,
  p_starts_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_id is null then
    insert into public.featured_campaigns
      (label, headline, blurb, accent, franchise, title_id, hero_ids, priority, starts_at, ends_at)
    values
      (p_label, p_headline, p_blurb, p_accent, p_franchise, p_title_id, p_hero_ids, p_priority, p_starts_at, p_ends_at)
    returning id into v_id;
  else
    update public.featured_campaigns set
      label = p_label, headline = p_headline, blurb = p_blurb, accent = p_accent,
      franchise = p_franchise, title_id = p_title_id, hero_ids = p_hero_ids,
      priority = p_priority, starts_at = p_starts_at, ends_at = p_ends_at
    where id = p_id
    returning id into v_id;
  end if;
  return v_id;
end $$;
grant execute on function public.admin_upsert_campaign(text, text, timestamptz, uuid, text, text, text, text, text[], integer, timestamptz) to authenticated, service_role;

-- Seed one live campaign so the row renders immediately (Masters of the Universe
-- just hit cinemas; its franchise was tagged in the Phase-1 migration).
insert into public.featured_campaigns (label, headline, blurb, accent, franchise, priority, ends_at)
values ('In Theaters Now', 'Masters of the Universe',
        'He-Man and Skeletor clash on the big screen — meet the cast of Eternia.',
        '#E77333', 'Masters of the Universe', 100, now() + interval '45 days');

-- ── 2. Personalized trending ────────────────────────────────────────────────
-- Characters from the current film/TV window whose publisher or franchise
-- matches what the user has favourited or recently viewed — "Trending in your
-- universe". Public hero data only; ranked by recency then fame.
create or replace function public.get_trending_for_user(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  id text, name text, image_url text, portrait_url text, context_title text
)
language sql
stable
as $$
  with aff as (
    select distinct h.publisher, h.franchise
    from (
      select hero_id from public.user_favourites where user_id = p_user_id
      union
      select hero_id from public.user_view_history where user_id = p_user_id
    ) u
    join public.heroes h on h.id = u.hero_id
    where h.publisher is not null or h.franchise is not null
  )
  select s.id, s.name, s.image_url, s.portrait_url, s.context_title
  from (
    select distinct on (h.id)
      h.id, h.name, h.image_url, h.portrait_url, t.title as context_title, t.release_date
    from public.titles t
    join public.hero_media_appearances a on a.title_id = t.id
    join public.heroes h on h.id = a.hero_id
    join aff on (aff.publisher = h.publisher or aff.franchise = h.franchise)
    where t.media_type in ('film', 'tv')
      and t.release_date between current_date - 540 and current_date + 120
      and (h.portrait_url is not null or h.image_url is not null)
    order by h.id, t.release_date desc nulls last, h.issue_count desc nulls last
  ) s
  order by s.release_date desc nulls last
  limit p_limit;
$$;
grant execute on function public.get_trending_for_user(uuid, integer) to anon, authenticated, service_role;
