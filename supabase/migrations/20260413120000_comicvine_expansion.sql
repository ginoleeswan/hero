-- comicvine_id: stable CV character ID (numeric portion of 4005-XXXX)
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS comicvine_id text UNIQUE;

-- stats_source: who provided the numeric stats
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS stats_source text
  CHECK (stats_source IN ('superheroapi', 'ai'));

-- ai_stats_status: generation queue state
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS ai_stats_status text
  CHECK (ai_stats_status IN ('pending', 'done', 'failed'));

-- Ingestion progress tracker (singleton row, id always = 1)
CREATE TABLE IF NOT EXISTS cv_ingestion_state (
  id             integer PRIMARY KEY DEFAULT 1,
  last_offset    integer NOT NULL DEFAULT 0,
  total_ingested integer NOT NULL DEFAULT 0,
  target         integer NOT NULL DEFAULT 5000,
  status         text    NOT NULL DEFAULT 'idle'
                   CHECK (status IN ('idle', 'running', 'complete', 'error')),
  last_run_at    timestamptz,
  error          text
);
INSERT INTO cv_ingestion_state DEFAULT VALUES
  ON CONFLICT (id) DO NOTHING;

-- Backfill: existing heroes with powerstats came from SuperheroAPI
UPDATE heroes
SET stats_source = 'superheroapi'
WHERE intelligence IS NOT NULL
  AND strength IS NOT NULL
  AND stats_source IS NULL;
