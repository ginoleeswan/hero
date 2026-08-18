alter table public.heroes drop constraint if exists heroes_narrative_status_check;
alter table public.heroes add constraint heroes_narrative_status_check
  check (narrative_status in ('pending','done','failed','stale','ai_authored'));;
