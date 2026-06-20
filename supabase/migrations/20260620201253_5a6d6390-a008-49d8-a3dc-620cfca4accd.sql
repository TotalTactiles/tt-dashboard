
DROP POLICY IF EXISTS "Anyone can upload reference screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete reference screenshots" ON storage.objects;

CREATE POLICY "Authenticated users can upload reference screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reference-screenshots');

CREATE POLICY "Authenticated users can delete reference screenshots"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reference-screenshots');
