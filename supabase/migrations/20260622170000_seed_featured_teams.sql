-- Curate the daily-battle pool. is_featured gates which teams the deterministic
-- daily pick can draw from. logo_url left null for now (UI falls back to a
-- monogram); a later pass attaches art. Re-runnable.
update public.teams set is_featured = true
where id in (
  'avengers',
  'x-men',
  'justice-league-of-america',
  'fantastic-four',
  'x-force',
  'guardians-of-the-galaxy',
  'new-mutants',
  'suicide-squad',
  'injustice-league',
  'thunderbolts',
  'teen-titans',
  'legion-of-super-heroes',
  'sinister-six',
  'birds-of-prey',
  'inhumans',
  'young-avengers',
  'eternals',
  'watchmen'
) and member_count >= 3;
