-- Relationship blurbs, batch 06. Same-cast band, pairs 301-400.
--
-- 45 written, 55 nothing_to_say. First batch under the TIGHTENED CONTRACT.
--
-- The old rule was "one concrete, checkable fact", and it was quietly pushing
-- toward citation-precision — issue numbers, cover dates, page counts. That is
-- exactly where an assertion can be wrong, and at scale it would have mattered.
-- An audit of the 242 blurbs written before this batch found 12 carrying a hard
-- citation; all but one check out, and the survivor ("dead by the eleventh page
-- of Amazing Fantasy #15" — the story runs eleven pages) is softened below.
--
-- New rule: a blurb may be SPECIFIC without being PRECISE. "Killed by a burglar
-- Peter chose not to stop" is certain. The page number is decoration carrying
-- risk for no gain. No issue numbers, cover dates or run lengths unless the fact
-- is both load-bearing and certain. Uncertainty still resolves to a decline.
--
-- The write rate went UP under the tighter rule — 45 against the previous
-- batches' 34-36 — because a number of pairs I knew but could not anchor to a
-- citation I trusted are now writable on the relationship alone.

-- The audit's one softening fix lives in 20260727275000; this file is inserts
-- only, which the apply script now requires.

insert into public.hero_relationship_blurbs
  (hero_a, hero_b, blurb, author, verified, status, note, kind_correction)
values
-- ── Blood ties the graph filed as something else ──────────────────────────
('332', '589', 'Jennifer Walters is Bruce Banner''s cousin, and got her powers from an emergency transfusion of his blood. She kept her mind and her career, which is the joke: the same accident, and only one of them lost everything.', 'claude', false, 'written', null, null),
('275', '655', 'Thanos killed Gamora''s people and raised her himself, turning the survivor into the weapon. She is written as the one thing he loves, which the story eventually makes him prove in the worst available way.', 'claude', false, 'written', null, null),
('423', '579', 'Wanda Maximoff was written as Magneto''s daughter for decades before Marvel took it back, and the retraction has never fully stuck. Both versions run on the same idea — the most dangerous mutant alive, and a father who was absent for it.', 'claude', false, 'written', null, null),
('643', 'h_89ff9c2c-5768-483b-be41-e723ef0df460', 'Jor-El is Kara Zor-El''s uncle, and unlike her cousin she actually knew him. Superman has a recording of his father; Supergirl has a memory, which is the difference between the two characters in one fact.', 'claude', false, 'written', null, null),
-- ── Spider-Man's rogues ───────────────────────────────────────────────────
('162', '620', 'Cletus Kasady was a serial killer before the symbiote found him, which is what makes Carnage different from Venom — the alien is not the problem, it is the passenger. Spider-Man needs Venom''s help to stop him.', 'claude', false, 'written', null, null),
('620', 'cv-3228', 'Max Dillon is a lineman who can throw lightning and has never once had a plan bigger than a bank. Electro is the rogue Spider-Man beats with water and physics homework rather than strength.', 'claude', false, 'written', null, null),
('620', 'cv-3544', 'Flint Marko turns to sand to feed a sick daughter, which the comics have used to move him between villain and ally for decades. He is the Spider-Man rogue most often written as someone who could stop.', 'claude', false, 'written', null, null),
('620', 'cv-4459', 'Adrian Toomes is an old man in a flight harness who is stronger, faster and considerably more willing to kill than he looks. The Vulture works because Spider-Man keeps underestimating him and keeps being wrong.', 'claude', false, 'written', null, null),
('299', 'cv-1480', 'The Green Goblin threw Gwen Stacy off a bridge to hurt Spider-Man, and it worked permanently. She is the death comics point to when they argue that a character can stay dead and should.', 'claude', false, 'written', null, null),
('687', 'h_06811cbb-ee4b-47b2-9e26-4e62ba71b45d', 'Venom knows who Spider-Man is, which means he knows where Mary Jane lives — and the symbiote''s favourite move is arriving at the apartment instead of the fight. She has been the hostage more than anyone.', 'claude', false, 'written', null, null),
-- ── X-Men ─────────────────────────────────────────────────────────────────
('196', '527', 'Scott Summers was Xavier''s first student and his most obedient, and spent his adult life discovering what that obedience had cost. The X-Men''s modern history is Cyclops slowly becoming the thing Xavier warned him about.', 'claude', false, 'written', null, null),
('423', 'cv-3552', 'Magneto has courted Jean Grey as an ally and fought the Phoenix as a threat, and both times the argument was the same: that she is proof mutants are the next thing rather than a persecuted minority.', 'claude', false, 'written', null, null),
('638', 'cv-3552', 'Two of the X-Men''s most powerful women, and the team keeps making Storm lead while Jean Grey carries the apocalyptic power. Storm is who Jean trusts to make the call when the Phoenix is the thing being discussed.', 'claude', false, 'written', null, null),
('527', '75', 'Hank McCoy was one of Xavier''s original five and is the one who stayed academic, which makes him the student Xavier talks to as a colleague. He is also the one who has most often gone behind Xavier''s back and been right.', 'claude', false, 'written', null, null),
('717', 'cv-3548', 'Kitty Pryde joined the X-Men as a teenager and Logan took her training personally, which is where the character''s whole protective streak comes from. She is the one he taught to be dangerous without becoming him.', 'claude', false, 'written', null, null),
('241', '717', 'Emma Frost was a villain who joined, and Logan has never stopped treating her as one on probation. She reads minds and he has the least guarded one on the team, which she enjoys considerably more than he does.', 'claude', false, 'written', null, null),
('196', '638', 'Cyclops and Storm have traded command of the X-Men for decades, and the handovers are the team''s most honest arguments — she leads by weather and instinct, he by plan, and both keep being proved right in turn.', 'claude', false, 'written', null, null),
-- ── Star Wars ─────────────────────────────────────────────────────────────
('cv-2608', 'cv-6355', 'Lando Calrissian lost the Millennium Falcon to Han Solo in a card game and sold him to the Empire to protect his city, in that order. He spends the rest of the trilogy earning it back, and Solo lets him.', 'claude', false, 'written', null, null),
('cv-6334', 'cv-6355', 'Chewbacca had his hands around Lando Calrissian''s throat within minutes of the betrayal at Cloud City, and by the next film is flying beside him. The Wookiee''s forgiveness is the film''s verdict on Lando.', 'claude', false, 'written', null, null),
('418', 'cv-6355', 'Lando Calrissian took the Falcon into the second Death Star while Luke Skywalker was inside handling his father, and brought it out. He is the one who finishes the war Luke could not fight.', 'claude', false, 'written', null, null),
('cv-33545', 'cv-6355', 'Leia Organa was in the room when Lando Calrissian handed them to Vader and never once pretends to have forgiven it quickly. He earns it by going back for Han, which is the only currency she accepts.', 'claude', false, 'written', null, 'ally'),
('208', 'cv-55028', 'Ahsoka Tano was Anakin Skywalker''s apprentice and left the Jedi before he fell, which means she is the one person who knew him well and did not have to watch. When she finally faces Vader she hears his voice come out of the mask.', 'claude', false, 'written', null, null),
('208', 'h_3420c0c3-78e7-4c78-a8db-3d28d48151f2', 'Grand Moff Tarkin gives Vader orders and Vader takes them, which is the clearest statement the first film makes about who actually runs the Empire. Tarkin is also the only officer who mocks the Force to his face and lives.', 'claude', false, 'written', null, null),
('208', 'cv-5392', 'Count Dooku was the apprentice Palpatine discarded to make room, and Anakin Skywalker is who did the discarding — beheading a disarmed prisoner on his master''s instruction. It is the first thing he does that he cannot argue away.', 'claude', false, 'written', null, null),
('208', 'cv-5411', 'Qui-Gon Jinn found Anakin Skywalker, insisted on training him against the Council''s judgment, and died before he could do any of it. Everything that goes wrong afterwards follows from the boy being handed to someone else.', 'claude', false, 'written', null, null),
('207', '208', 'Darth Maul and Vader are the two apprentices Palpatine kept and discarded, separated by a generation and never allowed to meet properly. Maul survived being cut in half largely on hatred, which is the qualification Vader lacked.', 'claude', false, 'written', null, null),
-- ── DC ────────────────────────────────────────────────────────────────────
('152', 'h_2ace1789-18f4-43bb-8f5f-030acaed0471', 'Leonard Snart is a thief with a freeze gun and a code, and he is the Flash''s most durable enemy precisely because he is not trying to be more than that. Captain Cold plans around the speed instead of complaining about it.', 'claude', false, 'written', null, null),
('294', 'h_2ace1789-18f4-43bb-8f5f-030acaed0471', 'Gorilla Grodd is a telepathic gorilla, which sounds like a joke until the fight, when the fastest man alive discovers his own mind is the slow part. He is the rogue the Flash cannot outrun by definition.', 'claude', false, 'written', null, null),
('278', '643', 'Zod and Kara Zor-El are both Kryptonians who actually remember Krypton, which makes his argument harder for her to dismiss than for her cousin. She was raised in the culture he says Superman betrayed.', 'claude', false, 'written', null, null),
('278', '405', 'Zod wants Earth remade as Krypton and Luthor wants it kept human, which briefly makes Lex Luthor the patriot. Their alliances against Superman collapse the moment the question of what happens afterwards comes up.', 'claude', false, 'written', null, null),
('396', '643', 'Krypto knew Kara Zor-El on Krypton, which makes the dog one of the only living things that can confirm her memories are real. He is also the only member of the family who is uncomplicatedly pleased to see her.', 'claude', false, 'written', null, null),
('69', 'h_ecba928f-1888-4f64-8330-c727dbf19c65', 'Terry McGinnis took the suit from an old man who did not want to give it up, and Bruce Wayne runs the mission from a chair through an earpiece. It is the only version where Batman has to trust someone else to be Batman.', 'claude', false, 'written', null, null),
('370', 'h_ecba928f-1888-4f64-8330-c727dbf19c65', 'The Joker meets a Batman who did not watch his parents die and finds the joke does not land the same way. Terry McGinnis wins by mocking him, which is the one thing nobody in Gotham had tried.', 'claude', false, 'written', null, null),
('69', 'h_15a572bc-4624-4fe9-9dff-1eff9a94781b', 'Ace is a German shepherd with a mask, introduced in an era when Batman had a dog, a butler, an alien and a Bat-Mite. He keeps being brought back because a man who trusts almost nobody having a dog is genuinely useful.', 'claude', false, 'written', null, null),
-- ── Marvel cosmic ─────────────────────────────────────────────────────────
('234', '655', 'Drax was rebuilt specifically to kill Thanos and has failed at it for his entire existence, which is his whole characterisation — a man made into a weapon for one job he cannot finish. Thanos killed his family first.', 'claude', false, 'written', null, null),
-- ── Manga ─────────────────────────────────────────────────────────────────
('289', 'cv-40737', 'Frieza destroyed Goku''s home planet and his species before Goku was old enough to know he had either. Their fight is the series'' longest and the one that turns Goku from a fighter into a Saiyan.', 'claude', false, 'written', null, null),
('cv-40722', 'cv-40743', 'Vegeta trains Goku''s son and is visibly better at it than Goku is, having taken an interest in the boy his rival kept leaving behind. He would deny every part of that sentence.', 'claude', false, 'written', null, null),
('485', 'cv-44243', 'Kakashi took a team of three and openly favoured the one with the famous bloodline, which is the wound Naruto spends the series growing out of. He becomes the student Kakashi is proudest of and the one he taught least.', 'claude', false, 'written', null, null),
-- ── Family sitcoms and cartoons ───────────────────────────────────────────
('cv-3399', 'cv-3403', 'Maggie Simpson has never spoken and has shot a man, and Homer''s relationship with her is the show''s reliable route to sincerity. The one thing he has never done is fail to notice her.', 'claude', false, 'written', null, null),
('cv-3401', 'cv-3403', 'Bart Simpson is gentler with Maggie than with anyone else alive, and the show almost never comments on it. She is the only member of the family he has never once tried to get out of trouble with.', 'claude', false, 'written', null, null),
('h_2e379808-30f5-441c-ad8f-f9461c15ab9a', 'h_9a0e3d34-dbda-4b55-9944-e7b6bfbcd280', 'Huey is the eldest of the three nephews Donald Duck is raising with no explanation of where their parents went, and the one most likely to have read the manual. Donald is their guardian and is manifestly not qualified.', 'claude', false, 'written', null, null),
('h_198d4a99-3e75-4e73-8441-e6f0ca2d728a', 'h_9a0e3d34-dbda-4b55-9944-e7b6bfbcd280', 'Dewey is the middle nephew and the one who goes first, which in a household run by Donald Duck''s temper is a survival strategy rather than bravery. The three of them are usually written as one character with three heads.', 'claude', false, 'written', null, null),
('h_5ec656ab-1b7e-4f7b-8ca6-a6fea8bf520c', 'h_9a0e3d34-dbda-4b55-9944-e7b6bfbcd280', 'Louie is the youngest nephew and the one who has most obviously inherited Scrooge''s instincts rather than Donald''s. Donald raised all three and none of them turned out much like him.', 'claude', false, 'written', null, null),
('h_87117684-4467-403b-a57c-2cad3d23ebb1', 'h_8c6fc8b8-7afa-40b1-aa79-5c0faf27e228', 'Meowth has been trying to steal Ash Ketchum''s Pikachu since the first season and has never managed it, and the show has repeatedly stranded them together to prove neither actually wants the other dead.', 'claude', false, 'written', null, null),
('h_5c99b8b3-131c-46ad-9fc6-0f4b73e365dd', 'h_87117684-4467-403b-a57c-2cad3d23ebb1', 'Brock is a gym leader who left his post to travel with a ten-year-old, and functions as the group''s cook, medic and only adult. Ash Ketchum has never once been written as noticing this.', 'claude', false, 'written', null, null),
-- ── Declines ──────────────────────────────────────────────────────────────
('106', '708', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('cv-4684', 'h_2ace1789-18f4-43bb-8f5f-030acaed0471', null, 'claude', false, 'nothing_to_say', 'Brainiac is Superman''s; nothing durable with the Flash', null),
('cv-6335', 'cv-6355', null, 'claude', false, 'nothing_to_say', 'same films, no relationship', null),
('149', '379', null, 'claude', false, 'nothing_to_say', 'Kang is a team-wide threat; nothing specific to Rogers', null),
('208', '354', null, 'claude', false, 'no_relationship', 'Jar Jar and Vader never interact as such; the edge is an artifact', null),
('214', 'cv-6129', null, 'claude', false, 'nothing_to_say', 'Squad roster; nothing between the two of them', null),
('214', 'cv-4885', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('278', 'cv-1808', null, 'claude', false, 'nothing_to_say', 'Zod threatens everyone Superman knows; nothing specific to Lois', null),
('cv-2936', 'h_554ad3d0-6bd0-4fae-98b2-6f12c147bda4', null, 'claude', false, 'nothing_to_say', 'Jiminy Cricket belongs to Pinocchio', null),
('313', '550', null, 'claude', false, 'nothing_to_say', 'Red Skull belongs to Captain America', null),
('313', '708', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('332', '379', null, 'claude', false, 'nothing_to_say', 'Kang is a team-wide threat', null),
('346', '379', null, 'claude', false, 'nothing_to_say', 'Kang is a team-wide threat', null),
('346', '589', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('cv-1808', 'cv-4684', null, 'claude', false, 'nothing_to_say', 'Brainiac threatens the city; nothing specific to Lois', null),
('cv-1808', 'h_89ff9c2c-5768-483b-be41-e723ef0df460', null, 'claude', false, 'nothing_to_say', 'Lois and Jor-El barely meet; the tie runs through Clark', null),
('cv-1691', 'cv-3584', null, 'claude', false, 'nothing_to_say', 'Titans roster; the Raven ties that matter are Beast Boy''s', null),
('480', '527', null, 'claude', false, 'nothing_to_say', 'X-Men adjacency; nothing durable', null),
('536', '717', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('cv-2594', 'cv-6355', null, 'claude', false, 'nothing_to_say', 'same films, no relationship', null),
('cv-1451', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('579', 'cv-4324', null, 'claude', false, 'nothing_to_say', 'crossover adjacency only', null),
('659', '703', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('680', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'Ultron is a team-wide threat', null),
('cv-40722', 'cv-53244', null, 'claude', false, 'nothing_to_say', 'Roshi is Goku''s teacher; nothing between him and Vegeta', null),
('687', 'cv-1480', null, 'claude', false, 'no_relationship', 'Gwen Stacy was dead before Venom existed; the edge is an artifact', null),
('697', 'cv-3200', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('30', '579', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('30', '703', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('38', 'cv-6578', null, 'claude', false, 'nothing_to_say', 'Lobo is a cosmic guest; nothing durable', null),
('106', '536', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('106', 'cv-1451', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('106', '680', null, 'claude', false, 'nothing_to_say', 'Ultron is a team-wide threat', null),
('106', '697', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('165', 'h_c641fc32-86de-4e33-a5e9-0a7daa34d10f', null, 'claude', false, 'nothing_to_say', 'rogues-gallery cross product', null),
('185', '527', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('196', '423', null, 'claude', false, 'nothing_to_say', 'the Cyclops/Magneto tie runs through Xavier and the school', null),
('225', 'cv-1480', null, 'claude', false, 'nothing_to_say', 'Gwen''s death belongs to the Green Goblin', null),
('226', 'cv-1451', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('226', '680', null, 'claude', false, 'nothing_to_say', 'Ultron is a team-wide threat', null),
('226', '697', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('cv-16164', 'cv-6355', null, 'claude', false, 'nothing_to_say', 'same films, no relationship', null),
('274', '717', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('298', 'cv-4916', null, 'claude', false, 'nothing_to_say', 'League-wide antagonism; nothing between these two', null),
('299', 'h_06811cbb-ee4b-47b2-9e26-4e62ba71b45d', null, 'claude', false, 'nothing_to_say', 'the Osborn/Mary Jane material is a widely-rejected retcon', null),
('313', '536', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('313', 'cv-1451', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('313', '680', null, 'claude', false, 'nothing_to_say', 'Ultron is a team-wide threat', null),
('313', '697', null, 'claude', false, 'nothing_to_say', 'Avengers roster only', null),
('339', '527', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('374', '717', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null),
('396', 'cv-1808', null, 'claude', false, 'nothing_to_say', 'Krypto''s ties are to the Kryptonians', null),
('cv-4324', 'cv-94118', null, 'claude', false, 'nothing_to_say', 'crossover adjacency only', null),
('423', '75', null, 'claude', false, 'nothing_to_say', 'X-Men roster only', null)
on conflict (hero_a, hero_b) do nothing;
