-- Keep the daily pageview series that sync-wiki-pageviews already fetches.
--
-- The job pulls 14 daily datapoints per hero and reduces them to two 7-day
-- integers, discarding the other 12. That array is the CURVE, and the curve is
-- the only thing in this stack that can date a surge: pageviews_at records when
-- WE looked, not when the thing happened, which is exactly why the design doc
-- excluded surges from the Pulse in the first place ("an undated row in a
-- timestamped feed would undermine the whole premise").
--
-- watched_events already stores views_daily for the same reason and uses it to
-- infer a convention's window from attention alone. This is the same trick
-- applied to characters: find the day the curve breaks out, and a surge becomes
-- an event with an honest timestamp.
--
-- Zero extra API calls — the data is in the response we already parse.

alter table public.heroes
  add column if not exists views_daily jsonb;

comment on column public.heroes.views_daily is
  'Last 14 days of Wikipedia pageviews, [{date,views}], newest last. Written by '
  'sync-wiki-pageviews from a response it was already fetching. The series is '
  'what dates a surge; pageviews_at is only when we looked.';

-- Surge candidates are read by spike, and the reader also needs the curve, so
-- index the gate rather than scanning 3,857 tracked heroes on every Explore load.
create index if not exists heroes_surge_idx
  on public.heroes (pageviews_spike desc)
  where pageviews_spike is not null
    and views_daily is not null
    and publisher is not null;
