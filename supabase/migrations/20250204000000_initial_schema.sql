-- CourseCorrect Database Schema
-- Initial migration for course modernization platform

-- Note: Using gen_random_uuid() which is built into PostgreSQL 13+
-- No extension needed for Supabase

-- ============================================
-- USERS / PROFILES
-- ============================================
-- Extends Supabase Auth with app-specific fields
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    organization TEXT,
    role TEXT DEFAULT 'user', -- user, admin
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECTS (Course Libraries)
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    goal TEXT CHECK (goal IN ('regulatory', 'visual', 'full')) DEFAULT 'full',
    target_audience TEXT,
    standards_context TEXT,
    location JSONB, -- {city, state, country, lat, lng}
    status TEXT CHECK (status IN ('draft', 'analyzing', 'reviewed', 'exported')) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UPLOADED FILES
-- ============================================
CREATE TABLE IF NOT EXISTS uploaded_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT,
    storage_path TEXT NOT NULL, -- Path in Supabase Storage
    raw_content TEXT, -- Extracted text content
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYSES (Diagnosis Results)
-- ============================================
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    freshness_score INTEGER CHECK (freshness_score >= 0 AND freshness_score <= 100),
    engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
    freshness_issues JSONB DEFAULT '[]'::jsonb, -- [{description, severity, location}]
    engagement_issues JSONB DEFAULT '[]'::jsonb, -- [{description, severity, location}]
    summary TEXT,
    model_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REGULATORY UPDATES (Redline Changes)
-- ============================================
CREATE TABLE IF NOT EXISTS regulatory_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    original_text TEXT NOT NULL,
    updated_text TEXT NOT NULL,
    citation TEXT, -- e.g., "OSHA 1910.134(c)(2) - Updated Jan 2024"
    reason TEXT,
    source_url TEXT,
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    section_id TEXT, -- Reference to location in original document
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- ============================================
-- VISUAL TRANSFORMATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS visual_transformations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    section_id TEXT,
    original_type TEXT, -- paragraph, bullet_list, table
    suggested_type TEXT, -- accordion, timeline, flip_card, infographic
    visual_description TEXT,
    image_prompt TEXT, -- Prompt for image generation
    generated_image_path TEXT, -- Path to generated asset in storage
    content JSONB, -- Structured content for the transformation
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- ============================================
-- GENERATED ASSETS (AI Images)
-- ============================================
CREATE TABLE IF NOT EXISTS generated_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    transformation_id UUID REFERENCES visual_transformations(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    model_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXPORTS (SCORM/xAPI Packages)
-- ============================================
CREATE TABLE IF NOT EXISTS exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    format TEXT CHECK (format IN ('scorm_1.2', 'scorm_2004', 'xapi')) NOT NULL,
    storage_path TEXT, -- Path to export package in storage
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================
-- API USAGE TRACKING (for rate limiting)
-- ============================================
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL,
    model TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_project_id ON uploaded_files(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_project_id ON analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_updates_project_id ON regulatory_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_updates_status ON regulatory_updates(status);
CREATE INDEX IF NOT EXISTS idx_visual_transformations_project_id ON visual_transformations(project_id);
CREATE INDEX IF NOT EXISTS idx_visual_transformations_status ON visual_transformations(status);
CREATE INDEX IF NOT EXISTS idx_exports_project_id ON exports(project_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual_transformations ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only access their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Projects: Users can only access their own projects
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create projects" ON projects;
CREATE POLICY "Users can create projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Uploaded files: Access through project ownership
DROP POLICY IF EXISTS "Users can view files in own projects" ON uploaded_files;
CREATE POLICY "Users can view files in own projects" ON uploaded_files FOR SELECT
    USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = uploaded_files.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can upload files to own projects" ON uploaded_files;
CREATE POLICY "Users can upload files to own projects" ON uploaded_files FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = uploaded_files.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete files in own projects" ON uploaded_files;
CREATE POLICY "Users can delete files in own projects" ON uploaded_files FOR DELETE
    USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = uploaded_files.project_id AND projects.user_id = auth.uid()));

-- Analyses: Access through project ownership
DROP POLICY IF EXISTS "Users can view analyses of own projects" ON analyses;
CREATE POLICY "Users can view analyses of own projects" ON analyses FOR SELECT
    USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = analyses.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create analyses for own projects" ON analyses;
CREATE POLICY "Users can create analyses for own projects" ON analyses FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = analyses.project_id AND projects.user_id = auth.uid()));

-- Regulatory updates: Access through project ownership
DROP POLICY IF EXISTS "Users can view regulatory updates of own projects" ON regulatory_updates;
CREATE POLICY "Users can view regulatory updates of own projects" ON regulatory_updates FOR SELECT
    USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = regulatory_updates.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create regulatory updates for own projects" ON regulatory_updates;
CREATE POLICY "Users can create regulatory updates for own projects" ON regulatory_updates FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = regulatory_updates.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update regulatory updates of own projects" ON regulatory_updates;
CREATE POLICY "Users can update regulatory updates of own projects" ON regulatory_updates FOR UPDATE
    USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = regulatory_updates.project_id AND projects.user_id = auth.uid()));

-- Visual transformations: Access through project ownership
DROP POLICY IF EXISTS "Users can view visual transformations of own projects" ON visual_transformations;
CREATE POLICY "Users can view visual transformations of own projects" ON visual_transformations FOR SELECT
    USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = visual_transformations.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create visual transformations for own projects" ON visual_transformations;
CREATE POLICY "Users can create visual transformations for own projects" ON visual_transformations FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = visual_transformations.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update visual transformations of own projects" ON visual_transformations;
CREATE POLICY "Users can update visual transformations of own projects" ON visual_transformations FOR UPDATE
    USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = visual_transformations.project_id AND projects.user_id = auth.uid()));

-- Generated assets: Access through project ownership
DROP POLICY IF EXISTS "Users can view generated assets of own projects" ON generated_assets;
CREATE POLICY "Users can view generated assets of own projects" ON generated_assets FOR SELECT
    USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = generated_assets.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create generated assets for own projects" ON generated_assets;
CREATE POLICY "Users can create generated assets for own projects" ON generated_assets FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = generated_assets.project_id AND projects.user_id = auth.uid()));

-- Exports: Access through project ownership
DROP POLICY IF EXISTS "Users can view exports of own projects" ON exports;
CREATE POLICY "Users can view exports of own projects" ON exports FOR SELECT
    USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = exports.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create exports for own projects" ON exports;
CREATE POLICY "Users can create exports for own projects" ON exports FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = exports.project_id AND projects.user_id = auth.uid()));

-- API usage: Users can only view their own usage
DROP POLICY IF EXISTS "Users can view own api usage" ON api_usage;
CREATE POLICY "Users can view own api usage" ON api_usage FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
