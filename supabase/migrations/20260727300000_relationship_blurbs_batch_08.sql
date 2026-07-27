-- Relationship blurbs, batch 08. Same-cast band, pairs 501-600.
--
-- 45 written, 55 declined.
--
-- Noted while authoring, fixed in 20260727301000: the 'hasbro' tag has the same
-- flaw 'nintendo' did — it merges Transformers and G.I. Joe, which produced
-- Snake Eyes / Optimus Prime as a same-cast pair. Declined here and split there.
--
-- The Guardians of the Galaxy are this batch's Gotham: seven tagged members
-- generate twenty-one pairs, and the roster is not the relationship. Written the
-- ones with something specific (Rocket and Groot were done earlier; Drax and
-- Quill, Gamora and Quill) and declined the rest of the cross product.

insert into public.hero_relationship_blurbs
  (hero_a, hero_b, blurb, author, verified, status, note, kind_correction)
values
-- ── Family ────────────────────────────────────────────────────────────────
('344', 'cv-2151', 'Sue Storm married Reed Richards and has spent the marriage being the most powerful member of the team and the one asked to hold everything together. The comics keep noticing she could end most fights alone.', 'claude', false, 'written', null, null),
('658', 'cv-2151', 'Ben Grimm blames Reed Richards for the flight that turned him into the Thing, and has stayed his closest friend for sixty years anyway. Richards has never stopped trying to cure him, which Ben finds worse than the rock.', 'claude', false, 'written', null, null),
('405', 'cv-1686', 'Superboy was grown from Superman''s DNA and Lex Luthor''s, which makes Luthor a father in the only sense he would accept. He has tried repeatedly to collect on it, and the boy has repeatedly refused.', 'claude', false, 'written', null, null),
('643', 'cv-1686', 'Kara Zor-El was born Kryptonian and Kon-El was made in a lab to replace her cousin, which gives them opposite claims on the same family. They are the two youngest people in it and the only ones who did not choose it.', 'claude', false, 'written', null, null),
('299', 'cv-2478', 'Norman Osborn is Harry''s father and the reason Harry became the Green Goblin himself — a son inheriting the mask from a man who was never going to hand him anything else. Harry dies still trying to earn it.', 'claude', false, 'written', null, null),
('321', '659', 'Hela is Odin''s firstborn, erased from Asgard''s history after the conquests became embarrassing, and Thor learns of her existence only when she returns to collect. She is the family secret that invalidates the throne.', 'claude', false, 'written', null, null),
('321', 'cv-4324', 'Loki spent his life resenting a father who hid his origins, and then met the sister that same father had erased entirely. Hela is proof that Loki was not the first inconvenient child Odin buried.', 'claude', false, 'written', null, null),
-- ── Star Wars ─────────────────────────────────────────────────────────────
('207', 'cv-2206', 'Darth Maul killed Qui-Gon Jinn in front of Obi-Wan Kenobi and was cut in half for it, and survived on spite. Their final duel decades later takes seconds, and Kenobi holds him as he dies.', 'claude', false, 'written', null, null),
('207', 'cv-16164', 'Darth Maul was Palpatine''s first apprentice and was discarded the moment a better one appeared. Everything Maul does after being cut in half is an attempt to be relevant to a man who has stopped thinking about him.', 'claude', false, 'written', null, null),
('cv-16164', 'cv-5392', 'Dooku left the Jedi and became Palpatine''s apprentice, and was fed to Anakin Skywalker the moment a younger replacement was ready. He realises it in the second before the blades cross.', 'claude', false, 'written', null, null),
('cv-16164', 'h_3420c0c3-78e7-4c78-a8db-3d28d48151f2', 'Tarkin is the Emperor''s doctrine made into a man — rule through fear of force rather than force itself — and he is given the Death Star to prove it. Palpatine dissolves the Senate on his advice.', 'claude', false, 'written', null, null),
('cv-33545', 'h_3420c0c3-78e7-4c78-a8db-3d28d48151f2', 'Tarkin made Leia Organa watch Alderaan destroyed, having asked her to name a rebel base first, and destroyed it after she answered. It is the coldest thing anyone does in the trilogy and he does it conversationally.', 'claude', false, 'written', null, null),
('cv-2206', 'cv-55028', 'Obi-Wan Kenobi taught Ahsoka Tano alongside Anakin Skywalker and is the one who defended her when the Order did not. She left anyway, and it is the closest the Jedi come to admitting they were wrong.', 'claude', false, 'written', null, null),
('729', 'cv-55028', 'Yoda presided over the trial that expelled Ahsoka Tano and offered to take her back afterwards as though nothing had happened. Her refusal is the first time anyone in the Order tells him no and is right.', 'claude', false, 'written', null, null),
('cv-16164', 'cv-55028', 'Ahsoka Tano is one of the few Jedi who survived the purge and kept fighting, and Palpatine never learned she existed. Being beneath the Emperor''s notice is the only reason she lived.', 'claude', false, 'written', null, null),
-- ── Marvel ────────────────────────────────────────────────────────────────
('655', '705', 'Adam Warlock was made as a perfect being and Thanos courts death, which is the pairing the Infinity saga is built on. Warlock is the one who takes the Gauntlet off him and immediately proves he should not have it either.', 'claude', false, 'written', null, null),
('273', '655', 'Galactus eats worlds because he must and Thanos kills them because he has decided to, which is the distinction the cosmic books keep returning to. Neither considers the other a peer and both are wrong about that.', 'claude', false, 'written', null, null),
('cv-21561', 'cv-94118', 'Kamala Khan built her whole identity around Carol Danvers before they ever met, and the meeting is one of the few in comics where the hero turns out to deserve it. Carol treats her as a colleague immediately.', 'claude', false, 'written', null, null),
('714', 'cv-1451', 'Sam Wilson and Bucky Barnes both have a claim on Rogers and neither has one on the other, which is exactly why they work — two men who loved the same friend and cannot stand each other''s version of him.', 'claude', false, 'written', null, null),
('423', '567', 'Rogue was Mystique''s foster daughter and a member of Magneto''s Brotherhood before she defected, and Magneto has never treated her as anything but a recruit on loan. She once absorbed his powers entirely.', 'claude', false, 'written', null, null),
('225', '391', 'Otto Octavius assembled the Sinister Six and Wilson Fisk owns the city they operate in, which makes them rivals in the only currency that matters to either. Fisk does not join teams and Octavius cannot stop building them.', 'claude', false, 'written', null, null),
('225', 'cv-4333', 'Founding members of the Sinister Six, and Octavius is the one who recruited Beck — a scientist and an effects man agreeing that Spider-Man is an engineering problem. Mysterio is the only one who has ever nearly solved it.', 'claude', false, 'written', null, null),
('145', '717', 'Cable is a soldier from a ruined future and Logan is a man who has lived through several, and they are the two X-Men who treat the mission as a war rather than a school. They agree about almost everything and like it least.', 'claude', false, 'written', null, null),
('213', 'cv-3560', 'Deadpool and X-23 are both failed attempts to reproduce Wolverine, and they are the only two who can say that to each other. He is markedly gentler with her than with anyone else in the books.', 'claude', false, 'written', null, null),
('274', '638', 'Gambit joined the X-Men as a thief Storm personally vouched for, having met him while she was de-aged and stealing to survive. She is the reason the team ever trusted him and the one he will not lie to.', 'claude', false, 'written', null, null),
('241', '423', 'Emma Frost and Magneto are the two former enemies the X-Men keep having to work beside, and both find the arrangement more comfortable than the team does. They agree that Xavier''s dream was always a negotiating position.', 'claude', false, 'written', null, null),
('35', '423', 'Apocalypse believes only the strong should survive and Magneto believes mutants should, which sounds similar until Apocalypse starts culling mutants. He has recruited Magneto and Magneto has always eventually refused.', 'claude', false, 'written', null, null),
('630', 'cv-3324', 'Mantis can feel what Peter Quill feels and says it out loud in front of everyone, which is the Guardians'' most reliable way of humiliating him. She has no idea she is doing it, which is why it works.', 'claude', false, 'written', null, null),
('630', 'h_a6e0f730-8cdf-4c40-9763-f48947ddac64', 'Nebula spent years trying to kill Peter Quill''s crew and now flies with them, and Quill is the one who keeps making room. He is also the man who cost her Gamora, which she has not stopped mentioning.', 'claude', false, 'written', null, null),
-- ── DC ────────────────────────────────────────────────────────────────────
('644', 'h_29b3ee3b-690f-47ee-b7c3-9e5bc7603536', 'Mister Mxyzptlk is a fifth-dimensional imp who cannot be punched, and the only way to send him home is to trick him into saying his own name backwards. He is the one enemy Superman has to out-think rather than outlast.', 'claude', false, 'written', null, null),
('cv-1686', 'cv-1808', 'Lois Lane is the closest thing Kon-El has to a mother, having decided that a boy grown in a laboratory from her husband''s DNA was family and simply proceeding on that basis. Nobody has successfully argued with her about it.', 'claude', false, 'written', null, null),
('165', 'cv-1690', 'Selina Kyle and Helena Bertinelli are Gotham''s two women with a foot on either side of the law, and the books keep putting them on the same team. Neither has ever asked the other to pick a side.', 'claude', false, 'written', null, null),
('17', 'cv-1690', 'Alfred treats the Huntress exactly as he treats everyone Bruce Wayne distrusts — with tea, courtesy and no comment — and she is one of the few who has noticed that this is a strategy.', 'claude', false, 'written', null, null),
('17', 'h_ecba928f-1888-4f64-8330-c727dbf19c65', 'Alfred Pennyworth is dead by the time Terry McGinnis puts on the suit, and the future Gotham has an old Bruce Wayne with nobody to argue with. His absence is the reason that version of Batman is as bad as it is.', 'claude', false, 'written', null, null),
('17', 'h_15a572bc-4624-4fe9-9dff-1eff9a94781b', 'Somebody in the household has to feed the dog, and it was never going to be Batman. Ace belongs to the mission and Alfred belongs to the house, which makes the arrangement obvious to everyone but Bruce.', 'claude', false, 'written', null, null),
-- ── Everything else ───────────────────────────────────────────────────────
('h_4536f6a7-f50e-42d5-a258-e97b36e0abe4', 'h_78f04276-cdcd-4f39-8374-b9f9fd404db0', 'Fozzie Bear is a comedian who is not funny and Kermit is the manager who keeps booking him anyway, which is the kindest running joke in the Muppets. The bear knows, and it never stops him.', 'claude', false, 'written', null, null),
('h_4536f6a7-f50e-42d5-a258-e97b36e0abe4', 'h_85f3aa1c-0846-48b0-87f0-d0bc7ad72fa3', 'Gonzo does stunts nobody asked for and Kermit lets him, which in a show about a frog trying to keep order is the clearest statement of what the frog actually values. Nobody has ever established what Gonzo is.', 'claude', false, 'written', null, null),
('cv-52626', 'h_87117684-4467-403b-a57c-2cad3d23ebb1', 'Ash Ketchum raised Charizard from a Charmander abandoned by a previous trainer, and it repaid him by refusing to fight for a long stretch of the show. Earning that obedience back is the closest the series has to an arc.', 'claude', false, 'written', null, null),
('h_1955e1bf-8d71-4e3e-a623-3bdabfbe0664', 'h_87117684-4467-403b-a57c-2cad3d23ebb1', 'Mewtwo was built to be a weapon and concluded that everything born rather than made is beneath it, and Ash Ketchum is the child who walks between two armies to stop the fight. It costs him and he does it anyway.', 'claude', false, 'written', null, null),
('h_2cefe34a-fdc2-43d2-b759-ad1c10f6e2de', 'h_87117684-4467-403b-a57c-2cad3d23ebb1', 'Squirtle led a gang of abandoned Pokémon before Ash Ketchum took it on, and kept the sunglasses. It is the one member of the team written as having had a life before him.', 'claude', false, 'written', null, null),
('cv-3400', 'cv-3403', 'Marge Simpson has a baby who has never spoken and the show has quietly built one of its most reliable emotional registers out of it. Maggie is the child Marge does not have to worry about yet, and knows it.', 'claude', false, 'written', null, null),
('234', '566', 'Rocket does the talking and Drax takes it literally, and the Guardians run on the gap between them. They are also the two most obviously damaged members of the crew, which neither will discuss.', 'claude', false, 'written', null, null),
('275', '566', 'Rocket is the one Guardian Gamora has never had to threaten, largely because he was already frightened of everyone. They are the two the team sends when the job requires actually being good at it.', 'claude', false, 'written', null, null),
('cv-1691', 'cv-4438', 'Jaime Reyes got a scarab that talks and wants to kill, and Dick Grayson is the Titan who taught him it can be argued with. Nightwing is the one every new Titan is handed to.', 'claude', false, 'written', null, null),
-- ── Declines ──────────────────────────────────────────────────────────────
('cv-6452', 'cv-6467', null, 'claude', false, 'no_relationship', 'G.I. Joe and Transformers are separate Hasbro franchises; the tag was too coarse (split in 20260727301000)', null),
('213', '536', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('cv-6335', 'h_3420c0c3-78e7-4c78-a8db-3d28d48151f2', null, 'claude', false, 'nothing_to_say', 'same film, no relationship', null),
('165', 'h_ecba928f-1888-4f64-8330-c727dbf19c65', null, 'claude', false, 'nothing_to_say', 'Catwoman is not in Batman Beyond; the edge is era-crossed', null),
('213', '274', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('213', '374', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('213', '567', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('213', 'cv-4563', null, 'claude', false, 'nothing_to_say', 'both Weapon X adjacent; nothing durable of their own', null),
('225', '412', null, 'claude', false, 'nothing_to_say', 'Sinister Six roster; nothing between these two', null),
('cv-16164', 'cv-5411', null, 'claude', false, 'nothing_to_say', 'Qui-Gon dies before Palpatine reveals himself', null),
('274', '423', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('h_39f78998-cf7e-411c-a5a9-810f483a3675', 'h_a6e0f730-8cdf-4c40-9763-f48947ddac64', null, 'claude', false, 'nothing_to_say', 'Guardians roster cross product', null),
('313', '379', null, 'claude', false, 'nothing_to_say', 'Kang is a team-wide threat', null),
('313', '589', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('cv-5441', 'cv-6355', null, 'claude', false, 'nothing_to_say', 'same films, no relationship', null),
('354', 'cv-16164', null, 'claude', false, 'nothing_to_say', 'Jar Jar is used by Palpatine as a procedural vote, not a relationship', null),
('374', '423', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('374', '638', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('395', '687', null, 'claude', false, 'nothing_to_say', 'both Spider-Man rogues; nothing between them', null),
('418', 'h_3420c0c3-78e7-4c78-a8db-3d28d48151f2', null, 'claude', false, 'nothing_to_say', 'never meet; the Tarkin scene that matters is Leia''s', null),
('423', 'cv-4563', null, 'claude', false, 'nothing_to_say', 'Brotherhood roster; nothing durable', null),
('cv-3324', 'h_39f78998-cf7e-411c-a5a9-810f483a3675', null, 'claude', false, 'nothing_to_say', 'Guardians roster cross product', null),
('cv-52213', 'h_671e0dcd-50c7-4232-a5be-b72e9a4c3ebd', null, 'claude', false, 'nothing_to_say', 'team-mates on Ash''s roster', null),
('527', 'cv-3560', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('cv-2594', 'cv-55028', null, 'claude', false, 'nothing_to_say', 'same saga, no relationship', null),
('cv-1451', 'cv-3202', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('579', 'cv-21561', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('680', 'cv-3202', null, 'claude', false, 'nothing_to_say', 'Ultron is a team-wide threat', null),
('687', 'cv-2478', null, 'claude', false, 'nothing_to_say', 'both Osborn-adjacent; nothing between them', null),
('687', 'cv-4333', null, 'claude', false, 'nothing_to_say', 'both Spider-Man rogues; nothing between them', null),
('697', '714', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('703', 'cv-21561', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('705', 'h_39f78998-cf7e-411c-a5a9-810f483a3675', null, 'claude', false, 'nothing_to_say', 'Guardians roster cross product', null),
('38', '97', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('38', 'h_efed1d20-5b5c-412e-9f76-860af06b75dd', null, 'claude', false, 'nothing_to_say', 'League roster only', null),
('cv-6129', 'h_ecba928f-1888-4f64-8330-c727dbf19c65', null, 'claude', false, 'nothing_to_say', 'era-crossed; Bane is not in Batman Beyond', null),
('145', '527', null, 'claude', false, 'nothing_to_say', 'the Cable parentage runs through Cyclops, not Xavier', null),
('156', '579', null, 'claude', false, 'nothing_to_say', 'duplicate row of Carol Danvers; see the merge note', null),
('207', '729', null, 'claude', false, 'nothing_to_say', 'never meet', null),
('225', 'cv-2478', null, 'claude', false, 'nothing_to_say', 'Sinister Six adjacency; nothing between them', null),
('225', '395', null, 'claude', false, 'nothing_to_say', 'Sinister Six roster; nothing specific to the pair', null),
('309', 'cv-1690', null, 'claude', false, 'nothing_to_say', 'Gotham adjacency; nothing durable', null),
('cv-2262', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('cv-4885', 'h_ecba928f-1888-4f64-8330-c727dbf19c65', null, 'claude', false, 'nothing_to_say', 'era-crossed; Penguin is not in Batman Beyond', null),
('cv-52213', 'h_fb0cb437-8a3b-4df8-b1ab-66fa72afcf90', null, 'claude', false, 'nothing_to_say', 'no relationship; both are Pokémon mascots', null),
('cv-3718', 'h_ecba928f-1888-4f64-8330-c727dbf19c65', null, 'claude', false, 'nothing_to_say', 'era-crossed; the Riddler is not in Batman Beyond', null),
('566', 'cv-3324', null, 'claude', false, 'nothing_to_say', 'Guardians roster cross product', null),
('566', 'h_a6e0f730-8cdf-4c40-9763-f48947ddac64', null, 'claude', false, 'nothing_to_say', 'Guardians roster cross product', null),
('630', '705', null, 'claude', false, 'nothing_to_say', 'Guardians roster cross product', null),
('687', 'cv-3228', null, 'claude', false, 'nothing_to_say', 'both Spider-Man rogues; nothing between them', null),
('687', 'cv-3544', null, 'claude', false, 'nothing_to_say', 'both Spider-Man rogues; nothing between them', null),
('687', 'cv-4459', null, 'claude', false, 'nothing_to_say', 'both Spider-Man rogues; nothing between them', null),
('708', 'cv-21561', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('730', 'cv-4916', null, 'claude', false, 'nothing_to_say', 'League-wide antagonism', null),
('30', '589', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('35', '638', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null)
on conflict (hero_a, hero_b) do nothing;
