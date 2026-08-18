-- What two characters have actually appeared in together.
--
-- The most concrete thing we can say about a pair. ComicVine gives no reason
-- text for a relationship, so the focus card could only infer from a shared
-- roster or pad with a mutual-connection count; hero_media_appearances holds
-- 12,635 rows across 2,660 characters, and Wonder Woman and Batman share 54
-- titles. That is their connection, evidenced, with poster art attached.
--
-- Per-pair rather than folded into get_hero_neighborhood: this is only ever
-- needed for the one node being looked at, and computing it for all 24 would
-- be 24x the work and payload for something nobody reads.
--
-- Ordered by popularity, NOT rating — the highest-rated shared titles are
-- obscure direct-to-video animations, so sorting by score buries Justice
-- League under Apokolips War. Only titles WITH poster art are returned, since
-- the strip is the point; the counts and the span still describe all of them.
CREATE OR REPLACE FUNCTION public.get_shared_titles(p_a text, p_b text, p_limit integer DEFAULT 4)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
  with shared as (
    select t.id, t.title, t.year, t.poster_url, t.media_type, t.popularity
    from public.hero_media_appearances x
    join public.hero_media_appearances y on y.title_id = x.title_id
    join public.titles t on t.id = x.title_id
    where x.hero_id = p_a and y.hero_id = p_b and p_a <> p_b
  )
  select json_build_object(
    'total', (select count(*) from shared),
    'first_year', (select min(year) from shared),
    'last_year', (select max(year) from shared),
    'titles', coalesce(
      (
        select json_agg(row_to_json(top))
        from (
          select id, title, year, poster_url, media_type
          from shared
          where poster_url is not null
          order by popularity desc nulls last, year desc nulls last
          limit greatest(1, least(p_limit, 8))
        ) top
      ),
      '[]'::json
    )
  );
$function$;

grant execute on function public.get_shared_titles(text, text, integer) to anon, authenticated;;
