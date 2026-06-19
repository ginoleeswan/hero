-- Seed baselines for the "who would win" crowd vote, so marquee matchups feel
-- alive at launch instead of showing "No fan votes yet" everywhere. We do NOT
-- fabricate auth.users rows — instead a small seed table holds a baseline count
-- per normalized pair, and get_matchup_tally adds it on top of the real votes.
-- Real votes accumulate normally; the seed is a fixed floor we can tune/remove.

create table if not exists public.matchup_vote_seeds (
  hero_a_id text not null, -- lexicographically smaller id (normalized, = least())
  hero_b_id text not null, -- lexicographically larger id (= greatest())
  votes_a integer not null default 0, -- seed votes for hero_a_id
  votes_b integer not null default 0, -- seed votes for hero_b_id
  primary key (hero_a_id, hero_b_id),
  check (hero_a_id < hero_b_id)
);

-- Locked down: only the SECURITY DEFINER RPC (which bypasses RLS as the table
-- owner) reads this. No public policy — clients never touch it directly.
alter table public.matchup_vote_seeds enable row level security;

-- Tally = real votes + seed baseline, mapped back to the caller's a/b order.
create or replace function public.get_matchup_tally(p_a text, p_b text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  with norm as (
    select least(p_a, p_b) as lo, greatest(p_a, p_b) as hi
  ),
  realv as (
    select
      count(*) filter (where v.picked_id = p_a) as va,
      count(*) filter (where v.picked_id = p_b) as vb,
      count(v.picked_id) as tot,
      max(v.picked_id) filter (where v.user_id = auth.uid()) as mypick
    from norm n
    left join public.matchup_votes v
      on v.hero_a_id = n.lo and v.hero_b_id = n.hi
  ),
  seed as (
    select
      case when p_a = n.lo then coalesce(s.votes_a, 0) else coalesce(s.votes_b, 0) end as sa,
      case when p_a = n.lo then coalesce(s.votes_b, 0) else coalesce(s.votes_a, 0) end as sb
    from norm n
    left join public.matchup_vote_seeds s
      on s.hero_a_id = n.lo and s.hero_b_id = n.hi
  )
  select json_build_object(
    'votes_a', realv.va + seed.sa,
    'votes_b', realv.vb + seed.sb,
    'total',   realv.tot + seed.sa + seed.sb,
    'my_pick', realv.mypick
  )
  from realv, seed;
$function$;

-- Marquee rivalries (the get_top_rivalries set) with fan-realistic splits — note
-- fans don't always agree with the raw stat winner (beloved underdogs poll well).
-- (hero_a_id, hero_b_id) are normalized lo<hi; votes_a is for hero_a_id.
insert into public.matchup_vote_seeds (hero_a_id, hero_b_id, votes_a, votes_b) values
('644','69',870,630),         -- Superman / Batman
('620','717',470,430),        -- Spider-Man / Wolverine
('69','720',360,440),         -- Batman / Wonder Woman
('149','644',210,490),        -- Captain America / Superman
('370','69',208,442),         -- Joker / Batman
('644','720',420,330),        -- Superman / Wonder Woman
('346','717',318,282),        -- Iron Man / Wolverine
('423','644',247,403),        -- Magneto / Superman
('208','644',360,540),        -- Darth Vader / Superman
('620','687',378,322),        -- Spider-Man / Venom
('717','cv-4563',325,175),    -- Wolverine / Sabretooth
('480','717',80,320),         -- Mystique / Wolverine
('149','423',264,286),        -- Captain America / Magneto
('299','620',140,360),        -- Green Goblin / Spider-Man
('196','423',135,315),        -- Cyclops / Magneto
('149','370',375,125),        -- Captain America / Joker
('332','717',540,360),        -- Hulk / Wolverine
('423','638',261,189),        -- Magneto / Storm
('149','222',225,275),        -- Captain America / Doctor Doom
('222','346',318,332),        -- Doctor Doom / Iron Man
('196','480',189,161),        -- Cyclops / Mystique
('346','cv-4324',318,282),    -- Iron Man / Loki
('149','208',376,424),        -- Captain America / Darth Vader
('332','346',542,408),        -- Hulk / Iron Man
('222','226',240,260),        -- Doctor Doom / Doctor Strange
('226','cv-4324',302,248),    -- Doctor Strange / Loki
('423','659',264,336),        -- Magneto / Thor
('659','cv-4324',448,252),    -- Thor / Loki
('332','659',612,588)         -- Hulk / Thor
on conflict (hero_a_id, hero_b_id) do update
  set votes_a = excluded.votes_a, votes_b = excluded.votes_b;
