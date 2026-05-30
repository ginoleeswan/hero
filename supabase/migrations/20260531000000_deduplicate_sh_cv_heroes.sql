-- Merge SuperheroAPI duplicate entries into their ComicVine counterparts, then delete them.
--
-- 80 heroes exist in both sources (matched by name). ComicVine (cv-*) entries are kept
-- as canonical. Stats and portraits from the SuperheroAPI (numeric ID) entries are
-- merged in before deletion.

BEGIN;

-- 1. Apply user-chosen portraits for the 14 heroes where both entries had a portrait.
--    (Remaining portrait merges handled in step 2.)
UPDATE heroes SET portrait_url = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/8.jpg'   WHERE id = 'cv-4604'; -- Adam Strange
UPDATE heroes SET portrait_url = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/20.jpg'  WHERE id = 'cv-3737'; -- Amazo
UPDATE heroes SET portrait_url = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/56.jpg'  WHERE id = 'cv-3189'; -- Aurora
UPDATE heroes SET portrait_url = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/119.jpg' WHERE id = 'cv-3182'; -- Blob
UPDATE heroes SET portrait_url = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/142.jpg' WHERE id = 'cv-3576'; -- Bumblebee
UPDATE heroes SET portrait_url = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/146.jpg' WHERE id = 'cv-3423'; -- Callisto
UPDATE heroes SET portrait_url = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/240.jpg' WHERE id = 'cv-4437'; -- Elongated Man
UPDATE heroes SET portrait_url = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/249.jpg' WHERE id = 'cv-4567'; -- Exodus
-- cv-3277 (Atlas), cv-3586 (Beast Boy), cv-3628 (Big Barda), cv-4916 (Black Adam),
-- cv-4684 (Brainiac) — user chose CV portrait, already set, no update needed.

-- 2. Copy portrait from SH entry → CV entry where only the SH entry has one.
UPDATE heroes cv_hero
SET portrait_url = sh_hero.portrait_url
FROM heroes sh_hero
WHERE sh_hero.id ~ '^[0-9]+$'
  AND cv_hero.id ~ '^cv-'
  AND lower(trim(sh_hero.name)) = lower(trim(cv_hero.name))
  AND sh_hero.portrait_url IS NOT NULL
  AND cv_hero.portrait_url IS NULL;

-- 3. Copy the 6 powerstats from SH → CV (only where CV column is NULL).
--    Uses COALESCE so existing CV values are never overwritten.
UPDATE heroes cv_hero
SET
  intelligence = COALESCE(cv_hero.intelligence, sh_hero.intelligence),
  speed        = COALESCE(cv_hero.speed,        sh_hero.speed),
  power        = COALESCE(cv_hero.power,        sh_hero.power),
  combat       = COALESCE(cv_hero.combat,       sh_hero.combat),
  durability   = COALESCE(cv_hero.durability,   sh_hero.durability),
  strength     = COALESCE(cv_hero.strength,     sh_hero.strength),
  stats_source = CASE
    WHEN cv_hero.intelligence IS NULL AND sh_hero.intelligence IS NOT NULL
      THEN 'superheroapi'
    ELSE cv_hero.stats_source
  END
FROM heroes sh_hero
WHERE sh_hero.id ~ '^[0-9]+$'
  AND cv_hero.id ~ '^cv-'
  AND lower(trim(sh_hero.name)) = lower(trim(cv_hero.name));

-- 4. Delete SuperheroAPI entries that have a matching ComicVine entry.
--    user_favourites.hero_id has ON DELETE CASCADE so no orphan rows will remain.
DELETE FROM heroes
WHERE id ~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1 FROM heroes cv
    WHERE cv.id ~ '^cv-'
      AND lower(trim(cv.name)) = lower(trim(heroes.name))
  );

COMMIT;
