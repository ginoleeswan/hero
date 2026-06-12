-- Hand-curated powerstats for the 116 enriched heroes that still had null stats
-- (the new franchise characters + a tail of obscure rows). Assigned on the app's
-- 0-100 scale (avg human str~10, peak human str~30, street-level ~55, cosmic ~100),
-- replacing the Gemini auto-stats path. stats_source = 'curated', ai_stats_status
-- = 'done' so the generator skips them. stats_source = 'ai' (the schema's check
-- constraint only allows 'superheroapi' | 'ai'; these are model-assigned stats).

update heroes h set
  intelligence = v.i, strength = v.s, speed = v.sp,
  durability = v.d, power = v.p, combat = v.c,
  stats_source = 'ai', ai_stats_status = 'done'
from (values
  -- The Boys
  ('cv-51106',60,95,85,95,88,75),  -- Homelander
  ('cv-40553',70,40,40,45,30,82),  -- Billy Butcher
  ('cv-51100',60,80,75,78,82,65),  -- Starlight
  ('cv-51107',55,85,70,85,60,80),  -- Queen Maeve
  ('cv-51103',45,45,98,50,55,50),  -- A-Train
  ('cv-51105',50,60,55,60,50,45),  -- The Deep
  ('cv-40552',70,45,40,50,20,78),  -- Mother's Milk
  ('cv-51109',65,82,75,80,60,92),  -- Black Noir
  ('cv-59641',50,88,65,88,80,82),  -- Soldier Boy
  ('cv-59640',60,80,75,80,88,70),  -- Stormfront
  ('cv-40555',65,20,25,25,10,30),  -- Hughie Campbell
  -- Invincible
  ('cv-5210',70,90,85,90,82,80),   -- Invincible
  ('cv-40550',75,98,90,98,90,92),  -- Omni-Man
  ('cv-72505',80,100,92,100,95,98),-- Thragg
  ('cv-61561',75,98,88,98,90,95),  -- Conquest
  ('cv-41126',50,95,75,92,70,95),  -- Battle Beast
  ('cv-40947',75,75,70,80,95,70),  -- Atom Eve
  ('cv-42576',85,20,30,30,40,50),  -- Cecil Stedman
  -- Dragon Ball
  ('cv-40743',65,98,98,95,98,92),  -- Gohan
  ('cv-40737',85,95,95,92,98,90),  -- Frieza
  ('cv-41116',40,98,90,100,98,85), -- Majin Buu
  ('cv-87138',35,100,95,98,100,88),-- Broly
  -- Naruto
  ('cv-44241',80,65,88,70,92,90),  -- Sasuke Uchiha
  ('cv-44260',90,60,85,65,90,92),  -- Itachi Uchiha
  ('cv-44243',88,60,82,65,82,90),  -- Kakashi Hatake
  -- One Piece / Bleach / HxH / OPM / MHA / Demon Slayer / JJK / JoJo
  ('cv-47924',60,88,85,88,90,90),  -- Monkey D. Luffy
  ('cv-47925',60,85,82,85,82,92),  -- Roronoa Zoro
  ('cv-42468',65,80,90,80,92,88),  -- Ichigo Kurosaki
  ('cv-68163',65,78,80,75,80,82),  -- Gon Freecss
  ('cv-68164',82,70,92,70,82,90),  -- Killua Zoldyck
  ('cv-93547',55,100,100,100,100,100), -- Saitama
  ('cv-114074',75,85,85,75,88,82), -- Izuku Midoriya
  ('cv-119564',70,98,90,90,95,92), -- All Might
  ('cv-119837',78,75,82,72,85,85), -- Katsuki Bakugo
  ('cv-126533',70,65,80,70,72,85), -- Tanjiro Kamado
  ('cv-164910',92,75,90,88,98,92), -- Satoru Gojo
  ('cv-159532',60,85,85,82,80,85), -- Yuji Itadori
  ('cv-120011',80,80,95,80,88,90), -- Jotaro Kujo
  -- Death Note / FMA / AoT / Slime / Berserk / Spy x Family
  ('cv-48703',100,10,12,15,70,20), -- Light Yagami
  ('cv-45359',90,55,65,60,78,78),  -- Edward Elric
  ('cv-94030',70,90,65,88,88,80),  -- Eren Yeager
  ('cv-94029',78,70,80,68,50,92),  -- Mikasa Ackerman
  ('cv-141927',92,90,90,95,98,88), -- Rimuru Tempest
  ('cv-45527',70,88,78,85,60,98),  -- Guts
  ('cv-175957',60,8,25,15,55,20),  -- Anya Forger
  -- Star Wars
  ('cv-55028',78,50,70,65,82,90),  -- Ahsoka Tano
  ('cv-162251',70,50,55,70,40,85), -- Din Djarin
  ('cv-165877',60,15,30,30,80,20), -- Grogu
  -- Walking Dead
  ('cv-42443',72,45,45,50,15,80),  -- Rick Grimes
  ('cv-42540',60,35,45,40,10,65),  -- Carl Grimes
  ('cv-46819',65,50,55,55,15,88),  -- Michonne
  -- Video games
  ('cv-45343',55,45,100,55,60,65), -- Sonic
  ('cv-50037',70,65,70,72,80,78),  -- Mega Man
  ('cv-46651',80,75,70,82,88,88),  -- Samus Aran
  ('cv-42683',65,70,72,75,78,95),  -- Ryu
  ('cv-42244',65,65,70,70,80,90),  -- Sub-Zero
  ('cv-40491',80,45,55,55,30,80),  -- Lara Croft
  ('cv-45828',85,50,55,60,35,92),  -- Solid Snake
  ('cv-33857',35,55,65,60,50,60),  -- Crash Bandicoot
  ('cv-44471',60,70,75,72,85,82),  -- Sora
  ('cv-52213',40,35,75,45,75,60),  -- Pikachu
  ('cv-52626',45,70,75,70,82,75),  -- Charizard
  ('cv-46231',80,30,50,50,85,55),  -- Princess Zelda
  ('cv-55484',50,50,55,55,45,50),  -- Luigi
  ('cv-49020',78,65,72,75,70,95),  -- Geralt of Rivia
  ('cv-67170',70,98,80,95,92,98),  -- Kratos
  -- Horror icons
  ('cv-41460',75,60,65,80,90,70),  -- Freddy Krueger
  ('cv-41459',25,85,45,92,40,75),  -- Jason Voorhees
  ('cv-46825',40,75,45,85,35,72),  -- Michael Myers
  ('cv-51515',60,35,45,55,50,60),  -- Chucky
  ('cv-41465',80,65,55,80,88,65),  -- Pinhead
  ('cv-160011',85,90,80,95,98,75), -- Pennywise
  ('cv-61046',45,75,80,70,50,85),  -- Xenomorph
  ('cv-13852',70,88,60,90,60,88),  -- Terminator
  ('cv-28671',75,80,55,88,65,85),  -- RoboCop
  -- Toy lines / TMNT
  ('cv-6467',80,90,65,88,82,88),   -- Optimus Prime
  ('cv-16423',55,95,70,85,70,88),  -- He-Man
  ('cv-16424',85,65,65,70,90,80),  -- Skeletor
  ('cv-6452',75,60,70,65,30,98),   -- Snake Eyes
  ('cv-11034',80,40,45,50,40,60),  -- Cobra Commander
  ('cv-39812',80,55,65,60,40,90),  -- Splinter
  -- Vertigo / DC dark / Saga / Top Cow
  ('cv-11171',95,50,70,90,100,40), -- Dream of the Endless
  ('cv-24232',95,90,85,95,100,85), -- Lucifer Morningstar
  ('cv-83012',70,45,55,50,35,70),  -- Alana
  ('cv-83011',72,55,60,58,65,85),  -- Marko
  ('cv-18319',65,75,70,80,85,80),  -- Witchblade
  ('cv-195090',70,80,70,82,92,80), -- The Darkness
  ('cv-46763',60,40,45,50,25,70),  -- Tank Girl
  -- Obscure tail (modest, tier-appropriate)
  ('cv-1766',60,70,55,75,50,55),   -- Adam The Android
  ('cv-4814',65,40,50,50,70,60),   -- Andrea von Strucker
  ('cv-1384',50,40,45,45,50,45),   -- Ashira
  ('cv-1767',70,75,60,75,85,65),   -- Beezlebub
  ('cv-4978',50,10,12,15,5,15),    -- Bernard Chang
  ('cv-2466',60,25,25,30,10,45),   -- Carmine Villanova
  ('cv-2993',60,75,70,75,85,65),   -- Catequil
  ('cv-4227',55,45,45,45,20,55),   -- Dagonet
  ('cv-2393',55,40,45,45,40,50),   -- Dan DeWinter
  ('cv-3932',50,10,12,15,5,15),    -- Erika Eleniak
  ('cv-2574',50,35,40,40,25,45),   -- Francis Delbert
  ('cv-3459',65,35,35,40,15,65),   -- Glenn Talbot
  ('cv-3103',55,40,45,45,45,50),   -- Hannah von Helm
  ('cv-3856',50,30,35,35,15,40),   -- Marion Young
  ('cv-4730',55,55,55,55,55,55),   -- Medallion
  ('cv-1571',55,40,50,45,60,50),   -- Metria
  ('cv-3814',55,45,45,45,40,50),   -- Michael Max
  ('cv-3141',45,25,35,30,10,30),   -- Milou
  ('cv-4380',55,60,45,55,40,60),   -- Olaf Smigurd
  ('cv-3836',75,70,65,75,88,65),   -- Parvati
  ('cv-4104',50,85,60,85,75,70),   -- Raydeen
  ('cv-1892',40,30,35,35,20,30),   -- Rickykorbgoll
  ('cv-4985',50,70,55,65,55,60),   -- Skarrzz
  ('cv-2449',60,40,40,45,30,55),   -- The Baron
  ('cv-4726',50,65,55,60,30,75),   -- The Boxer
  ('cv-4842',55,45,50,50,60,50),   -- Tremolo
  ('cv-2281',50,10,12,15,5,15),    -- Victoria Principal
  ('cv-1904',50,40,45,45,45,45)    -- Vurdah
) as v(id,i,s,sp,d,p,c)
where h.id = v.id;
