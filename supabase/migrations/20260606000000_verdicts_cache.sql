-- Persistent cache for AI-generated battle verdicts.
-- Normalized key (hero_a_id <= hero_b_id) so A vs B and B vs A share one row.
CREATE TABLE verdicts (
  hero_a_id  text        NOT NULL,
  hero_b_id  text        NOT NULL,
  verdict    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hero_a_id, hero_b_id)
);

ALTER TABLE verdicts ENABLE ROW LEVEL SECURITY;

-- Public read — verdict text is not sensitive.
CREATE POLICY "verdicts_select" ON verdicts FOR SELECT USING (true);
-- Anon insert — the frontend saves after a successful edge-function call.
CREATE POLICY "verdicts_insert" ON verdicts FOR INSERT WITH CHECK (true);
