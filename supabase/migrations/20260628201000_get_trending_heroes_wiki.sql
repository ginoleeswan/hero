-- "Trending this week" reader: heroes ranked by pageview spike, above a noise
-- floor, with art (so the rail's cards render).
create or replace function public.get_trending_heroes_wiki(
  p_limit integer default 12,
  p_min_week integer default 1000
)
returns table (
  id text, name text, image_url text, portrait_url text,
  pageviews_week integer, pageviews_spike numeric
)
language sql
stable
as $$
  select id, name, image_url, portrait_url, pageviews_week, pageviews_spike
  from public.heroes
  where pageviews_week >= p_min_week
    and pageviews_spike is not null
    and (portrait_url is not null or image_url is not null)
  order by pageviews_spike desc
  limit p_limit;
$$;
grant execute on function public.get_trending_heroes_wiki(integer, integer)
  to anon, authenticated, service_role;
