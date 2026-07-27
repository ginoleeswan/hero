-- Relationship blurbs, batch 05. Same-cast band, pairs 201-300.
--
-- 34 written, 66 nothing_to_say, 3 kind corrections.
--
-- The decline rate has settled around 65% for this band and the shape of the
-- declines is stable: rogues-gallery cross products (Catwoman/Killer Croc,
-- Riddler/Scarecrow) and roster cross products (Hawkeye/War Machine,
-- Hulk/Sam Wilson). Both are cases where a cast tag is correct and a
-- relationship still does not exist — Gotham has fifteen rogues, which is 105
-- pairs, of which maybe a dozen are anything.
--
-- Three kind corrections, all the same error: a parent, a mentor and a spouse
-- filed as 'ally'. Goku/Gohan is father and son, Spider-Man/Uncle Ben is the
-- man whose death is the character's whole thesis, and Vegeta/Bulma are married
-- with two children.

insert into public.hero_relationship_blurbs
  (hero_a, hero_b, blurb, author, verified, status, note, kind_correction)
values
-- ── Spider-Man's people ───────────────────────────────────────────────────
('620', 'cv-1780', 'May Parker raised Peter and has spent decades being the hostage, the frailty and the reason he keeps the mask on. The comics have killed her, aged her, cured her and made her a superhero, and she still works best worrying about him.', 'claude', false, 'written', null, null),
('620', 'cv-1487', 'J. Jonah Jameson has run a decades-long smear campaign against Spider-Man while paying Peter Parker for the photographs. It is the best joke in comics and Jameson has never once been written as stupid, only wrong.', 'claude', false, 'written', null, null),
('620', 'cv-3114', 'Ben Parker is dead by the eleventh page of Amazing Fantasy #15, killed by a burglar Peter could have stopped and did not. Everything the character has done since is an argument with a man who is not there.', 'claude', false, 'written', null, 'family'),
('620', 'cv-2478', 'Harry Osborn was Peter Parker''s best friend and roommate before he found his father dead and Spider-Man standing over him. He became the Green Goblin knowing exactly whose life he was ruining.', 'claude', false, 'written', null, null),
('391', '620', 'Wilson Fisk is a crime boss who cannot be punched into prison, which makes him the wrong shape of problem for Spider-Man entirely. Fisk''s response to being unbeatable in a fight is to buy the building instead.', 'claude', false, 'written', null, null),
('395', '620', 'Kraven the Hunter buried Spider-Man alive, wore his costume for two weeks to prove he could do the job better, and then shot himself having won. Kraven''s Last Hunt is the story the character never came back from.', 'claude', false, 'written', null, null),
('620', 'cv-4333', 'Quentin Beck is a special-effects man who worked out that illusion beats strength against someone whose main advantage is knowing what is coming. Mysterio''s whole method is defeating the spider-sense with a lie.', 'claude', false, 'written', null, null),
-- ── Superman's Krypton ────────────────────────────────────────────────────
('644', 'h_89ff9c2c-5768-483b-be41-e723ef0df460', 'Jor-El put his son in a rocket because nobody on Krypton would believe the planet was dying. Superman has spent his career being raised by a recording of a man who was right and could not convince anyone.', 'claude', false, 'written', null, null),
('644', 'cv-4684', 'Brainiac shrank and bottled Kandor before Krypton exploded, which means he is both the reason a Kryptonian city survived and the reason it is in a jar. Superman has to negotiate with the thief who saved his people.', 'claude', false, 'written', null, null),
('278', '644', 'General Zod is the other survivor — same powers, same sun, no Kansas — and he considers Superman a traitor for choosing humans over the last of his own kind. Killing him is the one line Superman has been made to cross.', 'claude', false, 'written', null, null),
('396', '644', 'Krypto was in a test rocket Jor-El sent up before his son''s, drifted for years, and arrived on Earth to find the baby he knew had grown up. He is the only living thing left that remembers Krypton as home.', 'claude', false, 'written', null, null),
('405', 'cv-4684', 'Luthor and Brainiac keep allying against Superman and keep discovering the other intends to keep the planet. Luthor wants to save humanity from its saviour; Brainiac wants humanity catalogued and the rest deleted.', 'claude', false, 'written', null, null),
-- ── X-Men ─────────────────────────────────────────────────────────────────
('196', '717', 'Scott Summers and Logan have wanted the same woman and disagreed about every order for forty years. Cyclops is the field commander Logan will not salute and the one man whose plans he keeps following anyway.', 'claude', false, 'written', null, null),
('717', 'cv-3552', 'Jean Grey is the one person Logan is written as gentle with, and she chose Scott Summers every time. The X-Men have buried her repeatedly, and Logan is usually the one who has to do it.', 'claude', false, 'written', null, null),
('527', 'cv-3552', 'Charles Xavier found Jean Grey as a child and put psychic blocks on her power because it frightened him. Everything the Phoenix later became is arguable evidence that he was right to, and that he had no business doing it.', 'claude', false, 'written', null, null),
-- ── Avengers ──────────────────────────────────────────────────────────────
('346', '680', 'Ultron is Hank Pym''s in the comics and Tony Stark''s on screen, and both versions are a man building a thing to end war and getting a thing that agrees. Stark''s guilt about it is the closest he comes to an origin.', 'claude', false, 'written', null, null),
('346', '697', 'The Vision is what Stark''s own assistant became after Ultron used it and a stone finished it — a machine Stark helped make that turned out kinder than he is. Stark has never been able to treat him as a creation.', 'claude', false, 'written', null, null),
('149', 'cv-1451', 'Sam Wilson has flown at Rogers'' shoulder since 1969 and eventually carried the shield, and is the only successor Rogers picked rather than had chosen for him. He hands it over having watched Wilson refuse it once.', 'claude', false, 'written', null, null),
('226', '579', 'Wanda Maximoff''s power is not magic and does not obey the rules Strange spent his life learning, which is exactly why he is afraid of her. He is also the one person who talks to her as a colleague rather than a threat.', 'claude', false, 'written', null, null),
('313', '579', 'Clint Barton is the one who talked Wanda Maximoff into the fight after her brother died, and the pairing works because he is the Avenger with nothing but skill and she is the one who could unmake him by blinking.', 'claude', false, 'written', null, null),
-- ── DC ────────────────────────────────────────────────────────────────────
('720', 'h_ce7c539e-ed41-476f-a4be-4a997f6bf935', 'Steve Trevor crashed on Themyscira and became the first man Diana ever saw, which is how she left. He is also the one the story keeps killing, because a Wonder Woman who gets to keep him is a different character.', 'claude', false, 'written', null, null),
('105', '38', 'Black Manta killed Aquaman''s infant son, and Aquaman killed his father — the order depends on the era and both are always true. It is the most personal grudge in the Justice League and the least discussed.', 'claude', false, 'written', null, null),
('194', 'cv-1691', 'Founding Teen Titans, and the two who took it most seriously: Dick Grayson because he was building something that was not Batman''s, and Victor Stone because the Titans were the first place nobody stared.', 'claude', false, 'written', null, null),
('cv-1691', 'cv-3586', 'Beast Boy joined the Titans as the youngest and loudest, and Dick Grayson is the one who kept letting him stay. The team is the only family either of them has that they picked themselves.', 'claude', false, 'written', null, null),
('cv-1691', 'cv-3588', 'Deathstroke took a contract on the Teen Titans and infiltrated them through a teenage girl, which is the story that ended their innocence and made Slade Wilson permanent. Dick Grayson has never let it go.', 'claude', false, 'written', null, null),
('214', '309', 'Squadmates on the Suicide Squad, and Floyd Lawton is the closest thing Harley Quinn has to a professional colleague — a contract killer who never misses, working beside someone with no plan at all.', 'claude', false, 'written', null, null),
-- ── Star Wars ─────────────────────────────────────────────────────────────
('208', 'cv-6355', 'Lando Calrissian sold Han Solo to Vader to keep Cloud City, discovered the deal kept changing, and spent the next film stealing him back. Vader alters the terms twice on screen and dares him to object.', 'claude', false, 'written', null, null),
('208', 'cv-5395', 'Mace Windu had Palpatine beaten and Anakin Skywalker cut off his hand to stop him, which is the exact moment the Republic ends. Windu is the Jedi who never trusted Anakin and was right in the worst possible way.', 'claude', false, 'written', null, null),
-- ── Everything else ───────────────────────────────────────────────────────
('289', 'cv-40743', 'Goku named his son after his grandfather and then kept dying and leaving him to it. Gohan is stronger than his father at the moment it matters most and spends the rest of the series not wanting to be.', 'claude', false, 'written', null, 'family'),
('289', 'cv-53244', 'Master Roshi trained Goku''s grandfather and then Goku, and is a lecherous old man who is also the reason the strongest fighter alive has manners. He stopped being able to teach him decades ago and stayed anyway.', 'claude', false, 'written', null, null),
('cv-40722', 'cv-40729', 'The prince of the Saiyans married the woman who built the radar that started the whole story, and Dragon Ball never once explains it. Bulma is the only person alive who is not remotely frightened of Vegeta.', 'claude', false, 'written', null, 'family'),
('485', 'cv-44241', 'Naruto and Sasuke were the class idiot and the class prodigy, put on the same team, and the entire series is Naruto refusing to let him go. It ends with both of them missing an arm and calling it settled.', 'claude', false, 'written', null, null),
('h_7afb07e3-a2ef-4320-8ebf-1573604e3ed7', 'h_9a0e3d34-dbda-4b55-9944-e7b6bfbcd280', 'Scrooge McDuck is the richest duck in the world and his nephew Donald is permanently broke, which is the engine of every adventure they have ever been sent on. Scrooge pays in exposure.', 'claude', false, 'written', null, null),
('cv-52213', 'h_8c6fc8b8-7afa-40b1-aa79-5c0faf27e228', 'Meowth taught himself to talk and walk upright to impress a female Meowth who rejected him for it, and has spent every episode since trying to capture Pikachu. He is the only one in Team Rocket with a tragedy.', 'claude', false, 'written', null, null),
-- ── Declines ──────────────────────────────────────────────────────────────
('522', 'cv-4885', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product; no relationship of their own', null),
('522', 'cv-3718', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('615', 'cv-2860', null, 'claude', false, 'nothing_to_say', 'both Looney Tunes leads; no shared cartoons of note', null),
('678', 'cv-1691', null, 'claude', false, 'nothing_to_say', 'Two-Face belongs to Batman; nothing durable with Nightwing', null),
('678', 'cv-3718', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('720', 'cv-4684', null, 'claude', false, 'nothing_to_say', 'Brainiac is Superman''s; nothing specific to Diana', null),
('17', 'cv-3726', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('63', 'cv-3588', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('63', 'cv-3725', null, 'claude', false, 'nothing_to_say', 'rogue with no relationship beyond being caught', null),
('69', 'h_2c675c1e-8f8a-4f0f-b370-95d28f5d4e72', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('149', '536', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('149', '680', null, 'claude', false, 'nothing_to_say', 'Ultron is Pym''s and Stark''s; nothing specific to Rogers', null),
('149', '697', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('165', 'cv-3588', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('165', 'cv-3725', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('165', 'cv-3715', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('165', '538', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('194', 'h_2ace1789-18f4-43bb-8f5f-030acaed0471', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('204', '38', null, 'claude', false, 'nothing_to_say', 'League-wide threat; nothing specific to Arthur', null),
('309', 'cv-3725', null, 'claude', false, 'nothing_to_say', 'Squad roster; nothing between the two of them', null),
('309', 'cv-3715', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('332', 'cv-1451', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('332', '680', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('332', '697', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('346', '536', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('346', 'cv-1451', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('cv-3727', 'cv-6129', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('cv-3727', 'cv-4885', null, 'claude', false, 'nothing_to_say', 'commissioner and crime boss; nothing specific written', null),
('cv-1691', 'cv-3727', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; the Gordon tie that matters is Barbara''s', null),
('cv-1691', 'cv-3726', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('cv-3718', 'cv-3727', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('cv-3718', 'cv-3726', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('579', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('644', 'h_2c675c1e-8f8a-4f0f-b370-95d28f5d4e72', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('703', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('17', 'cv-3725', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('17', '538', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('38', '730', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('69', 'cv-6578', null, 'claude', false, 'nothing_to_say', 'Lobo is a cosmic guest; nothing durable', null),
('69', 'h_c641fc32-86de-4e33-a5e9-0a7daa34d10f', null, 'claude', false, 'nothing_to_say', 'rogue with no relationship beyond being caught', null),
('106', '579', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('106', '703', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('165', '214', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('204', 'h_2ace1789-18f4-43bb-8f5f-030acaed0471', null, 'claude', false, 'nothing_to_say', 'League-wide threat; the Black Racer chase is not a relationship', null),
('226', '703', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('313', '703', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('h_554ad3d0-6bd0-4fae-98b2-6f12c147bda4', 'h_9a0e3d34-dbda-4b55-9944-e7b6bfbcd280', null, 'claude', false, 'nothing_to_say', 'Jiminy Cricket belongs to Pinocchio', null),
('h_554ad3d0-6bd0-4fae-98b2-6f12c147bda4', 'h_e3dbea9a-11ee-4415-b75c-4812d2865ab1', null, 'claude', false, 'nothing_to_say', 'Jiminy Cricket belongs to Pinocchio', null),
('370', 'h_c641fc32-86de-4e33-a5e9-0a7daa34d10f', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('cv-3725', 'cv-6129', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('cv-3725', 'cv-4885', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('cv-3715', 'cv-6129', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('cv-3715', 'cv-3718', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('480', '717', null, 'claude', false, 'nothing_to_say', 'X-Men adjacency; nothing durable between them', null),
('cv-1691', 'cv-3725', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('cv-52213', 'h_5c99b8b3-131c-46ad-9fc6-0f4b73e365dd', null, 'claude', false, 'nothing_to_say', 'travelling companions; Pikachu''s tie is to Ash', null),
('538', 'cv-6129', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('538', 'cv-3718', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('cv-3718', 'cv-3725', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('644', 'cv-6578', null, 'claude', false, 'nothing_to_say', 'Lobo is a cosmic guest; nothing durable', null),
('cv-40722', 'cv-45683', null, 'claude', false, 'nothing_to_say', 'Vegeta has killed him and moved on; no relationship of their own', null),
('708', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('717', '75', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('720', 'cv-6578', null, 'claude', false, 'nothing_to_say', 'Lobo is a cosmic guest; nothing durable', null),
('38', 'h_2c675c1e-8f8a-4f0f-b370-95d28f5d4e72', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('106', '550', null, 'claude', false, 'nothing_to_say', 'Red Skull belongs to Captain America', null)
on conflict (hero_a, hero_b) do nothing;
