-- The legacy hero-portraits Supabase Storage bucket was removed via the Storage
-- API (portraits are served from Cloudinary; the bucket was empty with no rows
-- referencing it). Supabase blocks deleting storage.buckets rows via SQL, so the
-- bucket removal itself isn't expressible as a migration. This drops the
-- now-orphaned write policy that referenced the bucket — its last trace in the schema.
drop policy if exists "Authenticated write hero portraits" on storage.objects;
