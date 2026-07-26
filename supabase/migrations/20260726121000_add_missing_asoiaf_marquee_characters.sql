-- Add the marquee ASOIAF characters the catalogue never had.
--
-- ComicVine is the sole ingest path for this universe, and the comic adaptation
-- stopped after A Clash of Kings. Everything famous that happens later — Oberyn,
-- Olenna, Tormund, Missandei, Grey Worm, the Dornish, the entire Dance of the
-- Dragons cast — was therefore never swept. These are hand-curated rows.
--
-- Deliberately NOT added:
--   * Yara Greyjoy. Already present as "Asha Greyjoy" (her book name) — the same
--     character. Gets an alias below instead of a duplicate row.
--   * Ilyn Payne, Janos Slynt, Xaro Xhoan Daxos, Meera/Jojen Reed, Gilly. All
--     already in the catalogue and reclaimed by the previous migration.
--
-- comicvine_id is left NULL and comicvine_status set to 'unmatched': these are
-- show/later-book characters ComicVine genuinely has no entry for. 'unmatched'
-- is the terminal state that keeps them out of the enrich build queue and stops
-- the read-through path refetching them on every view.
--
-- stats_source stays NULL to match the 31 GoT heroes already carrying curated
-- stats; StatsSource in src/types is a closed union ('superheroapi' | 'ai').
--
-- image_url is NULL on every row — none of these have art yet. They are the
-- portrait-generation worklist.

insert into public.heroes (
  id, name, publisher, franchise, alignment, gender, race,
  intelligence, strength, speed, durability, power, combat,
  description, fame_tier, fame_rated_at, fame_rated_by, comicvine_status
) values
-- ── Game of Thrones / A Song of Ice and Fire ──────────────────────────────
('h_a4c019f3-5ced-4250-a15c-91f6c9be7c2e','Tormund Giantsbane','Game of Thrones','A Song of Ice and Fire','good','Male','Human',
 50,85,60,85,25,85,
 'A free folk raider whose booming laugh and tall tales made him the warmest presence north of the Wall. He becomes Jon Snow''s unlikeliest ally, leading the wildlings south rather than let them die as wights.',
 2, now(), 'claude-curated', 'unmatched'),

('h_596c8b53-a04d-4a39-9555-172eb2f2febc','Oberyn Martell','Game of Thrones','A Song of Ice and Fire','good','Male','Human',
 80,65,90,55,25,95,
 'The Red Viper of Dorne, a spear-fighter as quick with poison as with wit, who came to King''s Landing carrying a grudge two decades old. His duel with the Mountain is the most famous trial by combat in Westeros.',
 2, now(), 'claude-curated', 'unmatched'),

('h_cc15b9a0-0fc8-421d-816e-35757a14ba74','Olenna Tyrell','Game of Thrones','A Song of Ice and Fire','neutral','Female','Human',
 95,10,10,20,20,10,
 'The Queen of Thorns, matriarch of House Tyrell, who ran the realm''s sharpest tongue and its quietest conspiracies. She poisoned a king at his own wedding and confessed it only when she had nothing left to lose.',
 2, now(), 'claude-curated', 'unmatched'),

('h_76328e53-7cc8-4aae-acc5-c18a2486a89d','Missandei','Game of Thrones','A Song of Ice and Fire','good','Female','Human',
 85,15,30,25,15,10,
 'A former slave of Naath who spoke nineteen languages and became Daenerys Targaryen''s closest confidante and voice. Her final word, spoken in chains, became the rallying cry for the sack of King''s Landing.',
 1, now(), 'claude-curated', 'unmatched'),

('h_b3d34095-951f-4ea5-a1c8-7f1524b3516f','Grey Worm','Game of Thrones','A Song of Ice and Fire','good','Male','Human',
 65,75,65,80,25,90,
 'Commander of the Unsullied, chosen by his own brothers-in-arms after Daenerys freed them at Astapor. He kept the name he was given as a slave as a reminder of the day he was made free.',
 1, now(), 'claude-curated', 'unmatched'),

('h_f10f7f10-d89a-4e82-96be-1a698c925526','Daario Naharis','Game of Thrones','A Song of Ice and Fire','good','Male','Human',
 60,70,75,65,25,85,
 'A sellsword captain of the Second Sons who murdered his own commanders to lay their heads at Daenerys Targaryen''s feet. Charming, lethal and entirely without shame about either.',
 1, now(), 'claude-curated', 'unmatched'),

('h_cec47238-e6f0-481f-8b43-48b401d63809','Euron Greyjoy','Game of Thrones','A Song of Ice and Fire','bad','Male','Human',
 75,80,70,75,30,88,
 'The Crow''s Eye, a reaver who murdered his brother to take the Salt Throne and then built the fleet that burned the Iron Islands'' rivals. He fears nothing, which is precisely what makes him dangerous.',
 1, now(), 'claude-curated', 'unmatched'),

('h_fede1214-54d6-4f15-a1c4-649a8aa91d40','Ellaria Sand','Game of Thrones','A Song of Ice and Fire','bad','Female','Human',
 65,35,45,35,20,45,
 'Oberyn Martell''s paramour, who answered his death with a campaign of poison against House Lannister. Her vengeance consumed Dorne and, in the end, her own daughters.',
 1, now(), 'claude-curated', 'unmatched'),

('h_59e92133-dd11-4d88-939f-cc20015c686e','Thoros of Myr','Game of Thrones','A Song of Ice and Fire','good','Male','Human',
 65,55,50,60,70,75,
 'A red priest of R''hllor who drank more than he prayed, and was astonished to find his god answering anyway. He resurrected Beric Dondarrion six times without ever fully understanding how.',
 1, now(), 'claude-curated', 'unmatched'),

('h_c550c644-627e-4bf7-96a5-bd40ea55cd45','Syrio Forel','Game of Thrones','A Song of Ice and Fire','good','Male','Human',
 75,45,95,45,20,95,
 'First Sword to the Sealord of Braavos and Arya Stark''s dancing master, who taught her to fight with speed instead of strength. He faced armoured Lannister guards with a wooden practice sword.',
 1, now(), 'claude-curated', 'unmatched'),

('h_3c05def9-3e1b-43b1-a9fb-f030311533d4','High Sparrow','Game of Thrones','A Song of Ice and Fire','bad','Male','Human',
 85,20,20,30,40,10,
 'A barefoot zealot who rose from feeding the poor to holding a queen in a cell beneath the Great Sept. He understood that faith armed with enough followers outranks any crown.',
 1, now(), 'claude-curated', 'unmatched'),

('h_acdb4fed-c9b6-423b-a33b-5ccfbe8757af','Mance Rayder','Game of Thrones','A Song of Ice and Fire','neutral','Male','Human',
 80,70,60,70,25,82,
 'A deserter of the Night''s Watch who did what no one had managed in centuries: united the free folk under one banner as King-Beyond-the-Wall. He gathered a hundred thousand people not to conquer Westeros but to escape what was coming behind them.',
 1, now(), 'claude-curated', 'unmatched'),

('h_1e39f243-84fd-4eb8-bc47-bf1f8d8a36a3','Lyanna Mormont','Game of Thrones','A Song of Ice and Fire','good','Female','Human',
 80,20,35,30,20,30,
 'The child Lady of Bear Island, who commanded sixty-two fighting men and spoke to grown lords as though they were wasting her time. She died killing a giant.',
 1, now(), 'claude-curated', 'unmatched'),

('h_ab3a5143-20cd-4b6a-8800-4824ce0f0a6f','Talisa Maegyr','Game of Thrones','A Song of Ice and Fire','good','Female','Human',
 75,20,35,30,15,15,
 'A Volantene noblewoman who abandoned her station to work as a battlefield healer, tending wounded on both sides of the war. Marrying her cost Robb Stark the alliance that kept him alive.',
 0, now(), 'claude-curated', 'unmatched'),

-- ── House of the Dragon / the Dance of the Dragons ────────────────────────
('h_d7c9e03a-7c1c-474f-aa1a-bad5612aa4ef','Daemon Targaryen','Game of Thrones','House of the Dragon','neutral','Male','Human',
 80,78,70,75,85,95,
 'The Rogue Prince, rider of Caraxes and wielder of Dark Sister, equally capable of winning a war and starting one for his own amusement. His loyalty ran to his family alone, and even that he tested to destruction.',
 2, now(), 'claude-curated', 'unmatched'),

('h_4f5e55e4-ff20-4837-8d4d-ee1f47c68d54','Alicent Hightower','Game of Thrones','House of the Dragon','neutral','Female','Human',
 85,15,25,30,25,10,
 'Daughter of the Hand and second wife to King Viserys I, who spent a lifetime converting a childhood friendship with Rhaenyra into a rivalry that split the realm. She believed she was holding the kingdom together.',
 2, now(), 'claude-curated', 'unmatched'),

('h_01dc5f21-d539-4c89-b5d1-45e7844fa442','Otto Hightower','Game of Thrones','House of the Dragon','neutral','Male','Human',
 90,20,20,30,25,20,
 'Hand of the King across two reigns, who put his daughter in the king''s bed and his grandson on the throne. Every move he made was patient, reasonable and ruinous.',
 1, now(), 'claude-curated', 'unmatched'),

('h_cd09dc23-a9f5-45f7-b701-1b8654fb8f7d','Aemond Targaryen','Game of Thrones','House of the Dragon','bad','Male','Human',
 75,70,68,70,90,90,
 'One-eyed prince who claimed Vhagar, the largest dragon alive, as a boy and never let anyone forget the price he paid for her. His temper turned a family quarrel into open war.',
 2, now(), 'claude-curated', 'unmatched'),

('h_2ca8347e-c782-401a-b945-74448a593260','Aegon II Targaryen','Game of Thrones','House of the Dragon','bad','Male','Human',
 55,60,55,60,80,65,
 'Crowned king over his elder sister''s claim by a council that never asked whether he wanted it. He rode Sunfyre into a war he was neither willing nor able to win.',
 1, now(), 'claude-curated', 'unmatched'),

('h_96cd3b9a-8d03-4c1f-8524-c31873a3013d','Rhaenys Targaryen','Game of Thrones','House of the Dragon','good','Female','Human',
 82,50,55,55,82,70,
 'The Queen Who Never Was, passed over for the throne in favour of a younger male cousin and never once pretended it was just. Astride Meleys she could have ended the war in a single breath, and chose not to.',
 1, now(), 'claude-curated', 'unmatched'),

('h_322e82f3-e777-4bb1-b505-2638f4e21a98','Corlys Velaryon','Game of Thrones','House of the Dragon','good','Male','Human',
 85,55,45,60,25,70,
 'The Sea Snake, the most travelled man in Westeros and master of the largest fleet in the world. He built House Velaryon into wealth that rivalled the crown, then spent it chasing a throne for his blood.',
 1, now(), 'claude-curated', 'unmatched'),

('h_7005bdf5-fc4a-44ce-bafd-d000079b2649','Criston Cole','Game of Thrones','House of the Dragon','bad','Male','Human',
 55,78,70,75,25,92,
 'A common-born knight raised to the Kingsguard, called the Kingmaker for crowning Aegon II. A single rejection turned the finest sword in the realm into its most bitter partisan.',
 1, now(), 'claude-curated', 'unmatched'),

('h_f2598a4e-337e-47ac-ae75-15c255c2ca7e','Viserys I Targaryen','Game of Thrones','House of the Dragon','good','Male','Human',
 75,20,15,15,25,20,
 'A gentle king who wanted only peace and a settled succession, and whose refusal to choose between his children guaranteed neither. He held the realm together by sheer stubbornness until his body gave out.',
 1, now(), 'claude-curated', 'unmatched'),

('h_1b612fa9-7109-4a6d-ae87-56d120b2490b','Helaena Targaryen','Game of Thrones','House of the Dragon','good','Female','Human',
 70,25,30,30,72,15,
 'Dragonrider of Dreamfyre, a quiet queen who spoke in riddles that kept coming true. She wanted no part of the war her family fought in her name.',
 1, now(), 'claude-curated', 'unmatched'),

('h_75c95438-d11a-489e-9b9f-1ddb141e9220','Vhagar','Game of Thrones','House of the Dragon','neutral','Female','Dragon',
 25,100,80,98,100,85,
 'The largest and oldest living dragon in the world, who flew in Aegon''s Conquest and outlived three riders. By the Dance she was big enough that her landing shook the ground.',
 1, now(), 'claude-curated', 'unmatched'),

('h_33a15e25-3a5d-4611-b7f4-c0591cf5bb63','Caraxes','Game of Thrones','House of the Dragon','neutral','Male','Dragon',
 25,92,88,90,95,88,
 'The Blood Wyrm, a lean red dragon as vicious and restless as the prince who rode him. His scream was said to be the most terrible sound in the Seven Kingdoms.',
 1, now(), 'claude-curated', 'unmatched');

-- Yara is the show''s name for Asha Greyjoy; keep one row, make both names findable.
-- search_text is a generated column over name + full_name + aliases, so this
-- makes "Yara" resolve to her without a duplicate.
update public.heroes
set aliases = array(select distinct e from unnest(coalesce(aliases, '{}'::text[]) || array['Yara Greyjoy','Yara']) e)
where name = 'Asha Greyjoy' and publisher = 'Game of Thrones';

-- Rhaenyra and Sunfyre arrived via the Hedge Knight comics and so were filed
-- under Dunk & Egg by the reclaim migration. They belong to the Dance of the
-- Dragons, ~90 years later.
update public.heroes
set franchise = 'House of the Dragon'
where publisher = 'Game of Thrones'
  and name in ('Rhaenyra Targaryen', 'Sunfyre');
