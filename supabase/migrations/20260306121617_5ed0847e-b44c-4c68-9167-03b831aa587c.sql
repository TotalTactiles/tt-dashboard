
-- Drop existing restrictive policies on storage.objects for reference-screenshots
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Public read reference screenshots" ON storage.objects;

-- Allow anyone to read reference screenshots
CREATE POLICY "Public read reference screenshots" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'reference-screenshots');

-- Allow anyone to upload reference screenshots
CREATE POLICY "Anyone can upload reference screenshots" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'reference-screenshots');

-- Allow anyone to delete reference screenshots
CREATE POLICY "Anyone can delete reference screenshots" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'reference-screenshots');
