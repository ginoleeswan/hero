-- Add 67 high-demand franchise characters missing from the DB (wave 2).
-- Rows are inserted with comicvine_id set and enriched_at NULL so the
-- ComicVine enrichment pipeline fills the remaining fields on first view.
-- IDs were resolved against the ComicVine API and disambiguated by
-- publisher + issue-appearance count.

insert into heroes (id, name, publisher, comicvine_id, category)
values
  -- Star Wars (current canon)
  ('cv-55028',  'Ahsoka Tano',     'Marvel Comics',          55028,  'popular'),
  ('cv-162251', 'Din Djarin',      'Marvel Comics',          162251, 'popular'),
  ('cv-165877', 'Grogu',           'Marvel Comics',          165877, 'popular'),

  -- The Walking Dead (Image / Skybound)
  ('cv-42443',  'Rick Grimes',     'Image Comics',           42443,  'popular'),
  ('cv-84617',  'Negan',           'Image Comics',           84617,  'popular'),
  ('cv-46819',  'Michonne',        'Image Comics',           46819,  null),
  ('cv-42540',  'Carl Grimes',     'Image Comics',           42540,  null),

  -- Teenage Mutant Ninja Turtles
  ('cv-39812',  'Splinter',        'IDW Publishing',         39812,  null),

  -- Naruto (Shueisha)
  ('cv-44241',  'Sasuke Uchiha',   'Shueisha',               44241,  'popular'),
  ('cv-44260',  'Itachi Uchiha',   'Shueisha',               44260,  null),
  ('cv-44243',  'Kakashi Hatake',  'Shueisha',               44243,  'popular'),

  -- Dragon Ball (Shueisha)
  ('cv-40743',  'Gohan',           'Shueisha',               40743,  'popular'),
  ('cv-40737',  'Frieza',          'Shueisha',               40737,  'popular'),
  ('cv-41116',  'Majin Buu',       'Shueisha',               41116,  null),
  ('cv-87138',  'Broly',           'Shueisha',               87138,  null),

  -- Bleach / Death Note / FMA / Hunter x Hunter / One Punch Man / JoJo / JJK / Demon-adjacent
  ('cv-42468',  'Ichigo Kurosaki', 'Shueisha',               42468,  'popular'),
  ('cv-48703',  'Light Yagami',    'Shueisha',               48703,  'popular'),
  ('cv-45359',  'Edward Elric',    'Square Enix',            45359,  'popular'),
  ('cv-68163',  'Gon Freecss',     'Shueisha',               68163,  'popular'),
  ('cv-68164',  'Killua Zoldyck',  'Shueisha',               68164,  null),
  ('cv-93547',  'Saitama',         'Shueisha',               93547,  'popular'),
  ('cv-120011', 'Jotaro Kujo',     'Shueisha',               120011, 'popular'),
  ('cv-102819', 'Dio Brando',      'Shueisha',               102819, null),
  ('cv-159532', 'Yuji Itadori',    'Shueisha',               159532, 'popular'),
  ('cv-164910', 'Satoru Gojo',     'Shueisha',               164910, 'popular'),

  -- Spy x Family / Vinland Saga / Slime
  ('cv-175957', 'Anya Forger',     'Shueisha',               175957, 'popular'),
  ('cv-164246', 'Thorfinn',        'Kodansha',               164246, null),
  ('cv-141927', 'Rimuru Tempest',  'Kodansha',               141927, 'popular'),

  -- Berserk
  ('cv-45527',  'Guts',            'Hakusensha',             45527,  'popular'),

  -- Video games
  ('cv-55484',  'Luigi',           'Nintendo',               55484,  null),
  ('cv-46231',  'Princess Zelda',  'Nintendo',               46231,  'popular'),
  ('cv-45343',  'Sonic',           'Sega',                   45343,  'popular'),
  ('cv-40491',  'Lara Croft',      'Eidos',                  40491,  'popular'),
  ('cv-45828',  'Solid Snake',     'Konami',                 45828,  'popular'),
  ('cv-52213',  'Pikachu',         'Nintendo',               52213,  'popular'),
  ('cv-52626',  'Charizard',       'Nintendo',               52626,  null),
  ('cv-46651',  'Samus Aran',      'Nintendo',               46651,  'popular'),
  ('cv-50037',  'Mega Man',        'Capcom',                 50037,  'popular'),
  ('cv-42683',  'Ryu',             'Capcom',                 42683,  'popular'),
  ('cv-42244',  'Sub-Zero',        'Midway',                 42244,  'popular'),
  ('cv-33857',  'Crash Bandicoot', 'Sony',                   33857,  null),
  ('cv-44471',  'Sora',            'Square Enix',            44471,  'popular'),

  -- Horror / movie icons
  ('cv-13852',  'Terminator',      'Dark Horse Comics',      13852,  'popular'),
  ('cv-28671',  'RoboCop',         'Dark Horse Comics',      28671,  'popular'),
  ('cv-61046',  'Xenomorph',       'Dark Horse Comics',      61046,  'popular'),
  ('cv-41460',  'Freddy Krueger',  'Wildstorm',              41460,  'popular'),
  ('cv-41459',  'Jason Voorhees',  'Wildstorm',              41459,  'popular'),
  ('cv-46825',  'Michael Myers',   'Image Comics',           46825,  null),
  ('cv-51515',  'Chucky',          'Devil''s Due',           51515,  null),
  ('cv-160011', 'Pennywise',       'Marvel Comics',          160011, null),
  ('cv-41465',  'Pinhead',         'Boom! Studios',          41465,  'popular'),

  -- Vertigo / DC dark
  ('cv-11171',  'Dream of the Endless', 'DC Comics',         11171,  'popular'),
  ('cv-24232',  'Lucifer Morningstar',  'DC Comics',         24232,  'popular'),

  -- Saga (Image)
  ('cv-83012',  'Alana',           'Image Comics',           83012,  null),
  ('cv-83011',  'Marko',           'Image Comics',           83011,  null),

  -- Top Cow / indie
  ('cv-18319',  'Witchblade',      'Top Cow Productions',    18319,  'popular'),
  ('cv-195090', 'The Darkness',    'Top Cow Productions',    195090, null),
  ('cv-46763',  'Tank Girl',       'Dark Horse Comics',      46763,  null),

  -- Transformers / He-Man / G.I. Joe
  ('cv-6467',   'Optimus Prime',   'Hasbro',                 6467,   'popular'),
  ('cv-16423',  'He-Man',          'Mattel',                 16423,  'popular'),
  ('cv-16424',  'Skeletor',        'Mattel',                 16424,  'popular'),
  ('cv-6452',   'Snake Eyes',      'Hasbro',                 6452,   'popular'),
  ('cv-11034',  'Cobra Commander', 'Hasbro',                 11034,  null),

  -- The Boys (remaining)
  ('cv-40555',  'Hughie Campbell', 'Dynamite Entertainment', 40555,  'popular'),
  ('cv-59640',  'Stormfront',      'Dynamite Entertainment', 59640,  null),

  -- Invincible (remaining)
  ('cv-41126',  'Battle Beast',    'Image Comics',           41126,  null),
  ('cv-61561',  'Conquest',        'Image Comics',           61561,  null),
  ('cv-72505',  'Thragg',          'Image Comics',           72505,  null)
on conflict (id) do nothing;
