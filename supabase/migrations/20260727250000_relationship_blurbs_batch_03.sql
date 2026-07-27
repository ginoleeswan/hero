-- Relationship blurbs, batch 03. First 100 pairs of the SAME-CAST band.
--
-- 43 written, 55 nothing_to_say, 2 no_relationship. Decline rate 57%, against
-- batch 02's 62% — and the writes are markedly better, because this band is
-- whole ensembles rather than crossover adjacency: the Star Wars principals,
-- the Simpsons, the Enterprise bridge, the Guardians.
--
-- The declines here are a different shape from batch 02's. These are real
-- cast-mates with no relationship OF THEIR OWN — Yoda and Chewbacca share a
-- saga and never a scene; Boba Fett is in the same films as R2-D2 and has
-- nothing to do with him. That is exactly what the templated fallback is for.
--
-- Flagged while authoring, NOT fixed here: 'Captain Marvel' (156) and
-- 'Carol Danvers' (cv-21561) are the same character in two rows, and the queue
-- offers pairs against both. That is the numeric/cv duplicate pattern, and it
-- needs a merge, not a blurb.

insert into public.hero_relationship_blurbs
  (hero_a, hero_b, blurb, author, verified, status, note, kind_correction)
values
-- ── Star Wars ─────────────────────────────────────────────────────────────
('cv-2206', 'cv-6335', 'Obi-Wan Kenobi knew C-3PO for years before A New Hope, and greets him there with "I don''t seem to remember ever owning a droid." The prequels turned a throwaway line into a lie he tells a boy about his father.', 'claude', false, 'written', null, null),
('cv-2206', 'cv-2608', 'Obi-Wan hired Han Solo as transport and spent the trip being told the Force was a myth. Solo took the money, mocked the religion, and came back at Yavin anyway — after Kenobi was already dead.', 'claude', false, 'written', null, null),
('cv-2206', 'cv-33545', 'Leia Organa''s message — "Help me, Obi-Wan Kenobi. You''re my only hope" — is the line that starts the saga. She is asking a stranger in the desert who is in fact her father''s old master, and neither of them ever learns she is his charge.', 'claude', false, 'written', null, null),
('cv-2206', 'cv-2594', 'R2-D2 served alongside Obi-Wan through the entire Clone Wars, and in A New Hope Kenobi looks straight at him and claims no memory of ever owning a droid. R2 says nothing, which is the joke and also the tragedy.', 'claude', false, 'written', null, null),
('729', 'cv-2206', 'Yoda trained Obi-Wan Kenobi and then watched him lose Anakin Skywalker. After Order 66 they are the last two Jedi alive, and they split up into separate exiles to wait for the children.', 'claude', false, 'written', null, null),
('cv-33545', 'cv-6335', 'C-3PO is Leia Organa''s protocol droid, and she had his memory wiped at the end of the prequels so he could never say whose daughter she was. He spends the original films fussing over a woman he helped raise and does not know it.', 'claude', false, 'written', null, null),
('cv-33545', 'cv-6334', 'Leia Organa and Chewbacca are the two people who loved Han Solo most, and the only ones on screen when he dies. The embrace she gives the Wookiee afterwards is the scene the film is built around.', 'claude', false, 'written', null, null),
('cv-2594', 'cv-6335', 'The whole saga is told through two droids who bicker: Lucas lifted them from Kurosawa''s The Hidden Fortress, where the story reaches you through its two least important characters. Neither ever stops being annoyed with the other.', 'claude', false, 'written', null, null),
('cv-2594', 'cv-6334', 'Chewbacca and R2-D2 play holochess on the Falcon, and Han Solo''s advice on losing to a Wookiee — let him win — is the film''s first joke about what Chewbacca is capable of.', 'claude', false, 'written', null, null),
('cv-2594', 'cv-33545', 'Leia Organa loaded the Death Star plans into R2-D2 and sent him to a desert planet on the strength of one name. Every event in the trilogy follows from her trusting an astromech with the only copy.', 'claude', false, 'written', null, null),
('cv-16164', 'cv-2206', 'Obi-Wan Kenobi sat in the same room as Palpatine for a decade without recognising the Sith Lord, while Palpatine took his apprentice apart in front of him. Kenobi''s failure is the one the whole prequel trilogy is about.', 'claude', false, 'written', null, null),
('418', 'cv-16164', 'Palpatine spent the throne-room scene trying to make Luke Skywalker kill his own father, because a son who strikes in anger becomes the next apprentice. Luke throws the lightsaber away, and it is the only thing that works.', 'claude', false, 'written', null, null),
('729', 'cv-16164', 'Yoda and Palpatine fight in the Senate chamber, the two most powerful practitioners alive, and Yoda loses. He goes into exile in a swamp having concluded the Jedi were beaten long before the duel.', 'claude', false, 'written', null, null),
('127', 'cv-2608', 'Boba Fett tracked Han Solo to Bespin, waited while Vader tested the carbonite on him, and flew the body to Jabba the Hutt for the bounty. He is the only person who ever actually collected on Solo.', 'claude', false, 'written', null, null),
('cv-2608', 'cv-5441', 'Han Solo dumped a shipment when he was boarded and has owed Jabba the Hutt for it ever since. That debt is the reason a smuggler needed a charter to Alderaan, which is to say the reason the plot happens.', 'claude', false, 'written', null, null),
('cv-5441', 'cv-6335', 'Jabba the Hutt kept C-3PO as his court interpreter, which is the only job the droid was ever actually built for and the worst place he ever held it. He watches the previous interpreter dropped through a trapdoor.', 'claude', false, 'written', null, null),
('418', 'cv-5441', 'Luke Skywalker walked into Jabba''s palace alone to buy back a friend, was dropped into the rancor pit for it, and destroyed the sail barge on the way out. It is the first time he is written as something other than a farm boy.', 'claude', false, 'written', null, null),
('cv-33545', 'cv-5441', 'Leia Organa infiltrated Jabba''s palace to free Han Solo, was caught, chained and put on display — and then strangled Jabba with the chain he had put her in. The film gives the kill to her, deliberately.', 'claude', false, 'written', null, null),
('398', 'cv-2608', 'Ben Solo is Han Solo''s son, and the sequel trilogy''s turning point is the boy calling his father onto a bridge to ask for help and running him through instead. Han reaches up to touch his face first.', 'claude', false, 'written', null, null),
('398', '418', 'Luke Skywalker trained his nephew, saw what was growing in him, and ignited a lightsaber over a sleeping boy before thinking better of it. Kylo Ren woke up for that instant, and it is the whole reason he left.', 'claude', false, 'written', null, null),
('398', 'cv-33545', 'Leia Organa sent her son away to be trained and got back the man who killed his father. She never stops calling him Ben, which is the only weapon in the trilogy that visibly works on him.', 'claude', false, 'written', null, null),
('398', 'cv-6334', 'Chewbacca watched Kylo Ren kill Han Solo and put a bowcaster bolt through him for it — a weapon the films had spent a scene establishing throws grown men across a room. Ren limps through the rest of the film.', 'claude', false, 'written', null, null),
-- ── Marvel ────────────────────────────────────────────────────────────────
('cv-3200', 'cv-3202', 'Nick Fury is the man who brought Natasha Romanoff over and has been her handler ever since, which means he is also the only person who knows the full ledger she is trying to work off.', 'claude', false, 'written', null, null),
('313', 'cv-4324', 'Loki took Clint Barton''s mind with a touch and used him as a weapon against his own people. Barton spends everything after it working out what part of the damage was actually him.', 'claude', false, 'written', null, null),
('346', 'cv-21561', 'Carol Danvers and Tony Stark split the superhero community in half over whether to act on a prediction of a crime — she for, he against. Civil War II is Stark arguing for the presumption of innocence and losing.', 'claude', false, 'written', null, null),
('630', '655', 'Thanos raised Gamora after killing her people, which makes Peter Quill''s grievance with him second-hand and completely genuine. Quill is the one who blows the plan by hitting him.', 'claude', false, 'written', null, null),
('714', 'cv-3200', 'The Winter Soldier trained Natasha Romanoff in the Red Room, and in some tellings they were together there. They are the two people in the Avengers who were made rather than recruited.', 'claude', false, 'written', null, null),
('106', '714', 'Wakanda gave Bucky Barnes sanctuary when no other country would, and T''Challa''s scientists took the trigger words out of his head. T''Challa did it having spent a film believing Barnes killed his father.', 'claude', false, 'written', null, null),
('423', '638', 'Magneto ran Xavier''s school while Xavier was presumed dead, with Storm as his field leader — the closest the X-Men have come to being led by the man they were founded against. She never once deferred to him.', 'claude', false, 'written', null, null),
('566', 'h_39f78998-cf7e-411c-a5a9-810f483a3675', 'Rocket is the only one who understands what Groot is saying, which makes a talking tree with three words of vocabulary into a character and Rocket into the person who speaks for him.', 'claude', false, 'written', null, null),
-- ── DC ────────────────────────────────────────────────────────────────────
('643', 'cv-1808', 'Lois Lane married Kara Zor-El''s cousin, which makes a Pulitzer-winning reporter the closest thing Supergirl has to an aunt. Lois is also the only Kryptonian in-law who has never once been impressed by the powers.', 'claude', false, 'written', null, null),
('644', 'cv-4916', 'Black Adam has Superman''s power and none of the restraint, which is the entire point of him — a champion from a culture that never asked its heroes to hold back. Superman keeps trying to talk; Adam considers that the flaw.', 'claude', false, 'written', null, null),
-- ── Everything else ───────────────────────────────────────────────────────
('cv-52213', 'h_87117684-4467-403b-a57c-2cad3d23ebb1', 'Ash Ketchum''s Pikachu refused to go in the Poké Ball on day one and has never been in one since, which is the entire premise: the one Pokémon in the franchise who is a companion rather than equipment.', 'claude', false, 'written', null, null),
('h_58c98d94-8f76-48a2-9adb-9ee7de1c41aa', 'h_7906ea98-fdb9-4e3f-9fca-1f905fe003c5', 'Peter Pan cut off Captain Hook''s hand and fed it to a crocodile, which then developed a taste for him and follows him for the rest of his life. The ticking clock in its stomach is the sound of Hook''s fear of growing old.', 'claude', false, 'written', null, null),
('cv-3399', 'cv-3401', 'Homer Simpson strangles his son as a running gag and the show has never once pretended it is anything else. Bart is the child Homer understands completely, which is the problem with both of them.', 'claude', false, 'written', null, null),
('cv-3399', 'cv-3402', 'Lisa Simpson is smarter than her father will ever be and loves him anyway, and the show''s best episodes are the ones where Homer notices. He is aware he is failing her, which is more than he manages for anyone else.', 'claude', false, 'written', null, null),
('cv-3399', 'cv-3400', 'Marge Simpson has stayed married to Homer through thirty-five years of ruin, and the show has repeatedly had to invent a reason. The honest answer it keeps returning to is that he is never once dishonest with her.', 'claude', false, 'written', null, null),
('cv-3401', 'cv-3402', 'Bart and Lisa Simpson are the show''s two halves — the boy who cannot be taught and the girl nobody will teach — and they close ranks completely the moment anyone outside the family threatens either of them.', 'claude', false, 'written', null, null),
('cv-3400', 'cv-3401', 'Marge Simpson is the only person Bart genuinely does not want to disappoint, which the show uses sparingly and lethally. His worst punishments are the episodes where she is not angry.', 'claude', false, 'written', null, null),
('353', '627', 'Kirk and Spock are the argument the whole of Star Trek is built on — instinct against logic, with McCoy holding the coats. Spock dies to save the ship and tells Kirk the needs of the many outweigh the needs of the few.', 'claude', false, 'written', null, null),
('353', '357', 'Two captains of the Enterprise who meet exactly once, in Generations, seventy-eight years apart. Picard has to talk Kirk out of a paradise built from his own regrets in order to get help saving a star system.', 'claude', false, 'written', null, null),
('357', '627', 'Picard found Spock on Romulus pursuing reunification alone and unsanctioned, and mind-melded with Sarek to carry a father''s feeling to a son who had never heard it. It is the closest Star Trek comes to an inheritance.', 'claude', false, 'written', null, null),
('228', '450', 'Donatello and Michelangelo are brothers by mutation, named for Renaissance painters by a rat who learned about them from a book. Donatello builds what the team needs and Michelangelo is why they need it.', 'claude', false, 'written', null, null),
('cv-4103', 'cv-6467', 'Optimus Prime and Megatron were the same rank before the war and disagree about whether freedom is the right of all sentient beings or a thing the strong take. Forty years of the franchise is that argument, restated.', 'claude', false, 'written', null, null),
-- ── Declines ──────────────────────────────────────────────────────────────
('cv-1691', 'cv-3718', null, 'claude', false, 'nothing_to_say', 'Riddler is Batman''s; nothing durable with Nightwing', null),
('cv-2206', 'cv-6334', null, 'claude', false, 'nothing_to_say', 'same saga, no scene of consequence between them', null),
('cv-3718', 'cv-4885', null, 'claude', false, 'nothing_to_say', 'both Gotham rogues; no relationship of their own', null),
('659', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'Avengers roster only; nothing specific', null),
('729', 'cv-6335', null, 'claude', false, 'nothing_to_say', 'same saga, never share a scene', null),
('729', 'cv-6334', null, 'claude', false, 'nothing_to_say', 'same saga, never share a scene', null),
('729', 'cv-33545', null, 'claude', false, 'nothing_to_say', 'Yoda names her as "another" but they never meet', null),
('729', 'cv-2594', null, 'claude', false, 'nothing_to_say', 'R2 is present on Dagobah and that is all', null),
('30', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('69', 'cv-4916', null, 'claude', false, 'nothing_to_say', 'League-wide antagonism; nothing between these two', null),
('106', 'cv-4324', null, 'claude', false, 'nothing_to_say', 'crossover adjacency only', null),
('106', '659', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('226', '659', null, 'claude', false, 'nothing_to_say', 'Avengers roster only; the Ragnarok scene is a gag, not a tie', null),
('cv-16164', 'cv-6335', null, 'claude', false, 'nothing_to_say', 'same saga, no relationship', null),
('cv-16164', 'cv-6334', null, 'claude', false, 'nothing_to_say', 'same saga, no relationship', null),
('cv-16164', 'cv-2608', null, 'claude', false, 'nothing_to_say', 'same saga, never meet', null),
('cv-16164', 'cv-33545', null, 'claude', false, 'nothing_to_say', 'same saga, never meet in the original trilogy', null),
('cv-16164', 'cv-2594', null, 'claude', false, 'nothing_to_say', 'same saga, no relationship', null),
('332', 'cv-21561', null, 'claude', false, 'nothing_to_say', 'crossover adjacency only', null),
('cv-2859', 'cv-2861', null, 'claude', false, 'nothing_to_say', 'both are Bugs Bunny''s foils; no relationship with each other', null),
('h_09ea65ab-25c6-4bde-95c9-787e866d974b', 'h_fe4d8b42-81a9-4438-89a0-a7b51ed195ec', null, 'claude', false, 'nothing_to_say', 'both Olympians; no myth of their own together', null),
('655', 'h_39f78998-cf7e-411c-a5a9-810f483a3675', null, 'claude', false, 'nothing_to_say', 'Infinity-era adjacency; nothing specific', null),
('720', 'cv-4916', null, 'claude', false, 'nothing_to_say', 'League-wide antagonism; nothing between these two', null),
('30', '313', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('106', '30', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('127', 'cv-6335', null, 'claude', false, 'nothing_to_say', 'same saga, no relationship', null),
('127', 'cv-6334', null, 'claude', false, 'nothing_to_say', 'same saga, no relationship', null),
('127', '418', null, 'claude', false, 'nothing_to_say', 'share the sail barge sequence and nothing else', null),
('127', 'cv-2206', null, 'claude', false, 'nothing_to_say', 'never meet; the Jango connection is Mace Windu''s', null),
('127', 'cv-33545', null, 'claude', false, 'nothing_to_say', 'same saga, no relationship', null),
('127', 'cv-2594', null, 'claude', false, 'nothing_to_say', 'same saga, no relationship', null),
('127', '729', null, 'claude', false, 'nothing_to_say', 'never meet', null),
('149', '156', null, 'claude', false, 'nothing_to_say', 'Avengers roster only; and see the Captain Marvel duplicate note', null),
('156', '346', null, 'claude', false, 'nothing_to_say', 'duplicate row of Carol Danvers; the real pair is 346/cv-21561', null),
('226', '30', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('226', '714', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('313', 'cv-3202', null, 'claude', false, 'nothing_to_say', 'handler and asset; nothing specific to these two', null),
('313', '714', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('566', '655', null, 'claude', false, 'nothing_to_say', 'Infinity-era adjacency; nothing specific', null),
('630', 'h_39f78998-cf7e-411c-a5a9-810f483a3675', null, 'claude', false, 'nothing_to_say', 'Guardians roster; the tie that matters is Rocket''s', null),
('30', '659', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('38', 'cv-4916', null, 'claude', false, 'nothing_to_say', 'League-wide antagonism; nothing between these two', null),
('cv-21561', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('cv-5441', 'cv-6334', null, 'claude', false, 'nothing_to_say', 'same scenes, no relationship', null),
('cv-2206', 'cv-5441', null, 'claude', false, 'nothing_to_say', 'never meet', null),
('cv-2594', 'cv-5441', null, 'claude', false, 'nothing_to_say', 'same scenes, no relationship', null),
('729', 'cv-5441', null, 'claude', false, 'nothing_to_say', 'never meet', null),
('566', '630', null, 'claude', false, 'nothing_to_say', 'Guardians roster; nothing specific to the pair', null),
('659', 'cv-3202', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('659', '714', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('cv-4916', 'h_2ace1789-18f4-43bb-8f5f-030acaed0471', null, 'claude', false, 'nothing_to_say', 'League-wide antagonism; nothing between these two', null),
('156', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'duplicate row of Carol Danvers; see the note above', null),
('226', 'cv-21561', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('398', 'cv-6335', null, 'claude', false, 'no_relationship', 'C-3PO and Kylo Ren never interact; the edge is an artifact', null),
('398', 'cv-2594', null, 'claude', false, 'no_relationship', 'R2-D2 and Kylo Ren never interact; the edge is an artifact', null)
on conflict (hero_a, hero_b) do nothing;
