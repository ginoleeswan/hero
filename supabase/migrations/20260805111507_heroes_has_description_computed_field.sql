-- A PostgREST computed field, deliberately not a stored column.
--
-- The character page needs to know whether a hero HAS a biography so it can
-- offer "read the full biography". It was getting that by fetching the whole
-- `description`, which reaches 417 KB on Spider-Man and 398 KB on Batman —
-- hundreds of kilobytes over cellular to compute a boolean, on exactly the
-- pages people open most.
--
-- A function rather than a GENERATED column: this needs no storage and,
-- crucially, no table rewrite. `heroes` is 238 MB with 45 MB of description
-- text, and rewriting it on a constrained instance is not worth a boolean.
-- PostgREST exposes it as a virtual column, so clients ask for it with
-- `select=...,has_description`.
create or replace function public.has_description(h public.heroes)
returns boolean
language sql
stable
as $$
  select h.description is not null and h.description <> '';
$$;

grant execute on function public.has_description(public.heroes) to anon, authenticated;
