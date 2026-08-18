-- Hand-written notes on what a relationship actually IS.
--
-- ComicVine ships no reason text for a relationship — hero_relationships has
-- kind, source and rank and nothing else — so the focus card could only ever
-- infer ("both serving in the Justice League") or pad ("17 mutual connections
-- in common"). For the pairs people actually look at, a sentence written by
-- someone who knows the characters beats anything derivable.
--
-- NOT a column on hero_relationships: `rebuild_hero_relationships()` begins
-- with `truncate public.hero_relationships` and runs nightly, so curated text
-- stored there would be silently destroyed within a day. This table is keyed
-- by the pair and never touched by the rebuild.
--
-- Stored once per unordered pair, with hero_a < hero_b enforced so a pair can
-- never be written twice in opposite orders. Blurbs name BOTH characters
-- explicitly, because the card renders from either side — the same row is read
-- on Batman's page about Alfred and on Alfred's page about Batman.
create table if not exists public.hero_relationship_blurbs (
  hero_a text not null references public.heroes (id) on delete cascade,
  hero_b text not null references public.heroes (id) on delete cascade,
  blurb text not null,
  /** Who wrote it, so machine-written text can be audited or replaced. */
  author text not null default 'claude',
  /** Flipped once a human has read it. */
  verified boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (hero_a, hero_b),
  constraint hero_relationship_blurbs_ordered check (hero_a < hero_b),
  constraint hero_relationship_blurbs_len check (char_length(blurb) between 20 and 320)
);

alter table public.hero_relationship_blurbs enable row level security;

-- Without an explicit read policy RLS returns zero rows to anon and the app
-- silently shows no blurbs at all, with no error to notice.
create policy "hero_relationship_blurbs are public" on public.hero_relationship_blurbs
  for select using (true);

comment on table public.hero_relationship_blurbs is
  'Curated one-or-two-sentence notes on a character pair, keyed by unordered pair. Survives rebuild_hero_relationships(), which truncates hero_relationships nightly.';;
