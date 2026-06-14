-- Lane 2: LLM narrative enrichment (pilot).
-- Side-tables for AI-generated narrative, gated by heroes.narrative_status.
-- Public-read RLS; writes happen via the service role (Supabase MCP).

-- 1. Status gate on heroes (mirrors comicvine_status / ai_stats_status).
alter table public.heroes
  add column if not exists narrative_status text not null default 'pending'
    check (narrative_status in ('pending','done','failed','stale'));

create index if not exists heroes_narrative_status_idx
  on public.heroes (narrative_status, issue_count desc nulls last);

-- 2. Controlled tag vocabulary (source of truth for allowed tags).
create table if not exists public.hero_tag_vocab (
  slug        text primary key,
  label       text not null,
  description text not null,
  category    text not null
);

-- 3. Text outputs (did_you_know rows ordered by position; one power_explainer
--    row per power with subject=power name; one era_summary row).
-- NB: named hero_narrative_facts to avoid colliding with Lane 3's hero_facts
-- (a separate key/value factual store).
create table if not exists public.hero_narrative_facts (
  id           bigint generated always as identity primary key,
  hero_id      text not null references public.heroes(id) on delete cascade,
  kind         text not null check (kind in ('did_you_know','power_explainer','era_summary')),
  content      text not null,
  subject      text,
  position     int,
  source_model text not null,
  needs_review boolean not null default false,
  generated_at timestamptz not null default now()
);
create index if not exists hero_narrative_facts_hero_id_kind_idx on public.hero_narrative_facts (hero_id, kind);

-- 4. Normalized, filterable tags.
create table if not exists public.hero_tags (
  hero_id text not null references public.heroes(id) on delete cascade,
  tag     text not null references public.hero_tag_vocab(slug),
  primary key (hero_id, tag)
);
create index if not exists hero_tags_tag_idx on public.hero_tags (tag);

-- 5. Public-read RLS on all three new tables (anon reads return 0 rows without this).
alter table public.hero_tag_vocab        enable row level security;
alter table public.hero_narrative_facts  enable row level security;
alter table public.hero_tags             enable row level security;

create policy "hero_tag_vocab_public_read"       on public.hero_tag_vocab       for select using (true);
create policy "hero_narrative_facts_public_read" on public.hero_narrative_facts for select using (true);
create policy "hero_tags_public_read"            on public.hero_tags            for select using (true);

-- 6. Seed the controlled vocabulary (~35 slugs across 5 categories).
insert into public.hero_tag_vocab (slug, label, description, category) values
  ('anti-hero',        'Anti-hero',        'Protagonist who lacks conventional heroic morals.', 'archetype'),
  ('reformed-villain', 'Reformed villain', 'Former antagonist now aligned with heroes.',         'archetype'),
  ('legacy-hero',      'Legacy hero',      'Inherits a mantle/identity from a predecessor.',     'archetype'),
  ('vigilante',        'Vigilante',        'Operates outside the law to fight crime.',           'archetype'),
  ('mentor',           'Mentor',           'Trains or guides other heroes.',                     'archetype'),
  ('sidekick',         'Sidekick',         'Partner/apprentice to a lead hero.',                 'archetype'),
  ('mastermind',       'Mastermind',       'Defined by strategic/intellectual planning.',        'archetype'),
  ('monster-hunter',   'Monster hunter',   'Specializes in hunting supernatural threats.',       'archetype'),
  ('mutant',           'Mutant',           'Powers from being born a genetic mutant.',           'source'),
  ('mutate',           'Mutate',           'Powers from accidental mutation/exposure.',          'source'),
  ('cosmic-powered',   'Cosmic-powered',   'Powers from a cosmic/universal source.',             'source'),
  ('tech-based',       'Tech-based',       'Relies on technology/equipment for abilities.',      'source'),
  ('magic-user',       'Magic user',       'Wields magic or the mystic arts.',                   'source'),
  ('super-soldier',    'Super-soldier',    'Enhanced via a deliberate program/serum.',           'source'),
  ('alien',            'Alien',            'Non-human extraterrestrial in origin.',              'source'),
  ('mythological',     'Mythological',     'Derived from gods/myth/legend.',                     'source'),
  ('street-level',     'Street-level',     'Operates at a grounded, local scale.',               'scope'),
  ('cosmic',           'Cosmic',           'Operates at a universal/cosmic scale.',              'scope'),
  ('reality-warper',   'Reality-warper',   'Can alter reality itself.',                          'scope'),
  ('powerhouse',       'Powerhouse',       'Defined by raw strength/durability.',                'scope'),
  ('gadgeteer',        'Gadgeteer',        'Relies on invented gadgets and gear.',               'scope'),
  ('tragic-backstory', 'Tragic backstory', 'Origin rooted in loss or tragedy.',                  'tone'),
  ('morally-grey',     'Morally grey',     'Ambiguous morality.',                                'tone'),
  ('brooding',         'Brooding',         'Dark, serious tone.',                                 'tone'),
  ('comic-relief',     'Comic relief',     'Primarily humorous in tone.',                        'tone'),
  ('wholesome',        'Wholesome',        'Earnest, optimistic tone.',                          'tone'),
  ('noir',             'Noir',             'Hardboiled/noir atmosphere.',                        'tone'),
  ('team-leader',      'Team leader',      'Leads a super-team.',                                'role'),
  ('lone-wolf',        'Lone wolf',        'Works alone by preference.',                         'role'),
  ('government-agent', 'Government agent', 'Works for a government/agency.',                      'role'),
  ('outlaw',           'Outlaw',           'Wanted by/at odds with authorities.',                'role'),
  ('shapeshifter',     'Shapeshifter',     'Can change physical form.',                          'role'),
  ('speedster',        'Speedster',        'Superhuman speed is the defining power.',            'role'),
  ('telepath',         'Telepath',         'Telepathic/psychic abilities.',                      'role'),
  ('immortal',         'Immortal',         'Does not age / cannot die conventionally.',          'role')
on conflict (slug) do nothing;
