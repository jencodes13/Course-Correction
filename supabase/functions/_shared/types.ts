// Shared TypeScript types for Edge Functions

// ============================================
// API Request/Response Types
// ============================================

export interface AnalysisRequest {
  text?: string;
  files?: FileData[];
  config?: ProjectConfig;
}

export interface AnalysisResponse {
  freshnessScore: number;
  engagementScore: number;
  freshnessIssues: Issue[];
  engagementIssues: Issue[];
  summary: string;
}

export interface RegulatoryRequest {
  content: string;
  domainContext?: string;
  location?: string;
}

export interface RegulatoryResponse {
  updates: RegulatoryUpdateItem[];
}

export interface VisualRequest {
  content: string;
  theme?: string;
}

export interface VisualResponse {
  transformations: TransformationItem[];
}

export interface AssetRequest {
  prompt: string;
  baseImage?: string;
  projectId?: string;
  transformationId?: string;
}

export interface AssetResponse {
  imageUrl: string;
  storagePath?: string;
}

export interface JurisdictionRequest {
  location: string;
  regulationType?: string;
}

export interface JurisdictionResponse {
  location: string;
  regulationType?: string;
  authority: string;
}

export interface DemoSlidesRequest {
  topic: string;
  location?: string;
  style?: string;
  fileData?: FileData;
}

export interface DemoSlidesResponse {
  slides: DemoSlide[];
}

// ============================================
// Shared Data Types
// ============================================

export interface FileData {
  name: string;
  type: string;
  data: string; // base64
}

export interface ProjectConfig {
  goal?: "regulatory" | "visual" | "full";
  targetAudience?: string;
  standardsContext?: string;
  location?: string;
}

export interface Issue {
  description: string;
  severity: "low" | "medium" | "high";
  location?: string;
}

export interface RegulatoryUpdateItem {
  id: string;
  originalText: string;
  updatedText: string;
  citation: string;
  reason: string;
  sourceUrl?: string;
}

export interface TransformationItem {
  sectionId: string;
  originalType: "paragraph" | "bullet_list" | "table" | "heading";
  suggestedType:
    | "accordion"
    | "timeline"
    | "flip_card"
    | "infographic"
    | "tabbed_content"
    | "process_diagram"
    | "comparison_table"
    | "interactive_quiz";
  visualDescription: string;
  imagePrompt?: string;
  content: {
    title?: string;
    items?: Array<{
      label: string;
      content: string;
    }>;
  };
}

export interface DemoSlide {
  title: string;
  bullets: string[];
  visualPrompt: string;
  colorTheme: string;
}

// ============================================
// Database Types (mirrors Supabase schema)
// ============================================

export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  organization?: string;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  goal: "regulatory" | "visual" | "full";
  target_audience?: string;
  standards_context?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  status: "draft" | "analyzing" | "reviewed" | "exported";
  created_at: string;
  updated_at: string;
}

export interface UploadedFile {
  id: string;
  project_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  raw_content?: string;
  created_at: string;
}

export interface Analysis {
  id: string;
  project_id: string;
  freshness_score: number;
  engagement_score: number;
  freshness_issues: Issue[];
  engagement_issues: Issue[];
  summary: string;
  model_used: string;
  created_at: string;
}

export interface RegulatoryUpdate {
  id: string;
  project_id: string;
  original_text: string;
  updated_text: string;
  citation?: string;
  reason?: string;
  source_url?: string;
  status: "pending" | "accepted" | "rejected";
  section_id?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface VisualTransformation {
  id: string;
  project_id: string;
  section_id?: string;
  original_type: string;
  suggested_type: string;
  visual_description: string;
  image_prompt?: string;
  generated_image_path?: string;
  content: object;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  reviewed_at?: string;
}

export interface GeneratedAsset {
  id: string;
  project_id: string;
  transformation_id?: string;
  prompt: string;
  storage_path: string;
  model_used: string;
  created_at: string;
}

export interface Export {
  id: string;
  project_id: string;
  format: "scorm_1.2" | "scorm_2004" | "xapi";
  storage_path?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface ApiUsage {
  id: string;
  user_id: string;
  endpoint: string;
  model?: string;
  tokens_used?: number;
  created_at: string;
}
