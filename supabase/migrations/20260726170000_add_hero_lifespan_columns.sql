-- Lifespan and reign, as TEXT rather than integer years.
--
-- No two franchises share a calendar: Westeros counts AC/BC from Aegon's
-- Conquest, Star Wars uses BBY/ABY, and Marvel's sliding timescale has no canon
-- year at all. An integer column would force a fabricated absolute year onto
-- every character outside the one setting that has real dates, so the era stays
-- part of the value ("48 AC", "c. 132 AC", "19 BBY") and the app parses what it
-- can for durations.
alter table public.heroes
  add column if not exists born text,
  add column if not exists died text,
  add column if not exists reign_start text,
  add column if not exists reign_end text;

comment on column public.heroes.born is
  'Birth date in the setting''s own calendar, e.g. "245 AC". Free text: eras and approximations ("c. 48 AC") are part of the value.';
comment on column public.heroes.died is
  'Death date in the setting''s own calendar. Null does not imply living — most of the catalogue is simply unrecorded.';
comment on column public.heroes.reign_start is
  'First year of a monarch''s reign, setting calendar. Only meaningful for ruling characters.';
comment on column public.heroes.reign_end is
  'Last year of a monarch''s reign, setting calendar.';
