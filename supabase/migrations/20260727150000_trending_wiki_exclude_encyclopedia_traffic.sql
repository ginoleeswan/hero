-- Trending Movers was ranking school homework.
--
-- get_trending_heroes_wiki gates only on pageviews_week >= 1000 and sorts by raw
-- spike, so general-encyclopedia traffic beat fandom traffic. Measured
-- 2026-07-27, the top of the list: Charybdis 10.9x (139,487 views), Orestes 4.8x,
-- Memnon 4.2x, Ajax 3.7x, Pasiphae 3.0x, Patroclus 2.8x — six of the top
-- eighteen, all Greek mythology, all pulling curriculum traffic in exam season.
-- This leaks onto the Pulse live card too, which reads "Moving fastest" from the
-- same source.
--
-- A fame floor is the obvious fix and it is the WRONG one: measured against the
-- same snapshot, the legitimate surges included Orko at fame 23, Beyonder at 24
-- and Dr. Facilier at 3 — indistinguishable from Orestes at 24 and Memnon at 25
-- on fame alone. What separates them is the bucket, not the score.
--
-- `In the Public Domain` and `Non-Fictional` are where the catalogue keeps
-- mythology and real historical figures. Both are exactly the encyclopedia
-- traffic; neither is what a reader means by a character trending. Excluding the
-- two leaves a list where every entry has a reason you could name: Doctor Doom
-- (Doomsday footage at SDCC), five Masters of the Universe characters (the film),
-- Rebecca Chambers (Resident Evil), Doctor Poison, Beyonder.
--
-- Kept as a column filter rather than a curated deny-list of names, so a new
-- mythological character inherits the behaviour without anyone maintaining a list.

create or replace function public.get_trending_heroes_wiki(
  p_limit integer default 12,
  p_min_week integer default 1000
)
returns table (
  id text,
  name text,
  image_url text,
  portrait_url text,
  avatar_url text,
  pageviews_week integer,
  pageviews_spike numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select id, name, image_url, portrait_url, avatar_url, pageviews_week, pageviews_spike
  from public.heroes
  where pageviews_week >= p_min_week
    and pageviews_spike is not null
    and (portrait_url is not null or image_url is not null)
    -- The encyclopedia buckets. See the header: fame can't separate these.
    and coalesce(publisher, '') not in ('In the Public Domain', 'Non-Fictional')
  order by pageviews_spike desc
  limit p_limit;
$function$;
