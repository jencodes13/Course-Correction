-- CourseCorrect Storage Buckets
-- Configure storage for course files, generated assets, and exports

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Course files bucket (uploads from users)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'course-files',
    'course-files',
    false,
    52428800, -- 50MB limit
    ARRAY[
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav'
    ]
) ON CONFLICT (id) DO NOTHING;

-- Generated assets bucket (AI-generated images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'generated-assets',
    'generated-assets',
    true, -- Public so images can be displayed
    10485760, -- 10MB limit
    ARRAY[
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif'
    ]
) ON CONFLICT (id) DO NOTHING;

-- Exports bucket (SCORM/xAPI packages)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'exports',
    'exports',
    false,
    104857600, -- 100MB limit for SCORM packages
    ARRAY[
        'application/zip',
        'application/x-zip-compressed'
    ]
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Course files: Only authenticated users can upload/view their own files
CREATE POLICY "Users can upload course files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'course-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own course files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'course-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own course files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'course-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Generated assets: Public read, authenticated write for own folder
CREATE POLICY "Anyone can view generated assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-assets');

CREATE POLICY "Users can create generated assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'generated-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Exports: Only authenticated users can access their own exports
CREATE POLICY "Users can create exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own exports"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
