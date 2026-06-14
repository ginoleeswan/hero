-- Performer/creator rows aren't always tied to a specific title. Make title_id
-- nullable and key uniqueness on coalesce(title_id,'') so NULLs dedupe cleanly.
alter table public.hero_people drop constraint hero_people_pkey;
alter table public.hero_people alter column title_id drop not null;
create unique index if not exists hero_people_uniq on public.hero_people
  (hero_id, person_name, role, coalesce(title_id, ''));
