-- The Targaryen dynasty existed in the catalogue as three disconnected islands:
-- the Dance of the Dragons (~130 AC), Dunk & Egg (~209 AC) and the main series
-- (~300 AC). The kings between them were never ingested, so nothing joined them.
-- These 25 rows are that spine, plus Steffon Baratheon, who is the single edge
-- joining House Targaryen to House Baratheon.

insert into public.heroes (
  id, name, publisher, franchise, alignment, gender, race,
  intelligence, strength, speed, durability, power, combat,
  summary, fame_tier, fame_rated_at, fame_rated_by, comicvine_status
) values
('h_81e51866-ca1d-4494-bd9d-a0b7c9a32ed8','Aegon I Targaryen','Game of Thrones','House of the Dragon','neutral','Male','Human',
 80,75,65,72,88,90,'Aegon the Conqueror, who crossed from Dragonstone with his two sister-wives and three dragons and welded six kingdoms into one. He forged the Iron Throne from the surrendered swords of the men who knelt.',
 2, now(), 'claude-curated', 'unmatched'),
('h_dacd479f-8aae-4417-94b4-7ff202225d77','Visenya Targaryen','Game of Thrones','House of the Dragon','neutral','Female','Human',
 78,60,60,62,85,92,'Aegon the Conqueror''s elder sister-wife, rider of Vhagar and wielder of Dark Sister — the harder and more feared of the two queens, and by far the better sword.',
 1, now(), 'claude-curated', 'unmatched'),
('h_0010a9d1-5464-429e-982b-d841bdb6c3c9','Aenys I Targaryen','Game of Thrones','House of the Dragon','good','Male','Human',
 55,35,40,35,60,30,'Aegon the Conqueror''s eldest son and heir, a gentle and irresolute king whose every attempt to please everyone left the realm in revolt.',
 0, now(), 'claude-curated', 'unmatched'),
('h_db495609-3483-4331-802c-cb262c71902d','Maegor I Targaryen','Game of Thrones','House of the Dragon','bad','Male','Human',
 55,85,65,85,82,95,'Maegor the Cruel, who took the throne from his nephew and held it by burning everything that objected. He was found dead on the Iron Throne itself, opened by its own blades.',
 1, now(), 'claude-curated', 'unmatched'),
('h_c30060e3-c2b6-4095-b474-bcbefb17ed6c','Jaehaerys I Targaryen','Game of Thrones','House of the Dragon','good','Male','Human',
 92,50,45,55,80,60,'The Conciliator, who reigned fifty-five years — the longest and most peaceful in Targaryen history — and left the realm roads, laws and an heir problem that would burn it down.',
 1, now(), 'claude-curated', 'unmatched'),
('h_dd182b3d-2884-44b1-8f42-617212c89589','Alysanne Targaryen','Game of Thrones','House of the Dragon','good','Female','Human',
 88,25,35,40,75,20,'Good Queen Alysanne, rider of Silverwing, who flew the length of the realm listening to smallfolk and won more for them by persuasion than any law ever did.',
 1, now(), 'claude-curated', 'unmatched'),
('h_227c1dfa-0c2f-422e-a8e2-89ec8e82e368','Aemon Targaryen','Game of Thrones','House of the Dragon','good','Male','Human',
 70,65,60,65,72,80,'Prince Aemon, eldest son of Jaehaerys I and heir to the Iron Throne, killed by a Myrish crossbow bolt on Tarth before he could ever sit it.',
 0, now(), 'claude-curated', 'unmatched'),
('h_af64a6a9-7fb2-4ec2-87ed-e3d284f485ba','Baelon Targaryen','Game of Thrones','House of the Dragon','good','Male','Human',
 68,72,65,70,75,85,'Baelon the Brave, second son of Jaehaerys I, named heir over his elder brother''s daughter — the choice that taught House Targaryen a daughter''s claim could be set aside.',
 0, now(), 'claude-curated', 'unmatched'),
('h_c21a7b01-cf85-485e-8381-6042e303e49c','Aegon III Targaryen','Game of Thrones','House of the Dragon','neutral','Male','Human',
 65,40,45,45,35,45,'The Dragonbane, who watched his mother eaten by a dragon as a boy and grew into a grey, joyless king. Every dragon in the world died during his reign.',
 1, now(), 'claude-curated', 'unmatched'),
('h_c0209c7e-3fe4-4a08-892f-4131e9e31ca7','Daeron I Targaryen','Game of Thrones','House of the Dragon','good','Male','Human',
 70,65,75,60,25,88,'The Young Dragon, who conquered Dorne at fourteen and lost it again before he was twenty, along with his life and ten thousand men.',
 1, now(), 'claude-curated', 'unmatched'),
('h_64ea2a0f-0440-4b4e-b995-61a1b0e8db55','Baelor I Targaryen','Game of Thrones','House of the Dragon','good','Male','Human',
 60,25,30,30,40,15,'Baelor the Blessed, a king so devout he walked barefoot to Dorne to make peace and starved himself to death fasting. He also built the Great Sept that bears his name.',
 1, now(), 'claude-curated', 'unmatched'),
('h_fd818ab4-c492-417f-864d-7ed7aba1bc27','Viserys II Targaryen','Game of Thrones','House of the Dragon','neutral','Male','Human',
 88,40,40,45,30,50,'The ablest administrator the dynasty produced, who ran the realm as Hand through three reigns and held the throne himself for barely a year.',
 0, now(), 'claude-curated', 'unmatched'),
('h_e4663a99-b1e7-49e0-bbe3-6eeccb958034','Aegon IV Targaryen','Game of Thrones','House of the Dragon','bad','Male','Human',
 50,35,30,35,30,30,'Aegon the Unworthy, whose appetites were legendary and whose deathbed legitimisation of every bastard he had fathered gave Westeros five generations of civil war.',
 1, now(), 'claude-curated', 'unmatched'),
('h_f715ee47-025c-4c1d-9354-52f6ca9953e9','Naerys Targaryen','Game of Thrones','House of the Dragon','good','Female','Human',
 70,15,25,20,30,10,'A frail and pious queen married to a brother she loathed, and — by the song everyone sang and no one could prove — loved by another.',
 0, now(), 'claude-curated', 'unmatched'),
('h_9cea6670-6220-4f32-af45-db5d1214be0e','Aemon the Dragonknight','Game of Thrones','House of the Dragon','good','Male','Human',
 72,75,80,72,25,97,'Prince Aemon of the Kingsguard, the most chivalrous knight in Targaryen memory, who died taking the blades meant for his brother the king.',
 1, now(), 'claude-curated', 'unmatched'),
('h_68ffb5e8-e06f-4cd7-8ef6-1429a155794a','Daeron II Targaryen','Game of Thrones','House of the Dragon','good','Male','Human',
 90,35,35,45,35,35,'Daeron the Good, who won Dorne with a marriage where his ancestors had failed with dragons, and was called weak for it ever after.',
 1, now(), 'claude-curated', 'unmatched'),
('h_b3018aee-7a6c-4e5a-887a-4a569e12efca','Aerys I Targaryen','Game of Thrones','House of the Dragon','neutral','Male','Human',
 80,25,30,30,35,20,'A bookish, disinterested king who left the ruling to his Hand, Bloodraven, and produced no heir at all.',
 0, now(), 'claude-curated', 'unmatched'),
('h_6e27e7f6-f674-4ce8-9c85-f6fc4226b101','Rhaegel Targaryen','Game of Thrones','House of the Dragon','neutral','Male','Human',
 45,30,35,35,30,25,'A gentle, addled prince of the line, remembered mostly for dancing naked through the Red Keep and for choking to death on a lamprey pie.',
 0, now(), 'claude-curated', 'unmatched'),
('h_988b3f4d-b7ff-4c30-a236-7b8fe0ce22f7','Aegon V Targaryen','Game of Thrones','A Song of Ice and Fire','good','Male','Human',
 78,50,55,55,35,60,'Egg, the fourth son who was never meant to rule and who spent his boyhood on the road as a hedge knight''s squire. He died at Summerhall trying to wake dragons from stone.',
 1, now(), 'claude-curated', 'unmatched'),
('h_0de92ef1-5925-458a-9887-6325cd29e16c','Duncan Targaryen','Game of Thrones','A Song of Ice and Fire','good','Male','Human',
 55,60,55,60,30,65,'The Prince of Dragonflies, who gave up his claim to the Iron Throne to marry a common girl for love, and died with his father at Summerhall.',
 0, now(), 'claude-curated', 'unmatched'),
('h_2054cddc-28f0-466b-b856-46dfad92ff70','Jaehaerys II Targaryen','Game of Thrones','A Song of Ice and Fire','neutral','Male','Human',
 70,25,30,25,30,30,'A sickly king who reigned only three years, remembered for ending the Ninepenny Kings and for marrying his son to his daughter.',
 0, now(), 'claude-curated', 'unmatched'),
('h_2e4dcbee-4f4d-420e-8b31-258d44a7c107','Shaera Targaryen','Game of Thrones','A Song of Ice and Fire','neutral','Female','Human',
 60,20,30,30,30,15,'Aegon V''s daughter, who defied her father and eloped with her own brother — the match that produced the last Targaryen kings.',
 0, now(), 'claude-curated', 'unmatched'),
('h_6cd5ef50-376e-4f93-83d1-faaebea41fd1','Rhaella Targaryen','Game of Thrones','A Song of Ice and Fire','good','Female','Human',
 65,20,30,35,40,15,'The last Targaryen queen of Westeros, who endured her brother-husband''s cruelty for decades and died on Dragonstone giving birth to Daenerys during a storm.',
 1, now(), 'claude-curated', 'unmatched'),
('h_79247178-0c3b-4327-982c-f0de2aae08df','Rhaelle Targaryen','Game of Thrones','A Song of Ice and Fire','good','Female','Human',
 55,20,30,30,30,15,'Aegon V''s youngest daughter, married off to Storm''s End — the drop of dragon blood that gave House Baratheon its claim to the Iron Throne.',
 0, now(), 'claude-curated', 'unmatched'),
('h_c90ea025-3415-4602-8b74-ed6a851316b8','Steffon Baratheon','Game of Thrones','A Song of Ice and Fire','good','Male','Human',
 65,60,50,60,20,65,'Lord of Storm''s End and father to Robert, Stannis and Renly, drowned in Shipbreaker Bay within sight of his castle while his sons watched from the walls.',
 0, now(), 'claude-curated', 'unmatched');

-- Disambiguate the two kings whose short names collide inside the dynasty now
-- that their namesakes exist. Aliases keep the familiar names searchable
-- (search_text is generated over name + full_name + aliases).
update public.heroes
set name = 'Aerys II Targaryen',
    aliases = array(select distinct e from unnest(coalesce(aliases, '{}'::text[]) || array['Aerys Targaryen','The Mad King']) e)
where publisher = 'Game of Thrones' and name = 'Aerys Targaryen';

update public.heroes
set aliases = array(select distinct e from unnest(coalesce(aliases, '{}'::text[]) || array['Egg','Aegon V']) e)
where publisher = 'Game of Thrones' and name = 'Aegon Targaryen';;
