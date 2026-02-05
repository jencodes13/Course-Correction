/*
  # Add Transformation Jobs Table

  1. New Tables
    - `transformation_jobs`
      - `id` (uuid, primary key) - Job identifier
      - `project_id` (uuid, foreign key) - Reference to project
      - `status` (text) - Job status: processing, completed, failed
      - `progress` (integer) - Progress percentage 0-100
      - `message` (text) - Current status message
      - `filename` (text) - Original uploaded filename
      - `course_materials` (text) - Raw course text
      - `error` (text) - Error message if failed
      - `created_at` (timestamptz) - Job creation time
      - `completed_at` (timestamptz) - Job completion time

  2. Security
    - Enable RLS on `transformation_jobs` table
    - Add policies for authenticated users to manage their own jobs
*/

CREATE TABLE IF NOT EXISTS transformation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'processing',
  progress integer NOT NULL DEFAULT 0,
  message text DEFAULT 'Starting transformation...',
  filename text DEFAULT '',
  course_materials text DEFAULT '',
  error text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transformation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view jobs from own projects"
  ON transformation_jobs FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = transformation_jobs.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert jobs to own projects"
  ON transformation_jobs FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = transformation_jobs.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update jobs in own projects"
  ON transformation_jobs FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = transformation_jobs.project_id
    AND projects.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = transformation_jobs.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_transformation_jobs_project_id ON transformation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_transformation_jobs_status ON transformation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_transformation_jobs_created_at ON transformation_jobs(created_at DESC);
