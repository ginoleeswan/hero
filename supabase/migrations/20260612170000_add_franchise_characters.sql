-- Add 22 high-demand franchise characters missing from the DB.
-- Rows are inserted with comicvine_id set and enriched_at NULL so the
-- ComicVine enrichment pipeline fills the remaining fields on first view.
--
-- Franchises: The Boys, Invincible, My Hero Academia, Demon Slayer,
--             One Piece, Attack on Titan, The Witcher, God of War

insert into heroes (id, name, publisher, comicvine_id, category)
values
  -- The Boys (Dynamite Entertainment / DC Wildstorm)
  ('cv-51106', 'Homelander',    'Dynamite Entertainment', 51106, 'popular'),
  ('cv-40553', 'Billy Butcher', 'Dynamite Entertainment', 40553, 'popular'),
  ('cv-51100', 'Starlight',     'Dynamite Entertainment', 51100, 'popular'),
  ('cv-51107', 'Queen Maeve',   'Dynamite Entertainment', 51107, null),
  ('cv-51103', 'A-Train',       'Dynamite Entertainment', 51103, null),
  ('cv-51105', 'The Deep',      'Dynamite Entertainment', 51105, null),
  ('cv-40552', 'Mother''s Milk','Dynamite Entertainment', 40552, null),
  ('cv-51109', 'Black Noir',    'Dynamite Entertainment', 51109, null),
  ('cv-59641', 'Soldier Boy',   'Dynamite Entertainment', 59641, null),

  -- Invincible (Image Comics)
  ('cv-5210',  'Invincible',    'Image Comics',           5210,  'popular'),
  ('cv-40550', 'Omni-Man',      'Image Comics',           40550, 'popular'),
  ('cv-40947', 'Atom Eve',      'Image Comics',           40947, null),
  ('cv-42576', 'Cecil Stedman', 'Image Comics',           42576, null),

  -- My Hero Academia (Shueisha)
  ('cv-114074','Izuku Midoriya','Shueisha',               114074,'popular'),
  ('cv-119564','All Might',     'Shueisha',               119564,'popular'),
  ('cv-119837','Katsuki Bakugo','Shueisha',               119837, null),

  -- Demon Slayer (Shueisha)
  ('cv-126533','Tanjiro Kamado','Shueisha',               126533,'popular'),

  -- One Piece (Shueisha)
  ('cv-47924', 'Monkey D. Luffy','Shueisha',              47924, 'popular'),
  ('cv-47925', 'Roronoa Zoro',   'Shueisha',              47925, null),

  -- Attack on Titan (Kodansha)  — we already have Levi
  ('cv-94030', 'Eren Yeager',   'Kodansha',               94030, 'popular'),
  ('cv-94029', 'Mikasa Ackerman','Kodansha',              94029, null),

  -- The Witcher (CD Projekt RED / Andrzej Sapkowski)
  ('cv-49020', 'Geralt of Rivia','Company-Licensed',      49020, 'popular'),

  -- God of War (Sony Interactive Entertainment)
  ('cv-67170', 'Kratos',        'Company-Licensed',       67170, 'popular')
on conflict (id) do nothing;
