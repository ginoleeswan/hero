-- A title is in cinemas, or streaming, or not out yet. It cannot be two of them.
--
-- The buckets were three independent date windows over the same table, so a film
-- released three months ago WITH a Netflix deal satisfied both `on_screen` and
-- `streaming` and came back twice, leaving the client to dedupe and the badge to
-- pick one at random.
--
-- And `on_screen` meant "released in the last 365 days". A theatrical run is six
-- to ten weeks; the rail was captioned "In Cinemas & Streaming" while showing
-- films that left cinemas nine months earlier. It was stretched that wide
-- because only thirteen titles in a whole year have a linked catalogue
-- character, and the rail wanted twelve — which is the honest reason, and still
-- not a reason to say something false. A short true rail beats a full one that
-- is wrong, the same call as leaving a convention year as a gap rather than
-- filling it with the wrong window.
--
-- So: one status, computed once, in priority order.
--
--   coming_soon   not out yet. Unambiguous.
--   streaming     a US flatrate provider exists. This is a FACT about the title
--                 rather than a guess from its age, and it outranks the
--                 theatrical test because a film on Netflix is not in cinemas
--                 however recent it is.
--   on_screen     out within the theatrical window and NOT streaming.
--
-- Anything else — an old film with no provider — is simply not in the rail, which
-- is what "in cinemas and streaming" already promised.
--
-- Measured after: on_screen went from 12 titles spanning a year (oldest
-- 2025-09-18) to 6 spanning ten weeks, and Zootopia 2 stopped being listed as
-- in cinemas eight months after it left them.
--
-- The column is still called `bucket` so the reader and the client need no
-- change; what altered is that a title now appears under exactly one of them.

create or replace function public.get_trending_titles_multi(
  p_buckets text[],
  p_title_limit integer default 12,
  p_chars_per_title integer default 3
)
returns table (
  bucket text, title_id text, title text, media_type text, release_date date,
  backdrop_url text, poster_url text, provider text, provider_logo text,
  overview text, hero_id text, hero_name text, hero_image_url text,
  hero_portrait_url text, hero_avatar_url text
)
language sql
stable
set search_path to 'public'
as $function$
  with classified as (
    select
      t.id, t.title, t.media_type, t.release_date, t.backdrop_url, t.poster_url,
      t.overview, t.popularity, t.vote_average,
      (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') as provider,
      case
        when (t.watch_providers::jsonb #>> '{US,flatrate,0,logo_path}') is not null
        then 'https://image.tmdb.org/t/p/w92' ||
             (t.watch_providers::jsonb #>> '{US,flatrate,0,logo_path}')
      end as provider_logo,
      case
        when t.release_date > current_date then 'coming_soon'
        when (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') is not null
             and t.release_date >= current_date - 540 then 'streaming'
        -- 70 days. Long enough to keep a summer tentpole through its real run,
        -- short enough that nothing here has actually left the cinema.
        when t.release_date >= current_date - 70 then 'on_screen'
      end as bucket
    from public.titles t
    where t.media_type in ('film', 'tv')
      and t.release_date is not null
      and exists (
        select 1 from public.hero_media_appearances a
        join public.heroes h on h.id = a.hero_id
        where a.title_id = t.id and (h.portrait_url is not null or h.image_url is not null)
      )
  ),
  ranked as (
    select * from (
      select c.*,
        row_number() over (
          partition by c.bucket
          order by
            -- Soonest first for what has not happened; biggest first for what
            -- has. Ordering the released buckets by popularity is safe now the
            -- window is a real theatrical one — everything in it is current.
            case when c.bucket = 'coming_soon' then c.release_date end asc nulls last,
            coalesce(c.popularity, 0) desc,
            case when c.bucket <> 'coming_soon' then c.release_date end desc nulls last
        ) as trank
      from classified c
      where c.bucket is not null and c.bucket = any (p_buckets)
    ) z
    where z.trank <= p_title_limit
  ),
  chars as (
    select r.bucket, r.id as title_id, r.title, r.media_type, r.release_date,
           r.backdrop_url, r.poster_url, r.provider, r.provider_logo, r.overview, r.trank,
           h.id as hero_id, h.name as hero_name,
           h.image_url as hero_image_url, h.portrait_url as hero_portrait_url,
           h.avatar_url as hero_avatar_url,
           row_number() over (
             partition by r.bucket, r.id order by h.fame_score desc nulls last, a.rank asc nulls last
           ) as crank
    from ranked r
    join public.hero_media_appearances a on a.title_id = r.id
    join public.heroes h on h.id = a.hero_id
    where (h.portrait_url is not null or h.image_url is not null)
  )
  select bucket, title_id, title, media_type, release_date, backdrop_url, poster_url,
         provider, provider_logo, overview, hero_id, hero_name, hero_image_url,
         hero_portrait_url, hero_avatar_url
  from chars
  where crank <= p_chars_per_title
  order by trank, crank;
$function$;
