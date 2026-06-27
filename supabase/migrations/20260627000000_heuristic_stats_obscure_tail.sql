-- Heuristic powerstats for the obscure long tail.
--
-- Context: every hero with >=300 issue appearances already has stats (curated by
-- hand or from SuperheroAPI). What remained were ~9.9k ENRICHED but statless
-- heroes (comicvine_status='done', intelligence IS NULL) — almost all D-listers
-- and licensed cartoon/game characters. Hand-authoring that many is infeasible,
-- and leaving them null breaks compare/versus/matchup for them entirely.
--
-- So we derive stats deterministically from the only structured signal we have:
-- the `origin` archetype (a per-stat baseline) plus additive bonuses for the
-- `powers` array. Values are clamped to 5..100 on the app's 0-100 scale
-- (avg human ~ str10/spd10/dur20/int50/pwr5/cbt30; cosmic ~100).
--
-- IMPORTANT gates (see project_stats_backfill_superheroapi_gotcha):
--   * intelligence IS NULL        -> only TRULY empty rows; never overwrites
--                                    curated/superheroapi/AI stats.
--   * comicvine_status='done'     -> only enriched rows (origin/powers present).
--   * ai_stats_status null/pending-> not already terminal.
-- stats_source='ai' (the check constraint allows only 'superheroapi' | 'ai';
-- these are model-derived). Fully reversible:
--   UPDATE heroes SET intelligence=NULL,... WHERE stats_source='ai'
--     AND ai_stats_status='done' AND <this run>  (see git for the set).
--
-- NOTE: quality is bounded by the source power tags. Whimsical tags (e.g. Donald
-- Duck flagged "Super Strength") yield high stats; acceptable for the deep tail.

UPDATE heroes AS h SET
  intelligence = c.i, strength = c.s, speed = c.sp,
  durability = c.d, power = c.pw, combat = c.cbt,
  stats_source = 'ai', ai_stats_status = 'done'
FROM (
  SELECT id,
    LEAST(100,GREATEST(5,b[1]
      +(CASE WHEN p&&ARRAY['Intellect'] THEN 20 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Telepathy','Telekinesis','Psychic','Psionic'] THEN 8 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Reality Manpulation','Cosmic Awareness'] THEN 8 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Leadership','Insanely Rich','Gadgets','Technopathy'] THEN 6 ELSE 0 END))) AS i,
    LEAST(100,GREATEST(5,b[2]
      +(CASE WHEN p&&ARRAY['Super Strength'] THEN 32 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Berserker Strength'] THEN 14 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Claws','Feral'] THEN 8 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Power Suit','Implants','Size Manipulation'] THEN 10 ELSE 0 END))) AS s,
    LEAST(100,GREATEST(5,b[3]
      +(CASE WHEN p&&ARRAY['Super Speed'] THEN 32 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Flight','Levitation'] THEN 12 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Teleport'] THEN 10 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Agility'] THEN 8 ELSE 0 END))) AS sp,
    LEAST(100,GREATEST(5,b[4]
      +(CASE WHEN p&&ARRAY['Invulnerability'] THEN 30 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Healing'] THEN 15 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Stamina'] THEN 8 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Immortal','Longevity'] THEN 8 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Force Field','Energy Shield','Power Suit'] THEN 8 ELSE 0 END))) AS d,
    LEAST(100,GREATEST(5,b[5]
      +(CASE WHEN p&&ARRAY['Reality Manpulation'] THEN 28 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Divine Powers','Cosmic Awareness'] THEN 20 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Magic','Necromancy'] THEN 18 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Blast Power','Energy Manipulation','Energy-Enhanced Strike','Energy Based Constructs','Willpower-Based Constructs'] THEN 14 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Fire Control','Ice Control','Electricity Control','Water Control','Earth Manipulation','Weather Control','Wind Bursts','Light Projection','Heat Generation','Heat Vision','Sand manipulation','Plant Control','Gravity control','Magnetism','Darkforce Manipulation','Darkness Manipulation','Radiation','Sonic Scream','Hellfire Control'] THEN 14 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Telepathy','Telekinesis','Psychic','Psionic'] THEN 12 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Energy Absorption','Matter Absorption','Siphon Abilities','Power Mimicry','Adaptive'] THEN 10 ELSE 0 END))) AS pw,
    LEAST(100,GREATEST(5,b[6]
      +(CASE WHEN p&&ARRAY['Weapon Master','Swordsmanship','Marksmanship','Unarmed Combat'] THEN 15 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Agility'] THEN 6 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Claws','Feral','Berserker Strength'] THEN 8 ELSE 0 END)
      +(CASE WHEN p&&ARRAY['Stealth','Tracking','Danger Sense','Escape Artist'] THEN 5 ELSE 0 END))) AS cbt
  FROM (
    SELECT id, COALESCE(powers,'{}') AS p,
      CASE origin
        WHEN 'God/Eternal' THEN ARRAY[58,72,52,72,78,58]
        WHEN 'Cyborg'      THEN ARRAY[66,60,45,66,56,56]
        WHEN 'Robot'       THEN ARRAY[62,58,42,66,54,50]
        WHEN 'Radiation'   THEN ARRAY[52,54,45,56,62,50]
        WHEN 'Mutant'      THEN ARRAY[54,42,44,50,58,50]
        WHEN 'Alien'       THEN ARRAY[52,54,48,56,54,52]
        WHEN 'Infection'   THEN ARRAY[38,56,44,56,46,44]
        WHEN 'Other'       THEN ARRAY[48,42,42,48,50,44]
        WHEN 'Animal'      THEN ARRAY[30,40,52,40,30,40]
        WHEN 'Human'       THEN ARRAY[50,18,20,28,12,38]
        ELSE                    ARRAY[42,28,32,36,35,38]
      END AS b
    FROM heroes
    WHERE comicvine_status='done'
      AND intelligence IS NULL
      AND (ai_stats_status IS NULL OR ai_stats_status='pending')
  ) base
) c
WHERE h.id = c.id;
