-- Add heroes.power_rating: a weighted composite of the six powerstats (0-100) for
-- overall-strength ranking (social "Top 10 Strongest / Most Powerful" countdowns).
--
-- Why: single-stat rankings tie massively at the ceiling — in the famous pool
-- (fame >= 20) there are 154 characters at power=100, 92 at strength=100, etc., so a
-- "Top 10 Strongest" shows a wall of identical 100s. A weighted blend of all six
-- stats produces ~750 distinct values across the famous pool (top tie: 2), giving a
-- strictly ordered, distinct-number countdown.
--
-- Weights favor physical dominance (power/strength/durability) over finesse:
--   power .25, strength .20, durability .20, combat .15, speed .12, intelligence .08
--
-- Implemented as a plain column + trigger (not a GENERATED STORED column) on
-- purpose: STORED would rewrite the whole 197MB heroes table under ACCESS EXCLUSIVE
-- and contend with the every-15-min ComicVine drain. The trigger only touches the
-- ~14k stat-bearing rows. Stats are strictly all-or-nothing (verified: 0 partial),
-- so null propagates and stat-less heroes get null power_rating (excluded from
-- rankings via nullslast), exactly as intended.
--
-- Reversible: drop the column, trigger, function, and index.

alter table public.heroes add column power_rating numeric(5,2);

comment on column public.heroes.power_rating is
  'Weighted composite of the six powerstats (0-100) for overall-strength ranking. Maintained by trg_set_power_rating; null when stats are unset.';

create or replace function public.set_power_rating()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Any null stat propagates to null (stat-less heroes stay unranked).
  new.power_rating := round(
    (0.25 * new.power
   + 0.20 * new.strength
   + 0.20 * new.durability
   + 0.15 * new.combat
   + 0.12 * new.speed
   + 0.08 * new.intelligence)::numeric, 2);
  return new;
end $$;

create trigger trg_set_power_rating
  before insert or update of intelligence, strength, speed, durability, power, combat
  on public.heroes
  for each row execute function public.set_power_rating();

-- Backfill existing stat-bearing rows (touches power_rating only, so the trigger
-- above does not re-fire).
update public.heroes set power_rating = round(
    (0.25 * power
   + 0.20 * strength
   + 0.20 * durability
   + 0.15 * combat
   + 0.12 * speed
   + 0.08 * intelligence)::numeric, 2)
where intelligence is not null;

-- Ranking index (partial: only ranked rows).
create index if not exists heroes_power_rating_idx
  on public.heroes (power_rating desc nulls last)
  where power_rating is not null;
