-- Promote the ASOIAF marquee cast: powerstats, alignment, fame tier, teaser.
--
-- The reclaim migration put 240 characters into the right universe but they
-- arrived from ComicVine with no powerstats at all, which means they cannot
-- enter the Arena, have no power_rating, and sort below genuinely obscure
-- characters everywhere fame_score is the ordering key.
--
-- Three parts:
--   1. Fix the summary/description slot mix-up.
--   2. Curate the marquee cast (stats + alignment + fame tier + teaser).
--   3. Re-tier the main cast, which was auto-rated far too low.

-- ── 1. summary vs description ────────────────────────────────────────────
-- summary is the short teaser PullQuoteBio renders; description is the
-- long-form HTML biography behind /biography/[id]. The characters added in
-- 20260726121000 put their two-sentence prose in description, which would have
-- shown no pull-quote and a "Read biography" link to two sentences. Move it to
-- the slot it belongs in. Only touches rows whose description is plain prose,
-- so the 52 real ComicVine HTML biographies are never at risk.
update public.heroes
set summary = description,
    description = null
where publisher = 'Game of Thrones'
  and description is not null
  and description not like '%<%'
  and (summary is null or summary = 'Character in Game of Thrones.');

-- ── 2. Curated marquee cast ──────────────────────────────────────────────
-- Stats are calibrated against the 31 heroes already carrying curated stats in
-- this universe: an elite unpowered warrior (Brienne) sits at 60/80/60/80/25/90,
-- so `power` stays low for everyone without magic, and dragons/greenseers are
-- where the high `power` values live.
--
-- summary is overwritten for this set. ComicVine's decks are thin ("A cunning
-- and vicious sellsword") and inconsistent in voice; these are the characters
-- most likely to be seen, so they get the app's voice.
--
-- Keyed by name, which is unique inside this universe with one exception:
-- "Daemon Blackfyre" exists twice (two ingests of the same character, from
-- The Mystery Knight and The Hedge Knight: The Graphic Novel). He is
-- deliberately not in this list; that duplicate wants a merge, not a promotion.
update public.heroes h
set intelligence = v.intelligence,
    strength     = v.strength,
    speed        = v.speed,
    durability   = v.durability,
    power        = v.power,
    combat       = v.combat,
    alignment    = v.alignment,
    fame_tier    = v.fame_tier,
    fame_rated_at = now(),
    fame_rated_by = 'claude-curated',
    summary      = v.summary
from (values
  -- Dragons and direwolves. The reason this universe is worth having.
  ('Drogon',            30, 95, 88, 90, 98, 85, 'neutral', 2, 'The black dread of Daenerys Targaryen''s three dragons, largest and least willing to be ruled. He melted the Iron Throne itself rather than let it be inherited.'),
  ('Rhaegal',           30, 88, 85, 85, 92, 80, 'neutral', 1, 'The green-and-bronze dragon named for Daenerys Targaryen''s eldest brother. Shot from the sky over Dragonstone by a scorpion bolt.'),
  ('Viserion',          30, 86, 84, 84, 90, 78, 'neutral', 1, 'The cream-and-gold dragon named for Daenerys Targaryen''s cruel brother. Killed beyond the Wall and raised again by the Night King as a weapon of ice.'),
  ('Ghost',             35, 60, 70, 55, 20, 65, 'good',    2, 'Jon Snow''s albino direwolf, the runt of the litter, found apart from his siblings and silent from birth. He never leaves Jon''s side until Jon sends him north for good.'),
  ('Nymeria',           35, 58, 70, 52, 20, 63, 'neutral', 1, 'Arya Stark''s direwolf, driven away to save her from a queen''s justice and grown wild at the head of an enormous pack. When they meet again, she chooses the wolfswood.'),
  ('Summer',            35, 55, 68, 50, 20, 60, 'good',    1, 'Bran Stark''s direwolf, who tore out the throat of the assassin sent to Bran''s sickbed. He is the first creature Bran ever wargs into.'),
  ('Grey Wind',         35, 62, 72, 55, 20, 66, 'good',    1, 'Robb Stark''s direwolf, who fought at his side through every battle of the war and never lost one. Both died at the Red Wedding.'),
  ('Lady',              30, 45, 60, 42, 15, 40, 'good',    1, 'Sansa Stark''s direwolf, the gentlest of the litter, executed by her own father for a crime another wolf committed. The first Stark death of the war.'),
  ('Shaggydog',         32, 55, 66, 50, 20, 58, 'neutral', 1, 'Rickon Stark''s direwolf, the wildest and blackest of the six, as difficult to hold as the boy he belonged to.'),

  -- North of the Wall and the Night''s Watch
  ('Ygritte',           55, 45, 70, 50, 20, 75, 'good',    2, 'A free folk spearwife and archer who captured Jon Snow, spared him, and taught him how little he knew. Her name is on the arrow-straight line between duty and wanting.'),
  ('Jeor Mormont',      70, 60, 50, 65, 20, 75, 'good',    1, 'The Old Bear, Lord Commander of the Night''s Watch, who gave Jon Snow the Valyrian sword his own son had disgraced. Killed by his own men at Craster''s Keep.'),
  ('Maester Aemon',     90, 10, 10, 20, 15, 10, 'good',    1, 'A blind maester of the Night''s Watch who was born a Targaryen and refused a throne to keep his chain. He counselled Jon Snow on the cost of loving anything in this life.'),
  ('Alliser Thorne',    55, 60, 50, 60, 20, 72, 'bad',     1, 'Master-at-arms at Castle Black, a bitter Targaryen loyalist who despised Jon Snow from the day he arrived. He led the mutiny that put a knife in him.'),
  ('Benjen Stark',      65, 65, 60, 70, 25, 78, 'good',    1, 'First Ranger of the Night''s Watch and Eddard Stark''s younger brother, lost beyond the Wall in the first season and half-dead when he returns.'),
  ('Craster',           45, 50, 35, 50, 15, 45, 'bad',     1, 'A wildling who married his own daughters and gave his sons to the White Walkers in exchange for being left alone.'),
  ('Gilly',             50, 25, 35, 40, 15, 20, 'good',    1, 'One of Craster''s daughter-wives, who escaped him with her newborn son and found in Samwell Tarly the first person to be kind to her.'),

  -- King''s Landing
  ('Margaery Tyrell',   88, 15, 30, 30, 20, 15, 'neutral', 2, 'Three times a queen, who understood before anyone that the crowd outside the Sept mattered more than the court inside it. She was winning right up until the wildfire.'),
  ('Loras Tyrell',      55, 65, 75, 60, 20, 85, 'good',    1, 'The Knight of Flowers, the finest jouster in the Seven Kingdoms and the most beautiful man at court. His love for Renly Baratheon shaped the war for the throne.'),
  ('Renly Baratheon',   60, 55, 55, 55, 20, 60, 'good',    1, 'The youngest Baratheon brother, who claimed a crown he had no right to on the grounds that he would simply be better at it. He was probably correct.'),
  ('Qyburn',            92, 25, 25, 35, 35, 20, 'bad',     2, 'A maester stripped of his chain for experiments the Citadel would not permit, who found in Cersei Lannister a patron with no such scruples. He rebuilt the Mountain into something worse.'),
  ('Pycelle',           70, 15, 15, 25, 15, 10, 'bad',     1, 'Grand Maester of the Seven Kingdoms across four reigns, who played the doddering old man so convincingly that almost everyone believed it.'),
  ('Ilyn Payne',        40, 70, 55, 65, 20, 80, 'bad',     1, 'The King''s Justice, tongueless by order of the Mad King, who swung the greatsword Ice through Eddard Stark''s neck.'),
  ('Meryn Trant',       40, 60, 55, 60, 20, 65, 'bad',     1, 'A Kingsguard knight who beat children on Joffrey Baratheon''s orders and died slowly in a Braavosi brothel with Arya Stark''s name in his ears.'),
  ('Janos Slynt',       45, 40, 35, 45, 15, 40, 'bad',     1, 'Commander of the City Watch, who sold Eddard Stark to the Lannisters and was exiled to the Wall for being too obviously purchasable.'),
  ('Podrick Payne',     50, 45, 50, 50, 15, 45, 'good',    1, 'Tyrion Lannister''s squire, then Brienne of Tarth''s, whose loyalty consistently outran his competence until, in time, it didn''t.'),
  ('Shae',              55, 25, 40, 35, 15, 30, 'neutral', 1, 'A camp follower who became Tyrion Lannister''s lover and, under his father''s roof, testified against him at his trial.'),
  ('Tommen Baratheon',  40, 20, 25, 30, 15, 15, 'good',    1, 'The gentlest of Cersei Lannister''s children, crowned too young and pulled apart between his mother and his faith. He stepped out of a window.'),
  ('Myrcella Baratheon',45, 15, 25, 25, 15, 10, 'good',    1, 'Cersei Lannister''s daughter, shipped to Dorne as a hostage dressed up as a betrothal, and poisoned on the boat home.'),
  ('Lancel Lannister',  45, 45, 50, 45, 15, 45, 'neutral', 1, 'Cersei Lannister''s cousin and lover, who found religion, confessed everything, and died crawling towards a cache of wildfire.'),
  ('Kevan Lannister',   70, 50, 45, 55, 20, 60, 'neutral', 1, 'Tywin Lannister''s younger brother and lifelong second, competent and unambitious, who took the Hand''s chair only when there was no one left to take it.'),

  -- The North and the Riverlands
  ('Roose Bolton',      80, 55, 50, 60, 20, 70, 'bad',     2, 'Lord of the Dreadfort, who spoke so quietly that men leaned in to hear him say the worst things imaginable. He put the knife in Robb Stark''s heart himself.'),
  ('Walder Frey',       70, 15, 15, 25, 15, 20, 'bad',     2, 'Lord of the Crossing, ninety years old and swollen with grievance, who answered a broken marriage promise with the Red Wedding.'),
  ('Rickon Stark',      35, 25, 40, 35, 15, 25, 'good',    1, 'The youngest Stark, barely known even to his own family, kept alive for years only to be released as target practice on a battlefield.'),
  ('Osha',              55, 50, 60, 55, 20, 60, 'good',    1, 'A wildling captured raiding south of the Wall who became the Stark boys'' fiercest protector, and got them out of Winterfell when it burned.'),
  ('Rodrik Cassel',     55, 60, 45, 60, 20, 70, 'good',    1, 'Master-at-arms of Winterfell, who taught three generations of Starks to hold a sword and was beheaded by Theon Greyjoy in the yard he trained them in.'),
  ('Jory Cassel',       50, 55, 55, 55, 20, 65, 'good',    1, 'Captain of the Stark household guard, killed in the street by Jaime Lannister''s men with a dagger through the eye.'),
  ('Luwin',             80, 20, 20, 30, 15, 15, 'good',    1, 'Maester of Winterfell, who raised the Stark children alongside their parents and asked to die beneath the heart tree.'),
  ('Yoren',             55, 55, 50, 60, 20, 65, 'good',    1, 'A recruiter for the Night''s Watch who cut off Arya Stark''s hair and hid her in a column of convicts headed north.'),
  ('Beric Dondarrion',  65, 65, 60, 75, 60, 88, 'good',    2, 'Leader of the Brotherhood Without Banners, killed six times and brought back six times by a god he never asked to serve. He fought with a flaming sword and no idea why he was still here.'),
  ('Meera Reed',        60, 45, 65, 50, 20, 65, 'good',    1, 'A crannogwoman of the Neck who dragged Bran Stark beyond the Wall and back, and lost her brother doing it.'),
  ('Jojen Reed',        75, 20, 30, 25, 55, 15, 'good',    1, 'A greendreamer who saw his own death clearly and walked north to it anyway, because Bran Stark needed to reach the Three-Eyed Raven.'),
  ('Three-Eyed Raven',  95, 10, 10, 25, 90, 10, 'neutral', 2, 'A greenseer rooted into a weirwood beneath the earth, who holds the memory of everything that has ever happened in Westeros. He waited a thousand years for Bran Stark.'),
  ('Hot Pie',           40, 35, 30, 40, 10, 20, 'good',    1, 'A baker''s boy swept up in the war alongside Arya Stark and Gendry, who survived it by being the only one with the sense to stop running and cook.'),
  ('Brynden Tully',     80, 65, 55, 68, 20, 85, 'good',    1, 'The Blackfish, who refused to marry, refused to yield Riverrun, and refused to run from it. He died at the gate rather than leave a siege unfinished.'),
  ('Edmure Tully',      55, 50, 45, 50, 20, 50, 'good',    1, 'Lord of Riverrun, whose wedding was the pretext for the Red Wedding and whose every good instinct arrived one move too late.'),
  ('Hoster Tully',      65, 25, 20, 35, 15, 30, 'neutral', 0, 'Lord of Riverrun and father to Catelyn and Lysa, who spent his last months dying slowly and apologising to a daughter who was not there.'),
  ('Lysa Arryn',        45, 20, 25, 30, 15, 15, 'bad',     1, 'Lady of the Eyrie, who poisoned her own husband at Petyr Baelish''s word and spent years nursing a son far too old for it. He pushed her through the Moon Door.'),
  ('Robert Arryn',      25, 10, 15, 20, 10, 10, 'neutral', 1, 'The sickly Lord of the Vale, indulged into uselessness by his mother, who commanded the largest untouched army in Westeros without ever noticing.'),
  ('Rickard Stark',     60, 55, 45, 55, 20, 55, 'good',    1, 'Lord of Winterfell, burned alive in his own armour by the Mad King while his son strangled himself trying to save him.'),

  -- Essos and the Targaryen past
  ('Barristan Selmy',   75, 72, 68, 70, 25, 95, 'good',    2, 'Barristan the Bold, Lord Commander of the Kingsguard under two kings and the finest blade of his generation. Dismissed for being old, he crossed the sea and served a third.'),
  -- NB: the stored name uses U+2019, not an ASCII apostrophe.
  ('Jaqen H’ghar',      90, 60, 85, 60, 60, 92, 'neutral', 2, 'A Faceless Man of Braavos who owed Arya Stark three deaths and paid every one. He wore whatever face the debt required.'),
  ('Rhaegar Targaryen', 80, 72, 70, 70, 30, 90, 'good',    2, 'The last Targaryen prince, a harpist and a peerless knight, whose choice at Harrenhal started a rebellion and ended a dynasty.'),
  ('Lyanna Stark',      65, 35, 60, 40, 20, 45, 'good',    2, 'Eddard Stark''s sister, whose disappearance was the spark for Robert''s Rebellion and whose deathbed promise Ned kept for seventeen years.'),
  ('Aerys Targaryen',   55, 30, 30, 35, 25, 35, 'bad',     2, 'The Mad King, who filled his own capital with caches of wildfire and gave the order to burn it. Jaime Lannister put a sword in his back to stop him.'),
  ('Elia Martell',      60, 25, 35, 30, 20, 20, 'good',    1, 'Rhaegar Targaryen''s wife, murdered with her children during the Sack of King''s Landing — the debt Oberyn Martell came north to collect.'),
  ('Arthur Dayne',      70, 78, 80, 72, 25, 98, 'good',    2, 'The Sword of the Morning, wielder of the pale blade Dawn, widely held to be the greatest knight who ever lived. It took seven men to bring him down, and only two walked away.'),
  ('Mirri Maz Duur',    70, 25, 30, 35, 70, 20, 'bad',     1, 'A godswife of Lhazar who repaid Daenerys Targaryen''s mercy with a blood ritual that cost her a husband and a son. She had watched her own people burn first.'),
  ('Illyrio Mopatis',   80, 25, 20, 35, 15, 20, 'neutral', 1, 'A magister of Pentos, enormously rich and enormously fat, who sheltered the exiled Targaryens and sold Daenerys to a Dothraki khal for an army.'),
  ('Xaro Xhoan Daxos',  75, 25, 30, 35, 15, 20, 'bad',     1, 'A merchant prince of Qarth whose vault, famously, was empty. He offered Daenerys Targaryen ships and delivered a coup.'),
  ('Quaithe',           85, 20, 35, 30, 75, 20, 'neutral', 1, 'A masked shadowbinder from Asshai who appears to Daenerys Targaryen only to speak in riddles she will understand far too late.'),
  ('Salladhor Saan',    60, 45, 50, 50, 20, 55, 'neutral', 0, 'A Lyseni pirate who lent Stannis Baratheon his fleet on credit and left the moment it stopped looking like a paying proposition.'),

  -- The Iron Islands, Dragonstone and the Reach
  ('Asha Greyjoy',      70, 55, 65, 60, 20, 75, 'good',    2, 'Balon Greyjoy''s daughter and the best captain in the Iron Fleet, who commanded reavers while her father waited for a son. Called Yara in the television series.'),
  ('Balon Greyjoy',     60, 50, 45, 55, 20, 60, 'bad',     1, 'Lord Reaper of Pyke, who rebelled against the Iron Throne twice, lost both times, and never once considered that the fault might be his.'),
  ('Victarion Greyjoy', 45, 85, 60, 85, 25, 85, 'neutral', 1, 'Lord Captain of the Iron Fleet, enormously strong and entirely without imagination, which is exactly what his brother relied on.'),
  ('Aeron Greyjoy',     55, 45, 40, 50, 25, 45, 'neutral', 0, 'The Damphair, a drowned priest who crowns kings on the Iron Islands and answers to no authority above the waterline.'),
  ('Shireen Baratheon', 70, 15, 20, 25, 15, 10, 'good',    1, 'Stannis Baratheon''s daughter, scarred by greyscale and quietly the best-read person on Dragonstone. Her father burned her for a favourable wind.'),
  ('Selyse Baratheon',  45, 15, 20, 25, 15, 10, 'neutral', 0, 'Stannis Baratheon''s wife, more devoted to the Lord of Light than to her own husband and far more than to her daughter.'),
  ('Garlan Tyrell',     65, 70, 65, 68, 20, 82, 'good',    0, 'Margaery Tyrell''s brother, called the Gallant, a better fighter than Loras and content to let no one know it.'),

  -- Dunk & Egg / the Blackfyre era
  ('Ser Duncan',        55, 85, 60, 85, 25, 80, 'good',    1, 'Dunk the Lunk, a hedge knight of enormous size and modest means who rose from the Flea Bottom gutter to Lord Commander of the Kingsguard.'),
  ('Aegon Targaryen',   70, 40, 50, 45, 25, 50, 'good',    1, 'Egg, a prince disguised as a hedge knight''s squire, who saw the realm from the road before he was ever asked to rule it.'),
  ('Aerion Brightflame',50, 60, 60, 55, 25, 70, 'bad',     0, 'A Targaryen prince of spectacular cruelty who believed he could turn himself into a dragon by drinking wildfire.'),
  ('Bloodraven',        92, 45, 45, 55, 88, 70, 'neutral', 1, 'Brynden Rivers, a Targaryen bastard, sorcerer and spymaster with a thousand eyes and one. He ended up beneath a weirwood as the Three-Eyed Raven.'),
  ('Baelor Targaryen',  75, 70, 60, 70, 25, 82, 'good',    0, 'Baelor Breakspear, Prince of Dragonstone and the finest Hand the realm never got to keep, killed in a trial of seven he had joined to save a hedge knight.'),

  -- The Dance of the Dragons
  ('Rhaenyra Targaryen',78, 40, 50, 50, 80, 45, 'good',    2, 'Named heir by her father and passed over by his council the moment he died, she lit the Dance of the Dragons rather than accept it. Rider of Syrax.'),
  ('Sunfyre',           28, 88, 86, 86, 92, 80, 'neutral', 1, 'The most beautiful dragon ever seen, golden and pink-winged, who was maimed in battle and kept fighting anyway for a king who deserved him less.')
) as v(name, intelligence, strength, speed, durability, power, combat, alignment, fame_tier, summary)
where h.name = v.name and h.publisher = 'Game of Thrones';

-- ── 3. Re-tier the main cast ─────────────────────────────────────────────
-- These were rated by the 'auto-signal' pass, which had no hard signals to work
-- with for this universe (wikidata_sitelinks is NULL on almost every row) and so
-- parked nearly the entire principal cast at tier 1 — Daenerys Targaryen scored
-- the same as a Frey bannerman. fame_tier is a mainstream-recognizability band,
-- and by that measure these are among the most recognisable characters on
-- television. Hard signals still position them within the band.
update public.heroes h
set fame_tier = v.fame_tier,
    fame_rated_at = now(),
    fame_rated_by = 'claude-curated'
from (values
  ('Daenerys Targaryen', 3), ('Arya Stark', 3), ('Eddard Stark', 3),
  ('Sansa Stark', 2), ('Bran Stark', 2), ('Jaime Lannister', 2),
  ('Joffrey Baratheon', 2), ('Sandor Clegane', 2), ('Brienne of Tarth', 2),
  ('Tywin Lannister', 2), ('Stannis Baratheon', 2), ('Melisandre', 2),
  ('Varys', 2), ('Petyr Baelish', 2), ('Samwell Tarly', 2),
  ('Theon Greyjoy', 2), ('Robb Stark', 2), ('Ramsay Bolton', 2),
  ('Khal Drogo', 2), ('Hodor', 2), ('Gregor Clegane', 2),
  ('Robert Baratheon', 2), ('Bronn', 2), ('Catelyn Stark', 2),
  ('Davos Seaworth', 1), ('Gendry', 1), ('Jorah Mormont', 1)
) as v(name, fame_tier)
where h.name = v.name and h.publisher = 'Game of Thrones';
