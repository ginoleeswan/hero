-- Phase 1 of the "always feel current" Explore work: surface characters tied to
-- the real-world film/TV slate, straight from the TMDB-backed titles table and
-- the hero_media_appearances graph. Read-only; no external calls. Three buckets:
--   on_screen   — released in the last year (recent theatrical / TV)
--   coming_soon — releasing in the future
--   streaming   — recent + currently on a US streaming service (flatrate)
-- One row per hero (their most relevant title), with a context title + provider
-- the UI can show as a badge. Recency is the primary order so the feed leads
-- with the most recent release; ties break by the character's popularity
-- (issue_count) so marquee names lead within each title rather than bit players.
create or replace function public.get_trending_heroes(
  p_bucket text default 'on_screen',
  p_limit integer default 20
)
returns table (
  id text, name text, image_url text, portrait_url text,
  context_title text, media_type text, release_date date, provider text
)
language sql
stable
as $$
  select s.id, s.name, s.image_url, s.portrait_url,
         s.context_title, s.media_type, s.release_date, s.provider
  from (
    select distinct on (h.id)
      h.id, h.name, h.image_url, h.portrait_url, h.issue_count,
      t.title as context_title, t.media_type, t.release_date,
      (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') as provider
    from public.hero_media_appearances a
    join public.heroes h on h.id = a.hero_id
    join public.titles t on t.id = a.title_id
    where t.media_type in ('film', 'tv')
      and (h.portrait_url is not null or h.image_url is not null)
      and case p_bucket
        when 'on_screen'   then t.release_date between current_date - 365 and current_date
        when 'coming_soon' then t.release_date > current_date
        when 'streaming'   then t.release_date between current_date - 540 and current_date
                                and (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') is not null
        else false
      end
    -- distinct on requires h.id first; pick each hero's most relevant title.
    order by h.id,
      case when p_bucket = 'coming_soon' then t.release_date end asc,
      case when p_bucket <> 'coming_soon' then t.release_date end desc,
      a.rank asc nulls last
  ) s
  order by
    case when p_bucket = 'coming_soon' then s.release_date end asc nulls last,
    case when p_bucket <> 'coming_soon' then s.release_date end desc nulls last,
    s.issue_count desc nulls last,
    s.context_title
  limit p_limit;
$$;

grant execute on function public.get_trending_heroes(text, integer) to anon, authenticated, service_role;
