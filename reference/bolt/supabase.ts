import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Project = {
  id: string;
  user_id: string;
  name: string;
  status: 'draft' | 'analyzing' | 'review' | 'generating' | 'completed';
  created_at: string;
  updated_at: string;
};

export type UploadedFile = {
  id: string;
  project_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  file_category: 'course_material' | 'knowledge_resource';
  uploaded_at: string;
};

export type AIAnalysis = {
  id: string;
  project_id: string;
  content_summary: Record<string, unknown>;
  identified_topics: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  questions: Array<{
    id: string;
    question: string;
    type: 'emphasis' | 'exclude' | 'theme' | 'custom';
    options?: string[];
  }>;
  analyzed_at: string;
};

export type UserPreferences = {
  id: string;
  project_id: string;
  theme_selection: string;
  emphasis_topics: string[];
  exclude_topics: string[];
  custom_instructions: string;
  updated_at: string;
};

export type GeneratedContent = {
  id: string;
  project_id: string;
  slides_data: Record<string, unknown>;
  voiceover_url: string;
  generated_at: string;
};
