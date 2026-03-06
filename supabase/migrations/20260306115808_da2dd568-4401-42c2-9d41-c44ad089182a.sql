
-- Create the reference-screenshots storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('reference-screenshots', 'reference-screenshots', true);

-- Allow anyone to read (public bucket)
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'reference-screenshots');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'reference-screenshots');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'reference-screenshots');
