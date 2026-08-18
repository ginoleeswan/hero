ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url  TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-media', 'user-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read user media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-media');;
