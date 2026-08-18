-- First batch of curated relationship notes, for the marquee pairs.
--
-- Written to name BOTH characters, because the same row is read from either
-- character's page. Each states something specific and checkable about what
-- the relationship IS — not a restatement of "enemy", which the pill already
-- says, and not invented continuity.
--
-- least/greatest normalises to the table's hero_a < hero_b ordering so a pair
-- can't be seeded twice in opposite orders.
insert into public.hero_relationship_blurbs (hero_a, hero_b, blurb)
select least(a, b), greatest(a, b), blurb
from (
  values
  ('69','17','Alfred Pennyworth raised Bruce Wayne after the murder that made Batman, and has spent every year since patching him up and declining to talk him out of it. He is the only person Batman answers to.'),
  ('644','69','The World''s Finest, and a study in opposites: Superman trusts people until proven wrong, Batman assumes the reverse. Each keeps a countermeasure for the other, and both consider that ordinary prudence.'),
  ('644','cv-1808','Lois Lane was investigating Superman long before she loved him, and she is the reporter who never needed the glasses explained. Theirs is one of the few marriages in comics that keeps being allowed to stick.'),
  ('69','cv-1691','Dick Grayson was the first Robin, taken in by Bruce Wayne after an identical loss. Becoming Nightwing was how he stopped being a sidekick without ever stopping being family.'),
  ('69','cv-3727','Commissioner Gordon is Gotham''s law and Batman is what the law cannot do. The alliance works because Gordon has never once asked what is under the cowl; the signal on the roof is the whole arrangement.'),
  ('69','165','Selina Kyle is the one criminal Batman keeps letting get away, and both of them know it. The theft is never really the point.'),
  ('69','678','Harvey Dent was Gotham''s clean prosecutor and Bruce Wayne''s friend before the acid. Two-Face is the case Batman cannot close, because closing it means admitting the man is gone.'),
  ('69','370','The Joker has no origin he will confirm and no goal beyond proving that Batman''s one rule is a lie. That Batman has never killed him, after everything, is the argument they are both still having.'),
  ('69','cv-4885','Oswald Cobblepot runs Gotham''s crime from a nightclub and a table of respectable people, which makes him far harder to arrest than the rogues who wear their madness openly.'),
  ('69','cv-3715','Victor Fries commits his crimes to keep his wife Nora alive in cryogenic stasis. Batman has stopped him dozens of times and has never once argued that he is wrong to try.'),
  ('69','cv-6129','Bane worked out what no other rogue had: that Batman is a man on a schedule. He wore him down for weeks, then broke his back. Everything since has been a rematch.'),
  ('69','309','Harleen Quinzel was the Arkham psychiatrist assigned to the Joker. Batman has spent years trying to pull her out of that orbit, which makes him something stranger to her than an enemy.'),
  ('69','522','Pamela Isley considers humanity the infestation and the plants the victims, which makes her one of the few Gotham rogues with a coherent argument. Batman has never had a good answer to it.'),
  ('69','cv-3718','Edward Nygma cannot commit a crime without telling Batman how to solve it. The compulsion is the flaw, and Batman has never needed another one.'),
  ('644','405','Luthor''s objection was never that Superman is dangerous. It is that humanity stopped reaching the day he arrived, and that a man from Krypton gets the credit for saving a world Luthor meant to save himself.'),
  ('644','643','Kara Zor-El is Superman''s older cousin who arrived younger, having slept through the years he spent growing up on Earth. She remembers Krypton; he only has the stories.'),
  ('720','h_1e366d42-ef27-46e7-abcc-e8f51c465ac7','Ares is the god of war and, in most tellings, the reason Diana exists at all: the Amazons were made as the answer to him. Nearly every version of her origin routes back through this fight.'),
  ('720','172','Barbara Ann Minerva was Diana''s friend before the curse that made her the Cheetah. Wonder Woman keeps treating the fight as a rescue, and Cheetah keeps refusing to be rescued.'),
  ('644','720','Two of the Justice League''s founding members, and the two most often written as able to end any argument by force and choosing not to. Their regard for each other is largely built on that restraint.'),
  ('69','720','Founding Justice League members who disagree about method far more than about ends: Diana will fight a war Batman would rather prevent. He keeps a contingency for her, and she knows it.'),
  ('620','299','Norman Osborn is his best friend''s father, which is why Spider-Man kept pulling the punch — until the Goblin took Gwen Stacy off a bridge. That is the line the rivalry never came back from.'),
  ('620','687','Venom is Spider-Man''s own discarded suit worn by a man who hates him, which makes it the rare enemy that knows everything he knows. It does not even trip his spider-sense.'),
  ('620','225','Otto Octavius is the scientist Peter Parker might have become without the lesson about power and responsibility: brilliant, certain, answerable to no one. He once took over Peter''s body to prove he would do the job better.'),
  ('346','149','Tony Stark builds the future and asks forgiveness afterwards; Steve Rogers holds a line and asks permission of nobody. The Avengers work because of that friction, right up until it split them.'),
  ('659','cv-4324','Loki is Thor''s adopted brother and the cause of most of his worst days, and Thor keeps offering him a way back regardless. Neither has ever managed to stop playing his part in it.'),
  ('332','346','Stark built the Hulkbuster armour for a friend he cannot reliably call a friend. Bruce Banner is the only Avenger the others keep a plan for.'),
  ('423','527','Charles Xavier and Erik Lehnsherr want the same thing and disagree entirely about what people are — one spent his life teaching, the other survived Auschwitz. Between the wars, they keep being friends.'),
  ('717','cv-4563','Victor Creed has been in Logan''s life for over a century and has a habit of turning up on his birthday to remind him. Both heal from almost anything, so neither has ever been able to finish it.'),
  ('196','cv-3552','Scott Summers and Jean Grey grew up in the same school, and the X-Men have buried her more than once. He is the field commander who keeps having to give the order about her.'),
  ('h_42f7e0df-0aba-42b6-861f-09bec419704c','h_e3dbea9a-11ee-4415-b75c-4812d2865ab1','Mickey and Minnie Mouse both debuted in Steamboat Willie in 1928 and have been a pair for the entire history of the studio that was built on them.'),
  ('h_42f7e0df-0aba-42b6-861f-09bec419704c','h_751c55e3-38a8-4ff1-86fd-3707a081791e','Pluto is the one member of Mickey''s circle who never got to speak, and the joke has outlasted almost everything else about the shorts: a dog who is only ever a dog.'),
  ('h_42f7e0df-0aba-42b6-861f-09bec419704c','h_9a0e3d34-dbda-4b55-9944-e7b6bfbcd280','Donald Duck was invented to be everything Mickey Mouse could not get away with being — furious, petty, half-intelligible — and promptly became the funnier of the two.'),
  ('cv-2936','h_9a0e3d34-dbda-4b55-9944-e7b6bfbcd280','Goofy and Donald Duck are the studio''s oldest double act: one of them incapable of losing his temper, the other incapable of keeping it.'),
  ('h_850dd0ee-0b63-44bd-8936-da706517d07a','cv-55484','Luigi is Mario''s younger brother — taller, faster, and worse at landing — and exists because a second player needed somebody to be.'),
  ('h_850dd0ee-0b63-44bd-8936-da706517d07a','h_8d776c67-da5c-4d2c-b762-ad363aa20b9f','Princess Peach rules the Mushroom Kingdom, and Mario''s entire career began with getting her back from Bowser: a premise durable enough to survive forty years of games trying to vary it.'),
  ('h_850dd0ee-0b63-44bd-8936-da706517d07a','h_bf38eb8e-640f-403f-9aaf-be9f41b6eeb3','Bowser has been taking the Mushroom Kingdom from Mario since 1985. The two have since raced karts, played tennis and thrown parties together without either of them ever mentioning it.')
) as v(a, b, blurb)
on conflict (hero_a, hero_b) do update
  set blurb = excluded.blurb, updated_at = now();;
