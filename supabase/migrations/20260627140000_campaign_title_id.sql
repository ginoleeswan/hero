-- Expose the campaign's linked title id so tapping the "Right Now" hero cover
-- navigates to the title (media) page rather than a character. Auto-generated
-- campaigns already key off a title; manual ones may be franchise-only (null →
-- the UI falls back to the lead character). Return shape changes → drop first.
drop function if exists public.get_active_campaigns(integer, integer);
create or replace function public.get_active_campaigns(
  p_limit integer default 3,
  p_chars integer default 16
)
returns table (
  campaign_id uuid, label text, headline text, blurb text, accent text,
  backdrop_url text, poster_url text, title_id text,
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
           c.priority, c.starts_at, c.title_id,
           t.backdrop_url, t.poster_url,
           h.id as hero_id, h.name as hero_name,
           h.image_url as hero_image_url, h.portrait_url as hero_portrait_url,
           row_number() over (
             partition by c.id order by h.issue_count desc nulls last
           ) as rn
    from active c
    left join public.titles t on t.id = c.title_id
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
         backdrop_url, poster_url, title_id,
         hero_id, hero_name, hero_image_url, hero_portrait_url
  from resolved
  where rn <= p_chars
  order by priority desc, starts_at desc, rn;
$$;
grant execute on function public.get_active_campaigns(integer, integer) to anon, authenticated, service_role;
