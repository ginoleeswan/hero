-- Harden the fan-out: ComicVine movie names carry inconsistent surrounding
-- whitespace, so match on btrim(lower(...)) instead of raw lower(...). Then
-- backfill any hero↔film edges missed by the original exact-equality fan-out.

create or replace function public.register_film_match(
  p_cv_name    text,
  p_tmdb_id    text,
  p_media_type text,
  p_title      text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.films (tmdb_id, media_type, title)
  values (p_tmdb_id, coalesce(p_media_type, 'movie'), p_title)
  on conflict (tmdb_id) do nothing;

  insert into public.hero_film_appearances (hero_id, tmdb_id, cv_name, cv_url, rank)
  select h.id,
         p_tmdb_id,
         m->>'name',
         m->>'url',
         h.issue_count
  from public.heroes h,
       lateral jsonb_array_elements(to_jsonb(h.movies)) as m
  where h.movies is not null
    and btrim(lower(m->>'name')) = btrim(lower(p_cv_name))
  on conflict (hero_id, tmdb_id) do nothing;

  update public.tmdb_match_queue
     set status = 'matched', tmdb_id = p_tmdb_id
   where cv_name = p_cv_name;
end;
$$;

-- One-time backfill of edges missed by the previous exact-equality fan-out.
insert into public.hero_film_appearances (hero_id, tmdb_id, cv_name, cv_url, rank)
select h.id, q.tmdb_id, min(m->>'name'), min(m->>'url'), max(h.issue_count)
from public.heroes h
cross join lateral jsonb_array_elements(to_jsonb(h.movies)) as m
join public.tmdb_match_queue q
  on btrim(lower(q.cv_name)) = btrim(lower(m->>'name'))
where q.status = 'matched' and q.tmdb_id is not null and h.movies is not null
group by h.id, q.tmdb_id
on conflict (hero_id, tmdb_id) do nothing;
