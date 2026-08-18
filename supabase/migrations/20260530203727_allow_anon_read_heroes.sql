
DROP POLICY IF EXISTS heroes_select ON heroes;
CREATE POLICY heroes_select ON heroes
  FOR SELECT
  TO authenticated, anon
  USING (true);
;
