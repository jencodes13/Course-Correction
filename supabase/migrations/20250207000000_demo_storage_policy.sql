-- Demo Storage Policies
-- Allow unauthenticated uploads to course-files/demo/ prefix
-- for the hackathon demo flow (no auth required)

-- Allow anonymous users to upload demo files
CREATE POLICY "Allow anonymous demo uploads"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
    bucket_id = 'course-files' AND
    (storage.foldername(name))[1] = 'demo'
);

-- Allow anonymous users to read demo files (Edge Functions use service role,
-- but this allows the browser to verify uploads succeeded)
CREATE POLICY "Allow anonymous demo reads"
ON storage.objects FOR SELECT
TO anon
USING (
    bucket_id = 'course-files' AND
    (storage.foldername(name))[1] = 'demo'
);

-- Cleanup function for demo files older than 2 hours
CREATE OR REPLACE FUNCTION cleanup_demo_uploads()
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'course-files'
    AND name LIKE 'demo/%'
    AND created_at < NOW() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
