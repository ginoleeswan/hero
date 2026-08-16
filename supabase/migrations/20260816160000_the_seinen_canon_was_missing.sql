-- Four franchises the catalogue simply did not have.
--
-- Found by asking why the "In Cinemas & Streaming" rail was thin, and auditing
-- what the release slate contains that we cannot render. The shonen canon turned
-- out to be well covered — One Piece, Naruto, Dragon Ball, Jujutsu Kaisen, Demon
-- Slayer, Attack on Titan, Death Note, Fullmetal Alchemist and Cowboy Bebop all
-- have characters. The gap was one tier over: the seinen and classic-anime
-- properties that an encyclopedia of characters cannot credibly omit.
--
--   Ghost in the Shell   no Motoko Kusanagi, no Batou, no Togusa
--   Akira                no Kaneda, no Tetsuo
--   Neon Genesis Evangelion   no Shinji, Rei or Asuka
--   Sailor Moon          nothing at all
--
-- Sailor Moon is the starkest: one of the highest-selling manga ever published
-- and the work that defined a genre, with zero rows.
--
-- ── on enwiki_title, which is the part that needed research ────────────────
--
-- Every title below was checked against the MediaWiki API for redirects before
-- being written, because a redirect is precisely the poison this codebase spent
-- a long day removing: Wikimedia serves a redirect almost no direct pageviews,
-- so a character pointed at one gets a collapsed baseline and the readership
-- pipeline reports them at 500x their "normal" week. Six of the titles a
-- reasonable person would guess are redirects:
--
--   Usagi Tsukino  -> Sailor Moon (character)     Ami Mizuno  -> Sailor Mercury
--   Rei Hino       -> Sailor Mars                 Makoto Kino -> Sailor Jupiter
--   Minako Aino    -> Sailor Venus                Tetsuo Shima-> Akira (manga)
--
-- So the Guardians carry their Sailor titles (which is also the name a reader
-- knows them by), and the civilian names go in full_name. Tetsuo has no
-- standalone article at all and gets a NULL enwiki_title rather than a pointer
-- to the manga's page — null means "not tracked", which is true, where the
-- manga's page would mean "this character's readership is the whole series",
-- which is false. Characters whose only article is a list page — Aramaki, Saito,
-- Ishikawa, the Puppet Master, Ritsuko Akagi — are left out entirely rather than
-- added as rows that can never carry a fact.
--
-- ── what these rows deliberately do NOT have ───────────────────────────────
--
-- No portrait_url or image_url. Art is generated separately and by hand, so
-- inventing a URL here would produce 23 broken images; these characters will not
-- appear in any rail that requires art until portraits exist, and they WILL
-- appear in search and browse, which is the honest half. No powerstats either —
-- those are rated, not guessed.
--
-- fame_tier is hand-set on the 0-4 recognizability scale and fame_score is left
-- for recompute_fame_scores() to derive, per the documented flow. Tier 3 for
-- Sailor Moon herself (a genuinely mainstream figure), tier 2 for the leads of
-- the other three, tier 1 for supporting casts.

insert into public.heroes
  (id, name, full_name, publisher, franchise, alignment, gender, summary,
   fame_tier, fame_rated_at, enwiki_title, first_appearance)
values
  -- ── Ghost in the Shell ───────────────────────────────────────────────────
  ('h_3bdf77b4-00e2-4ea6-86d2-b76d595ecbe6', 'Motoko Kusanagi', 'Major Motoko Kusanagi',
   'Kodansha', 'Ghost in the Shell', 'good', 'Female',
   'The Major: a full-body cyborg who commands Public Security Section 9, and who is never quite certain how much of her is still her.',
   2, now(), 'Motoko Kusanagi', 'Ghost in the Shell (1989)'),
  ('h_62300c07-61d9-49ef-b41a-e9b2c75893c5', 'Batou', null,
   'Kodansha', 'Ghost in the Shell', 'good', 'Male',
   'Section 9''s heavy, ex-Rangers, with cybernetic eyes he never turns off and a loyalty to the Major he never states.',
   1, now(), 'Batou', 'Ghost in the Shell (1989)'),
  ('h_b9ebfad8-7395-4a2a-98b9-52ce895191f7', 'Togusa', null,
   'Kodansha', 'Ghost in the Shell', 'good', 'Male',
   'The only member of Section 9 with an almost entirely human body — recruited precisely because he thinks like a detective rather than a machine.',
   1, now(), 'Togusa', 'Ghost in the Shell (1989)'),

  -- ── Akira ────────────────────────────────────────────────────────────────
  ('h_9cdc8c2d-4bc0-4ad5-952d-67d7c1fc2118', 'Shotaro Kaneda', null,
   'Kodansha', 'Akira', 'good', 'Male',
   'Leader of a Neo-Tokyo bike gang, and the one person still willing to treat Tetsuo as a friend rather than a weapon.',
   2, now(), 'Shotaro Kaneda', 'Akira #1 (1982)'),
  -- No standalone article; see the note above on why that means NULL rather
  -- than a pointer at the manga's page.
  ('h_adfbe727-dd3c-475d-b7fe-fd73c2597676', 'Tetsuo Shima', null,
   'Kodansha', 'Akira', 'bad', 'Male',
   'The smallest of Kaneda''s gang until an army experiment gives him power without limit, and no idea where to put it.',
   2, now(), null, 'Akira #1 (1982)'),

  -- ── Neon Genesis Evangelion ──────────────────────────────────────────────
  ('h_0ec3321c-9844-46e3-9a12-3baad2bad411', 'Shinji Ikari', null,
   'Khara', 'Neon Genesis Evangelion', 'good', 'Male',
   'Summoned by the father who abandoned him to pilot a machine he does not understand against enemies nobody can explain.',
   2, now(), 'Shinji Ikari', 'Neon Genesis Evangelion (1995)'),
  ('h_69e4d175-8614-4a4b-a2f2-4a3170544f5e', 'Rei Ayanami', null,
   'Khara', 'Neon Genesis Evangelion', 'good', 'Female',
   'The First Child: quiet, incurious about her own origins, and the piece of NERV''s design that its commander will not discuss.',
   2, now(), 'Rei Ayanami', 'Neon Genesis Evangelion (1995)'),
  ('h_f5858638-55f7-41e3-b83b-373f96d9dbff', 'Asuka Langley Soryu', null,
   'Khara', 'Neon Genesis Evangelion', 'good', 'Female',
   'A pilot since childhood and proud of it, defending a self-worth built entirely on being the best at the one thing she has.',
   2, now(), 'Asuka Langley Soryu', 'Neon Genesis Evangelion (1995)'),
  ('h_0cebc530-5035-49c4-8fd1-3bd39c704be6', 'Misato Katsuragi', null,
   'Khara', 'Neon Genesis Evangelion', 'good', 'Female',
   'NERV''s operations director, guardian to two of its pilots, and a survivor of the event she now spends her life answering.',
   1, now(), 'Misato Katsuragi', 'Neon Genesis Evangelion (1995)'),
  ('h_4e3d3e5d-8bf9-4d06-a745-0f30073227a3', 'Gendo Ikari', null,
   'Khara', 'Neon Genesis Evangelion', 'bad', 'Male',
   'Commander of NERV, and a father who summoned his son back only because the machine would not accept anyone else.',
   1, now(), 'Gendo Ikari', 'Neon Genesis Evangelion (1995)'),
  ('h_c4ebbb17-58e9-4405-b16d-6557c99bd1bc', 'Kaworu Nagisa', null,
   'Khara', 'Neon Genesis Evangelion', 'neutral', 'Male',
   'The Fifth Child, who offers Shinji unconditional kindness and is the last thing in the series to do so.',
   1, now(), 'Kaworu Nagisa', 'Neon Genesis Evangelion (1995)'),
  ('h_7378ca06-3da9-419c-99dd-e11f74ecbde8', 'Mari Illustrious Makinami', null,
   'Khara', 'Neon Genesis Evangelion', 'good', 'Female',
   'A pilot introduced only in the Rebuild films, and the first one in the story who seems to enjoy the job.',
   1, now(), 'Mari Illustrious Makinami', 'Evangelion 2.0 (2009)'),

  -- ── Sailor Moon ──────────────────────────────────────────────────────────
  -- The Guardians carry their Sailor names: it is what the Wikipedia article is
  -- called, and what a reader calls them. Civilian names go in full_name.
  ('h_18ea9fef-e89d-405d-bf1d-5f86ac76e5a7', 'Sailor Moon', 'Usagi Tsukino',
   'Kodansha', 'Sailor Moon', 'good', 'Female',
   'A crybaby fourteen-year-old handed a locket, a talking cat and the defence of the solar system, in roughly that order.',
   3, now(), 'Sailor Moon (character)', 'Codename: Sailor V / Sailor Moon (1991)'),
  ('h_7e2e434c-641c-4f83-9854-79f1da1b5b88', 'Sailor Mercury', 'Ami Mizuno',
   'Kodansha', 'Sailor Moon', 'good', 'Female',
   'The scholar of the group, who fights with water and a visor and would rather be studying.',
   1, now(), 'Sailor Mercury', 'Sailor Moon (1991)'),
  ('h_88e22f29-13d3-430d-ab56-3fd2eff35216', 'Sailor Mars', 'Rei Hino',
   'Kodansha', 'Sailor Moon', 'good', 'Female',
   'A shrine maiden with real premonitions and no patience, and the only one who argues with Usagi as an equal.',
   1, now(), 'Sailor Mars', 'Sailor Moon (1991)'),
  ('h_7d0f4929-8cd3-46d5-9db7-f6e63af3f5d1', 'Sailor Jupiter', 'Makoto Kino',
   'Kodansha', 'Sailor Moon', 'good', 'Female',
   'The tallest and strongest of the Guardians, who cooks, gardens, and is rumoured to have been expelled for fighting.',
   1, now(), 'Sailor Jupiter', 'Sailor Moon (1991)'),
  ('h_5435e896-c066-4b8e-898d-37ff4de9330f', 'Sailor Venus', 'Minako Aino',
   'Kodansha', 'Sailor Moon', 'good', 'Female',
   'The first of them to transform — a year ahead of the others, in her own series — and the team''s appointed leader.',
   1, now(), 'Sailor Venus', 'Codename: Sailor V (1991)'),
  ('h_e90050fa-c20b-44ba-9715-507a181291c4', 'Sailor Saturn', 'Hotaru Tomoe',
   'Kodansha', 'Sailor Moon', 'neutral', 'Female',
   'The Guardian of ruin, whose power is to end a world so that it can begin again — which is why the others fear her arrival.',
   1, now(), 'Sailor Saturn', 'Sailor Moon (1993)'),
  ('h_ebc14310-6871-42c7-bb2f-64c95694a912', 'Sailor Uranus', 'Haruka Tenoh',
   'Kodansha', 'Sailor Moon', 'good', 'Female',
   'A racing driver who fights with a blade and refuses the inner Guardians'' gentler arithmetic about acceptable losses.',
   1, now(), 'Sailor Uranus', 'Sailor Moon (1993)'),
  ('h_b0842b0d-70f8-4be7-9b05-fdbda42a9358', 'Sailor Neptune', 'Michiru Kaioh',
   'Kodansha', 'Sailor Moon', 'good', 'Female',
   'A concert violinist and painter, and Haruka''s partner in every sense the story allows.',
   1, now(), 'Sailor Neptune', 'Sailor Moon (1993)'),
  ('h_be479b0f-a814-4f67-a162-c4f28aed4c8d', 'Sailor Pluto', 'Setsuna Meioh',
   'Kodansha', 'Sailor Moon', 'good', 'Female',
   'Keeper of the Gate of Time, alone at her post for longer than anyone asks about, forbidden to stop time and willing to anyway.',
   1, now(), 'Sailor Pluto', 'Sailor Moon (1991)'),
  ('h_2bf45710-298c-4e9e-9ac0-58813300d8e4', 'Tuxedo Mask', 'Mamoru Chiba',
   'Kodansha', 'Sailor Moon', 'good', 'Male',
   'Arrives in evening dress, throws a rose, says something encouraging, and leaves the actual fighting to the Guardians.',
   2, now(), 'Tuxedo Mask', 'Sailor Moon (1991)'),
  ('h_3987d087-719c-402b-92fb-75106ccbe46f', 'Chibiusa', 'Usagi Small Lady Serenity',
   'Kodansha', 'Sailor Moon', 'good', 'Female',
   'Usagi and Mamoru''s daughter from the thirtieth century, who arrives by falling out of the sky and demanding the Silver Crystal.',
   1, now(), 'Chibiusa', 'Sailor Moon (1993)')
on conflict (id) do nothing;

-- ── restoring the curated summaries ────────────────────────────────────────
--
-- Visiting one of these pages triggers the ComicVine read-through, which writes
-- `summary` UNCONDITIONALLY from ComicVine's `deck` field. Fourteen of the
-- twenty-three matched, and every one of their teasers was replaced with a flat
-- restatement of the character's name — "Makoto Kino is a Sailor Senshi also
-- known as Sailor Jupiter."
--
-- That is fine for `description`, which is the long-form biography and where
-- ComicVine genuinely adds something we do not have. It is wrong for `summary`,
-- which this codebase defines as a pull-quote teaser: the line under the name on
-- a card, whose whole job is to be worth reading.
--
-- So the curated teasers are re-asserted here, AFTER the insert, keyed by id.
-- Written as its own statement rather than folded into the insert so that
-- replaying this migration repairs the rows even when they already exist — which
-- is exactly the case if an enrichment has flattened them again.
--
-- ComicVine's description, publisher corrections, image_url, issue_count and
-- creators are all left exactly as it wrote them. This reclaims one field.

update public.heroes h
set summary = v.summary
from (values
  ('h_3bdf77b4-00e2-4ea6-86d2-b76d595ecbe6', 'The Major: a full-body cyborg who commands Public Security Section 9, and who is never quite certain how much of her is still her.'),
  ('h_62300c07-61d9-49ef-b41a-e9b2c75893c5', 'Section 9''s heavy, ex-Rangers, with cybernetic eyes he never turns off and a loyalty to the Major he never states.'),
  ('h_b9ebfad8-7395-4a2a-98b9-52ce895191f7', 'The only member of Section 9 with an almost entirely human body — recruited precisely because he thinks like a detective rather than a machine.'),
  ('h_9cdc8c2d-4bc0-4ad5-952d-67d7c1fc2118', 'Leader of a Neo-Tokyo bike gang, and the one person still willing to treat Tetsuo as a friend rather than a weapon.'),
  ('h_adfbe727-dd3c-475d-b7fe-fd73c2597676', 'The smallest of Kaneda''s gang until an army experiment gives him power without limit, and no idea where to put it.'),
  ('h_0ec3321c-9844-46e3-9a12-3baad2bad411', 'Summoned by the father who abandoned him to pilot a machine he does not understand against enemies nobody can explain.'),
  ('h_69e4d175-8614-4a4b-a2f2-4a3170544f5e', 'The First Child: quiet, incurious about her own origins, and the piece of NERV''s design that its commander will not discuss.'),
  ('h_f5858638-55f7-41e3-b83b-373f96d9dbff', 'A pilot since childhood and proud of it, defending a self-worth built entirely on being the best at the one thing she has.'),
  ('h_0cebc530-5035-49c4-8fd1-3bd39c704be6', 'NERV''s operations director, guardian to two of its pilots, and a survivor of the event she now spends her life answering.'),
  ('h_4e3d3e5d-8bf9-4d06-a745-0f30073227a3', 'Commander of NERV, and a father who summoned his son back only because the machine would not accept anyone else.'),
  ('h_c4ebbb17-58e9-4405-b16d-6557c99bd1bc', 'The Fifth Child, who offers Shinji unconditional kindness and is the last thing in the series to do so.'),
  ('h_7378ca06-3da9-419c-99dd-e11f74ecbde8', 'A pilot introduced only in the Rebuild films, and the first one in the story who seems to enjoy the job.'),
  ('h_18ea9fef-e89d-405d-bf1d-5f86ac76e5a7', 'A crybaby fourteen-year-old handed a locket, a talking cat and the defence of the solar system, in roughly that order.'),
  ('h_7e2e434c-641c-4f83-9854-79f1da1b5b88', 'The scholar of the group, who fights with water and a visor and would rather be studying.'),
  ('h_88e22f29-13d3-430d-ab56-3fd2eff35216', 'A shrine maiden with real premonitions and no patience, and the only one who argues with Usagi as an equal.'),
  ('h_7d0f4929-8cd3-46d5-9db7-f6e63af3f5d1', 'The tallest and strongest of the Guardians, who cooks, gardens, and is rumoured to have been expelled for fighting.'),
  ('h_5435e896-c066-4b8e-898d-37ff4de9330f', 'The first of them to transform — a year ahead of the others, in her own series — and the team''s appointed leader.'),
  ('h_e90050fa-c20b-44ba-9715-507a181291c4', 'The Guardian of ruin, whose power is to end a world so that it can begin again — which is why the others fear her arrival.'),
  ('h_ebc14310-6871-42c7-bb2f-64c95694a912', 'A racing driver who fights with a blade and refuses the inner Guardians'' gentler arithmetic about acceptable losses.'),
  ('h_b0842b0d-70f8-4be7-9b05-fdbda42a9358', 'A concert violinist and painter, and Haruka''s partner in every sense the story allows.'),
  ('h_be479b0f-a814-4f67-a162-c4f28aed4c8d', 'Keeper of the Gate of Time, alone at her post for longer than anyone asks about, forbidden to stop time and willing to anyway.'),
  ('h_2bf45710-298c-4e9e-9ac0-58813300d8e4', 'Arrives in evening dress, throws a rose, says something encouraging, and leaves the actual fighting to the Guardians.'),
  ('h_3987d087-719c-402b-92fb-75106ccbe46f', 'Usagi and Mamoru''s daughter from the thirtieth century, who arrives by falling out of the sky and demanding the Silver Crystal.')
) as v(id, summary)
where h.id = v.id;
