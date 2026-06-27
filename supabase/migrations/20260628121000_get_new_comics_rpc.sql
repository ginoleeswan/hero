-- "New This Week" reader. Direct analogue of get_trending_titles: pick the most
-- recent issues inside the display window that clear the tunable fame bar, then
-- attach their catalogue characters (lead first). Flat rows; the client groups.
create or replace function public.get_new_comics(
  p_days integer default 7,
  p_min_fame integer default 25,
  p_limit integer default 12,
  p_chars_per_issue integer default 8
)
returns table (
  issue_id text, volume_name text, issue_number text, cover_url text,
  store_date date, publisher text, max_fame smallint,
  hero_id text, hero_name text, hero_image_url text, hero_portrait_url text
)
language sql
stable
as $$
  with recent as (
    select * from public.comic_issues
    where store_date between current_date - p_days and current_date
      and max_fame >= p_min_fame
      and cover_url is not null
    order by store_date desc, max_fame desc
    limit p_limit
  ),
  chars as (
    select r.id as issue_id, r.volume_name, r.issue_number, r.cover_url,
           r.store_date, r.publisher, r.max_fame,
           h.id as hero_id, h.name as hero_name,
           h.image_url as hero_image_url, h.portrait_url as hero_portrait_url,
           row_number() over (
             partition by r.id order by h.fame_score desc nulls last
           ) as crank
    from recent r
    join public.comic_issue_appearances a on a.issue_id = r.id
    join public.heroes h on h.id = a.hero_id
    where (h.portrait_url is not null or h.image_url is not null)
  )
  select issue_id, volume_name, issue_number, cover_url, store_date, publisher, max_fame,
         hero_id, hero_name, hero_image_url, hero_portrait_url
  from chars
  where crank <= p_chars_per_issue
  order by store_date desc, max_fame desc, crank;
$$;
grant execute on function public.get_new_comics(integer, integer, integer, integer)
  to anon, authenticated, service_role;
