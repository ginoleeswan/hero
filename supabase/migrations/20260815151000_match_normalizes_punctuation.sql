-- Match on normalised text, because "&" and "and" are the same word.
--
-- Disney+ posted "Percy Jackson & the Olympians Season 3 | Teaser Trailer" and
-- it matched nothing, then discovery searched TMDB, got back the right series --
-- "Percy Jackson and the Olympians" -- and REJECTED it, because the containment
-- test is literal and the catalogue spells the conjunction out while the
-- marketing title uses an ampersand. One character, and the biggest Disney+ show
-- of the weekend was invisible twice over.
--
-- The same class covers hyphens and colons: "Spider-Man" against "Spider Man",
-- "Marvel's Wolverine" against "Marvels Wolverine". Normalising both sides to
-- lowercase alphanumerics with "&" spelled out makes all of these one rule
-- rather than a growing list of special cases.
--
-- Deliberately NOT fuzzy. This is still exact containment, just of a normalised
-- string — no trigram similarity, no edit distance, nothing with a threshold to
-- tune. Loosening from "identical" to "same letters and digits in the same
-- order" is a small, predictable widening; similarity scoring is a different
-- risk profile and would want its own evidence before going anywhere near
-- promotion.

create or replace function public.normalize_match_text(p_text text)
returns text
language sql
immutable
parallel safe
as $$
  select btrim(regexp_replace(
    regexp_replace(lower(coalesce(p_text, '')), '&', ' and ', 'g'),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

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
  where t.title is not null
    -- Floor applies to the NORMALISED title: "It" and "Up" stay excluded, but a
    -- title is no longer saved from the floor by its punctuation.
    and length(public.normalize_match_text(t.title)) >= 5
    and position(public.normalize_match_text(t.title) in v.hay) > 0
  order by
    (case
       when t.release_date is null
         or t.release_date >= current_date - 365
         or (t.details->>'status') in ('Returning Series', 'In Production', 'Planned', 'Pilot')
       then 0 else 1
     end),
    length(t.title) desc,
    t.release_date desc nulls last
  limit 1;
$$;

-- Re-match history under the widened rule. Promotion is `on conflict do
-- nothing`, so nothing already on the rail moves.
update public.channel_videos set matched_at = null, title_id = null;
