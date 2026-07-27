-- Relationship blurbs, batch 04. Same-cast band, pairs 101-200.
--
-- 36 written, 62 nothing_to_say, 2 no_relationship, 4 kind corrections.
--
-- Decline rate 64%, WORSE than batch 03's 56%, and the cause is a flaw in my own
-- cast tagging rather than in the queue: 'nintendo' is a single tag covering
-- Mario, Zelda, Kirby, Donkey Kong and Metroid. Those are five franchises that
-- meet only in Smash Bros. Mario/Link, Kirby/Zelda and Princess Peach/Link are
-- all "same cast" and none is a relationship. Fixed in 20260727261000; this
-- batch ate the cost.
--
-- Two kind corrections worth naming. Spider-Man/Gwen Stacy arrives as 'enemy' —
-- she is the girlfriend whose death defined him. Catwoman/Poison Ivy arrives as
-- 'enemy' — they co-founded the Gotham City Sirens. Both are now recorded.
--
-- Also declined: 'Captain Marvel' (156) paired against 'Carol Danvers'
-- (cv-21561). That pair is one character against herself. Recorded as
-- no_relationship with a note, because a merge is the actual fix.

insert into public.hero_relationship_blurbs
  (hero_a, hero_b, blurb, author, verified, status, note, kind_correction)
values
-- ── Star Wars ─────────────────────────────────────────────────────────────
('127', 'cv-5441', 'Boba Fett collected bounties for Jabba the Hutt for years, and after the Hutt died he took the palace and the throne for himself. He is the only one of Jabba''s employees who thought of the job as a career path.', 'claude', false, 'written', null, null),
('418', 'cv-162251', 'Din Djarin spent a season looking for a Jedi to take the child, and the one who came was Luke Skywalker. Handing Grogu over is the only time the Mandalorian takes his helmet off for someone who is leaving.', 'claude', false, 'written', null, null),
('418', 'cv-165877', 'Luke Skywalker trained Grogu and then made him choose between finishing that training and going back to the man who raised him. Grogu picked the armour, which is the first time a Skywalker offer was ever refused.', 'claude', false, 'written', null, null),
('127', 'cv-162251', 'Two Mandalorians who disagree about what that word means: Din Djarin never removes the helmet, and Boba Fett wears the armour as equipment. Fett traded his help for the armour back, and kept the arrangement.', 'claude', false, 'written', null, null),
('cv-162251', 'cv-165877', 'A bounty hunter took a job to deliver a fifty-year-old child and could not go through with it. Everything The Mandalorian does afterwards follows from that one refusal, and neither of them can speak to the other.', 'claude', false, 'written', null, null),
-- ── DC ────────────────────────────────────────────────────────────────────
('298', '69', 'Two men with no powers and enough money to fix that, who chose armour and arrows instead. Oliver Queen is loudly political and Batman refuses to be, which is most of what they argue about in the League.', 'claude', false, 'written', null, null),
('370', '522', 'Poison Ivy is the one Gotham rogue with a personal grievance against the Joker, and it is Harley Quinn. Ivy is who Harley goes to afterwards, and has more than once tried to end the problem permanently.', 'claude', false, 'written', null, null),
('69', 'cv-3726', 'Jonathan Crane weaponised fear against a man who deliberately built himself out of it. The toxin works on Batman — it has repeatedly — and he keeps walking through it, which Crane finds genuinely fascinating.', 'claude', false, 'written', null, null),
('306', '69', 'Hal Jordan has the most powerful weapon in the universe and Batman has taken it off him, which neither has forgotten. The ring is limited by willpower and imagination, and Batman considers Jordan short of both.', 'claude', false, 'written', null, null),
('370', 'cv-3727', 'The Killing Joke is the Joker trying to prove anyone can be broken by one bad day, and James Gordon is who he picks to prove it on. Gordon does not break, which is the argument Batman loses to him.', 'claude', false, 'written', null, null),
('165', '522', 'Selina Kyle and Pamela Isley founded the Gotham City Sirens with Harley Quinn — three of Batman''s rogues sharing an apartment. Ivy is a mass murderer by conviction and Selina is a thief, and the flat still worked.', 'claude', false, 'written', null, 'ally'),
('204', '69', 'Darkseid killed Batman with the Omega Effect in Final Crisis and sent him tumbling backwards through history to do it. It is the only time anyone has needed a god to remove him from the board.', 'claude', false, 'written', null, null),
('204', '644', 'Darkseid is what Superman would be if the power came without the Kansas upbringing, which is why he is the definitive test rather than the strongest one. He wants the Anti-Life Equation: proof that free will is a mistake.', 'claude', false, 'written', null, null),
('309', '522', 'Poison Ivy gave Harley Quinn the immunity to toxins that keeps her alive, and is the person she left the Joker for. Their relationship is now canon and is the healthiest thing in either character''s history.', 'claude', false, 'written', null, null),
('370', '538', 'Ra''s al Ghul calls the Joker "the clown" and considers him a symptom of the civilisation he intends to cull. The Joker finds being beneath a man''s contempt one of the more interesting things on offer in Gotham.', 'claude', false, 'written', null, null),
('538', '69', 'Ra''s al Ghul is the only enemy who calls Batman "Detective" and means it as respect, and he has offered him the empire and his daughter more than once. Talia and Damian are what came of Batman half-accepting.', 'claude', false, 'written', null, null),
('63', 'cv-3727', 'Barbara Gordon is the commissioner''s daughter, and the Joker shot her through the spine specifically to hurt him. Gordon spent years not knowing she was Batgirl and longer pretending he still did not.', 'claude', false, 'written', null, null),
('69', '730', 'Zatanna and Bruce Wayne knew each other as children — her father trained him in escapology — and she later helped mind-wipe a villain, and then Batman, when he objected. He found out, and it cost them years.', 'claude', false, 'written', null, null),
-- ── Marvel ────────────────────────────────────────────────────────────────
('cv-21561', 'cv-3202', 'Nick Fury is the one who put Carol Danvers'' name in the file and the one who lost an eye to her cat. He treats the most powerful person he has ever recruited with the same flat impatience as everyone else.', 'claude', false, 'written', null, null),
('346', '703', 'James Rhodes has worn the armour when Stark could not — through the alcoholism, and after his death more than once — and has never once wanted to keep it. He is the friend Stark has never successfully pushed away.', 'claude', false, 'written', null, null),
('149', '550', 'The Red Skull is what the same serum produced in a man who already wanted it, which is the entire argument for why Erskine chose Rogers. They have been fighting since 1941 and neither has aged into it.', 'claude', false, 'written', null, null),
('620', 'cv-1480', 'Gwen Stacy was thrown off a bridge by the Green Goblin, and the webline Spider-Man fired to catch her is what broke her neck. Comics still date the end of their innocence to that panel.', 'claude', false, 'written', null, 'ally'),
('620', 'h_06811cbb-ee4b-47b2-9e26-4e62ba71b45d', 'Mary Jane Watson knew Peter Parker was Spider-Man long before he told her, and married him anyway — a marriage Marvel later erased with a deal with the devil rather than let it end. She keeps coming back.', 'claude', false, 'written', null, null),
-- ── Everything else ───────────────────────────────────────────────────────
('h_348f88c9-4842-4ed9-be81-72d070073745', 'h_f6db7814-5492-404e-bfa7-603a3b88fd71', 'Woody''s problem with Buzz Lightyear is that Buzz does not know he is a toy, and the film''s turn is Woody having to convince him to accept it. Being loved by a child is offered as the better deal than being real.', 'claude', false, 'written', null, null),
('h_006553ce-4b0b-4df2-880b-50ada770898d', 'h_850dd0ee-0b63-44bd-8936-da706517d07a', 'Donkey Kong was Mario''s first antagonist and Mario was called Jumpman — a carpenter climbing girders to get a woman back from an ape. Forty years later they race karts, and neither game mentions it.', 'claude', false, 'written', null, null),
('h_87df3443-d033-4a58-9876-9a768da6a734', 'h_fe4d8b42-81a9-4438-89a0-a7b51ed195ec', 'Homer makes Aphrodite the daughter of Zeus and Dione, and has her wounded in battle at Troy and sent crying to her father, who tells her war is not her department. It is the most human scene either of them gets.', 'claude', false, 'written', null, 'family'),
('h_09ea65ab-25c6-4bde-95c9-787e866d974b', 'h_87df3443-d033-4a58-9876-9a768da6a734', 'Zeus and Poseidon are brothers who drew lots for the world after overthrowing their father — Zeus took the sky, Poseidon the sea, Hades the dead. Poseidon has never entirely accepted the result of that draw.', 'claude', false, 'written', null, 'family'),
('cv-42244', 'h_352e7702-f997-4aa8-926b-373708917dea', 'Scorpion''s clan was slaughtered by Sub-Zero''s, and Scorpion killed him for it before learning who had actually given the order. Mortal Kombat has restarted its timeline repeatedly and this is the one grudge it always keeps.', 'claude', false, 'written', null, null),
('cv-46231', 'h_d12109cd-c94f-4db4-bc41-cc7aa769ec9a', 'Link and Zelda are reincarnated into the same roles every game — the courage and the wisdom — to face the same enemy, usually without remembering the last time. Neither is written as the other''s reward.', 'claude', false, 'written', null, null),
('404', '541', 'Leonardo leads and Raphael resents it, and that argument is the engine of every version of the Turtles. Splinter named the eldest leader rather than the strongest, which Raphael has never accepted as a reason.', 'claude', false, 'written', null, null),
('h_9a0e3d34-dbda-4b55-9944-e7b6bfbcd280', 'h_d6b4f285-b5f4-4ac7-b2c2-e488b3223da7', 'Daisy Duck was invented to give Donald someone he could not shout at, and is the only character who reliably wins an argument with him. She arrived in 1940 and has outlasted every attempt to make her a supporting player.', 'claude', false, 'written', null, null),
('h_d6b4f285-b5f4-4ac7-b2c2-e488b3223da7', 'h_e3dbea9a-11ee-4415-b75c-4812d2865ab1', 'Minnie Mouse and Daisy Duck are the studio''s oldest friendship between two characters who are not there to be anyone''s foil, which in a cast built on Donald''s temper is genuinely unusual.', 'claude', false, 'written', null, null),
('cv-2936', 'h_751c55e3-38a8-4ff1-86fd-3707a081791e', 'Goofy and Pluto are both dogs, and only one of them talks, wears clothes and holds a job. The studio has never explained it and the joke has outlasted almost everything else about the shorts.', 'claude', false, 'written', null, null),
('289', 'cv-40729', 'Bulma found Goku alone in the woods with a magic ball and took him along to collect the rest, which is the entire origin of Dragon Ball. She is the first friend he ever had and the only one who has never fought him.', 'claude', false, 'written', null, null),
('289', 'cv-45683', 'Krillin trained beside Goku from childhood and is the ordinary man in a cast of gods, which is why his death is the one that broke Goku into a Super Saiyan. Frieza killed him specifically to cause it.', 'claude', false, 'written', null, null),
('cv-3400', 'cv-3402', 'Lisa Simpson is the child Marge cannot help and knows it, and the show''s most uncomfortable episodes are the ones where Marge tries. She wants her daughter to be happy more than she wants her to be right.', 'claude', false, 'written', null, null),
-- ── Declines ──────────────────────────────────────────────────────────────
('cv-2594', 'cv-2608', null, 'claude', false, 'nothing_to_say', 'share the Falcon and no relationship of their own', null),
('714', 'cv-3202', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('156', '313', null, 'claude', false, 'nothing_to_say', 'duplicate row of Carol Danvers; see the merge note', null),
('659', 'cv-21561', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('156', '659', null, 'claude', false, 'nothing_to_say', 'duplicate row of Carol Danvers; see the merge note', null),
('156', 'cv-21561', null, 'claude', false, 'no_relationship', 'SAME CHARACTER in two rows — Captain Marvel (156) and Carol Danvers (cv-21561). Needs admin_merge_heroes, not a blurb.', null),
('cv-162251', 'cv-2594', null, 'claude', false, 'nothing_to_say', 'same saga, no relationship', null),
('cv-165877', 'cv-2594', null, 'claude', false, 'nothing_to_say', 'same saga, no relationship', null),
('127', 'cv-165877', null, 'claude', false, 'nothing_to_say', 'Fett helps guard the child; nothing between the two of them', null),
('h_74c34420-461e-4f2c-8a0d-12e4a533e324', 'h_c0bcc5a8-f0ec-43c7-90dc-a03e443712d5', null, 'claude', false, 'no_relationship', 'different films entirely; grouped only as "Disney villains"', null),
('h_850dd0ee-0b63-44bd-8936-da706517d07a', 'h_9e5b1316-daba-47a0-b807-af6d4cfe866b', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises; meet only in Smash Bros', null),
('cv-55484', 'h_8d776c67-da5c-4d2c-b762-ad363aa20b9f', null, 'claude', false, 'nothing_to_say', 'same franchise, no relationship of their own', null),
('h_850dd0ee-0b63-44bd-8936-da706517d07a', 'h_d12109cd-c94f-4db4-bc41-cc7aa769ec9a', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises; meet only in Smash Bros', null),
('cv-55484', 'h_006553ce-4b0b-4df2-880b-50ada770898d', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises; meet only in Smash Bros', null),
('cv-55484', 'h_9e5b1316-daba-47a0-b807-af6d4cfe866b', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises; meet only in Smash Bros', null),
('cv-46231', 'h_850dd0ee-0b63-44bd-8936-da706517d07a', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises; meet only in Smash Bros', null),
('cv-3376', 'h_443bee64-2f85-432c-a779-b91fb4443ec9', null, 'claude', false, 'nothing_to_say', 'Sesame Street ensemble; no defined relationship', null),
('h_006553ce-4b0b-4df2-880b-50ada770898d', 'h_8d776c67-da5c-4d2c-b762-ad363aa20b9f', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises', null),
('cv-2724', 'h_443bee64-2f85-432c-a779-b91fb4443ec9', null, 'claude', false, 'nothing_to_say', 'Sesame Street ensemble; no defined relationship', null),
('h_8d776c67-da5c-4d2c-b762-ad363aa20b9f', 'h_9e5b1316-daba-47a0-b807-af6d4cfe866b', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises; meet only in Smash Bros', null),
('cv-2724', 'cv-3376', null, 'claude', false, 'nothing_to_say', 'Sesame Street ensemble; no defined relationship', null),
('h_8d776c67-da5c-4d2c-b762-ad363aa20b9f', 'h_d12109cd-c94f-4db4-bc41-cc7aa769ec9a', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises; meet only in Smash Bros', null),
('h_9e5b1316-daba-47a0-b807-af6d4cfe866b', 'h_d12109cd-c94f-4db4-bc41-cc7aa769ec9a', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises; meet only in Smash Bros', null),
('cv-46231', 'h_8d776c67-da5c-4d2c-b762-ad363aa20b9f', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises; meet only in Smash Bros', null),
('cv-46231', 'h_9e5b1316-daba-47a0-b807-af6d4cfe866b', null, 'claude', false, 'nothing_to_say', 'separate Nintendo franchises; meet only in Smash Bros', null),
('370', '678', null, 'claude', false, 'nothing_to_say', 'both Gotham rogues; no relationship of their own', null),
('h_751c55e3-38a8-4ff1-86fd-3707a081791e', 'h_9a0e3d34-dbda-4b55-9944-e7b6bfbcd280', null, 'claude', false, 'nothing_to_say', 'shorts ensemble; nothing between them', null),
('h_751c55e3-38a8-4ff1-86fd-3707a081791e', 'h_e3dbea9a-11ee-4415-b75c-4812d2865ab1', null, 'claude', false, 'nothing_to_say', 'shorts ensemble; Pluto is Mickey''s', null),
('194', '69', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('194', '644', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('194', '720', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('370', 'cv-3726', null, 'claude', false, 'nothing_to_say', 'both Gotham rogues; no relationship of their own', null),
('432', '69', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('h_42f7e0df-0aba-42b6-861f-09bec419704c', 'h_d6b4f285-b5f4-4ac7-b2c2-e488b3223da7', null, 'claude', false, 'nothing_to_say', 'shorts ensemble; nothing between them', null),
('69', 'cv-3588', null, 'claude', false, 'nothing_to_say', 'Deathstroke belongs to the Titans; nothing durable with Batman', null),
('69', 'cv-3725', null, 'claude', false, 'nothing_to_say', 'rogue with no relationship beyond being caught', null),
('149', '579', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('149', '703', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('165', '678', null, 'claude', false, 'nothing_to_say', 'both Gotham rogues; no relationship of their own', null),
('204', '720', null, 'claude', false, 'nothing_to_say', 'League-wide threat; nothing specific to Diana', null),
('cv-2936', 'h_d6b4f285-b5f4-4ac7-b2c2-e488b3223da7', null, 'claude', false, 'nothing_to_say', 'shorts ensemble; nothing between them', null),
('298', '38', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('309', '678', null, 'claude', false, 'nothing_to_say', 'both Gotham rogues; no relationship of their own', null),
('332', '579', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('332', '703', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('370', 'cv-3725', null, 'claude', false, 'nothing_to_say', 'both Gotham rogues; Croc is muscle, not a relationship', null),
('370', 'cv-3715', null, 'claude', false, 'nothing_to_say', 'both Gotham rogues; no relationship of their own', null),
('17', '678', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('38', '432', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('69', 'cv-4684', null, 'claude', false, 'nothing_to_say', 'Brainiac is Superman''s; nothing durable with Batman', null),
('149', '708', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('165', 'cv-3726', null, 'claude', false, 'nothing_to_say', 'both Gotham rogues; no relationship of their own', null),
('194', '38', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('214', '69', null, 'claude', false, 'nothing_to_say', 'Deadshot is a Squad character; nothing durable with Batman', null),
('214', '370', null, 'claude', false, 'nothing_to_say', 'both Squad-adjacent; no relationship of their own', null),
('306', '38', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('309', 'cv-3727', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('309', 'cv-3726', null, 'claude', false, 'nothing_to_say', 'both Gotham rogues; no relationship of their own', null),
('332', '550', null, 'claude', false, 'nothing_to_say', 'Red Skull belongs to Captain America', null),
('346', 'cv-94118', null, 'claude', false, 'nothing_to_say', 'Kamala''s idol is Carol Danvers, not Stark', null),
('346', '550', null, 'claude', false, 'nothing_to_say', 'Red Skull belongs to Captain America', null),
('346', '708', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('522', 'cv-6129', null, 'claude', false, 'nothing_to_say', 'both Gotham rogues; no relationship of their own', null),
('522', 'cv-1691', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null)
on conflict (hero_a, hero_b) do nothing;
