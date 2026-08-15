-- Materialise the normalised title, because normalising on the fly times out.
--
-- 20260815151000 made matching normalise both sides, which was correct and
-- unusably slow: two regexp_replace calls per title per video, over 3,606
-- titles, with nothing indexable to lean on. Re-matching the ingested backlog
-- died on `canceling statement due to statement timeout`, and because matching
-- failed every video looked unmatched, so discovery then went and re-searched
-- TMDB for titles the catalogue already had.
--
-- A stored generated column computes the normalisation once per title, on write,
-- instead of once per title per video on read. The matcher then does a plain
-- substring test over a plain text column.
--
-- This stays a full scan of `titles` per video: substring containment cannot use
-- a btree index, since the pattern is the COLUMN and the string being searched is
-- the parameter -- the opposite of what an index supports. That is fine at 3.6k
-- rows scanning a short text column, and the sweep only ever matches videos it
-- has just ingested. If titles ever reaches a size where this hurts, the answer
-- is a candidate-narrowing pass (first significant word) before the containment
-- test, not an index that cannot exist.

alter table public.titles
  add column if not exists title_norm text
  generated always as (public.normalize_match_text(title)) stored;

create index if not exists titles_title_norm_idx on public.titles (title_norm);

create or replace function public.match_title_for_video(p_text text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  with v as (select public.normalize_match_text(p_text) as hay)
  select t.id
  from public.titles t, v
  where t.title_norm is not null
    and length(t.title_norm) >= 5
    and position(t.title_norm in v.hay) > 0
  order by
    (case
       when t.release_date is null
         or t.release_date >= current_date - 365
         or (t.details->>'status') in ('Returning Series', 'In Production', 'Planned', 'Pilot')
       then 0 else 1
     end),
    length(t.title_norm) desc,
    t.release_date desc nulls last
  limit 1;
$$;
