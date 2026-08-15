-- Fourteen more official channels, every id resolved rather than recalled.
--
-- The seed list was Hollywood-shaped: six studios, four streamers, three
-- platform holders. It had no arthouse (A24, Focus), no animation house of its
-- own (Pixar), no anime (Crunchyroll), and only two of the four companies that
-- announce games at the events this app watches.
--
-- On method, because it matters more than the list: ten channel ids were first
-- written from memory and NINE were wrong. Not wrong in a way that errors —
-- wrong in the way that returns somebody else's channel. Scraping the first
-- `"channelId"` out of a handle page is also wrong, because that is frequently a
-- FEATURED channel: @UniversalPictures yielded Illumination, @Ubisoft yielded
-- Rainbow 6, @Max yielded a band called Party Pupils.
--
-- What works is the canonical link (`rel="canonical" .../channel/UC…`) followed
-- by fetching the feed and reading back the name YouTube reports. That last step
-- is not a formality: it is what caught @DC resolving to a channel called
-- "LOl Rekt". scripts/resolve-youtube-channel.sh does both steps and is the
-- supported way to add a row here.
--
-- Deliberately excluded: @SquareEnix resolves to the Japanese-language channel,
-- which is legitimate and would put Japanese-titled uploads into an
-- English-language rail. Nothing is stored that was not read back and confirmed.
--
-- @PrimeVideo re-resolved to the id already seeded, which is the cross-check
-- working in the reassuring direction.

insert into public.media_channels (id, name, slug, official) values
  ('UCuPivVjnfNo4mb3Oog_frZg', 'A24',                         'a24',            true),
  ('UCU4SM3j_9TNWaSu8KdGV50g', 'Focus Features',              'focus-features', true),
  ('UCq0OueAsdxH6b8nyAspwViw', 'Universal Pictures',          'universal',      true),
  ('UC_IRYSp4auq7hKLvziWVH6w', 'Pixar',                       'pixar',          true),
  ('UCQIRM93QxhQ4pGm0cxuCXDw', 'MAX',                         'max',            true),
  ('UC5nxowxAM0i2DaHkwLF919g', 'Netflix Geeked',              'netflix-geeked', true),
  ('UC1Myj674wRVXB9I4c6Hm5zA', 'Apple TV',                    'apple-tv',       true),
  ('UCPgMAS8woHJ_o_OZdTR7kcQ', 'Peacock',                     'peacock',        true),
  ('UC6pGDc4bFGD1_36IKv3FnYg', 'Crunchyroll',                 'crunchyroll',    true),
  ('UCvZHe-SP3xC7DdOk4Ri8QBw', 'Bethesda Softworks',          'bethesda',       true),
  ('UC0KU8F9jJqSLS11LRXvFWmg', 'Ubisoft',                     'ubisoft',        true),
  ('UCqly9F4Fr_jf2Y1Cy5hacRg', 'Bandai Namco Entertainment',  'bandai-namco',   true),
  ('UCJEGvSZnQ1pkVfHO8s5G8hA', 'Riot Games',                  'riot-games',     true),
  ('UC3GriadTkHBnfgd2UFETGOA', 'Blizzard Entertainment',      'blizzard',       true)
on conflict (id) do nothing;
