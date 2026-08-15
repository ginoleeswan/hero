-- An event's page shows what belongs to THAT event, not to that week.
--
-- Both content sections were scoped to the time window and nothing else, so
-- everything that happened that week was presented as the event's. On the live
-- D23 page that meant:
--
--   "Who it moved"        Pichu, Pikachu, Aunt Hilda Spellman, Songbird and
--                         Vigilante (Dorian), each captioned "after D23".
--   "79 announcements"    including Crunchyroll 8, PlayStation 5, Nintendo 4,
--                         Warner Bros 4, DC 3, Prime Video 3 — none of which
--                         announce anything at a Disney fan event.
--
-- The repo's rule is that copy stays TEMPORAL, NEVER CAUSAL. A heading that
-- says "Who it moved" over a Pokémon breaks that however defensible each word
-- is on its own, and an inflated count is simply wrong. Worse, the pageview
-- sweep fix earlier today took D23 from 1 mover to 5, so four of the five were
-- newly-added noise: the fix made the false claim bigger.
--
-- Affinity is CURATED, not inferred. There is no reliable way to derive "is this
-- Disney's" from a channel or a publisher string, and guessing would reproduce
-- the same problem with extra steps. Two nullable arrays, where NULL means "no
-- affinity — show everything in the window", which is the correct answer for a
-- general convention: San Diego Comic-Con really is where everyone announces,
-- and filtering it to one studio would be its own kind of lie.

alter table public.watched_events
  add column if not exists channel_slugs text[],
  add column if not exists publishers text[];

comment on column public.watched_events.channel_slugs is
  'media_channels.slug values whose uploads count as this event''s announcements. '
  'NULL = no filter, correct for general conventions like SDCC.';
comment on column public.watched_events.publishers is
  'heroes.publisher values whose characters count as moved BY this event. '
  'NULL = no filter.';

-- Single-studio events. Everything else stays NULL on purpose.
update public.watched_events set
  channel_slugs = array['marvel','star-wars','disney-plus','pixar','twentieth-century'],
  publishers    = array['Disney','Marvel','Star Wars','20th Century Studios']
where slug = 'd23';

update public.watched_events set
  channel_slugs = array['nintendo'],
  publishers    = array['Nintendo']
where slug = 'nintendo-direct';

update public.watched_events set
  channel_slugs = array['star-wars'],
  publishers    = array['Star Wars']
where slug = 'swce';

update public.watched_events set
  channel_slugs = array['dc','warner-bros'],
  publishers    = array['DC Comics']
where slug = 'dc-fandome';

-- Game showcases: the platform holders and publishers, no comic characters.
update public.watched_events set
  channel_slugs = array['playstation','xbox','nintendo','ubisoft','bethesda','blizzard','bandai-namco','riot-games']
where slug in ('gamescom','summer-game-fest','game-awards','pax');

-- Anime conventions.
update public.watched_events set
  channel_slugs = array['crunchyroll']
where slug in ('comiket','anime-expo');
