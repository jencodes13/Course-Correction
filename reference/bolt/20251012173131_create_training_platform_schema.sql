-- # Training Course Transformation Platform Schema
-- 
-- 1. New Tables
--    - projects: Main project container
--    - uploaded_files: Track uploaded course materials and knowledge resources
--    - ai_analysis: Store AI analysis results and generated questions
--    - user_preferences: User selections for theme, emphasis, and exclusions
--    - generated_content: Final generated slides and voiceover data
-- 
-- 2. Security
--    - Enable RLS on all tables
--    - Add policies for authenticated users to manage their own projects

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL,
  file_category text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  content_summary jsonb DEFAULT '{}',
  identified_topics jsonb DEFAULT '[]',
  questions jsonb DEFAULT '[]',
  analyzed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  theme_selection text DEFAULT '',
  emphasis_topics jsonb DEFAULT '[]',
  exclude_topics jsonb DEFAULT '[]',
  custom_instructions text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generated_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  slides_data jsonb DEFAULT '{}',
  voiceover_url text DEFAULT '',
  generated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view files from own projects"
  ON uploaded_files FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = uploaded_files.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert files to own projects"
  ON uploaded_files FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = uploaded_files.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete files from own projects"
  ON uploaded_files FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = uploaded_files.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can view analysis from own projects"
  ON ai_analysis FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = ai_analysis.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert analysis to own projects"
  ON ai_analysis FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = ai_analysis.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update analysis in own projects"
  ON ai_analysis FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = ai_analysis.project_id
    AND projects.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = ai_analysis.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can view preferences from own projects"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = user_preferences.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert preferences to own projects"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = user_preferences.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update preferences in own projects"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = user_preferences.project_id
    AND projects.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = user_preferences.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can view content from own projects"
  ON generated_content FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = generated_content.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert content to own projects"
  ON generated_content FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = generated_content.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update content in own projects"
  ON generated_content FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = generated_content.project_id
    AND projects.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = generated_content.project_id
    AND projects.user_id = auth.uid()
  ));