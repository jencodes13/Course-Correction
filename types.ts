export enum AppStep {
  LANDING = 'LANDING',
  DEMO = 'DEMO',
  INGESTION = 'INGESTION',
  CONFIGURATION = 'CONFIGURATION',
  DIAGNOSIS = 'DIAGNOSIS',
  REGULATORY = 'REGULATORY',
  VISUAL = 'VISUAL',
  EXPORT = 'EXPORT'
}

// Demo Flow Types
export type UpdateMode = 'visual' | 'regulatory' | 'full';

export interface Citation {
  id: number;
  title: string;
  url: string;
  snippet: string;
  accessedDate: string;
}

export interface InferredSector {
  sector: string;
  confidence: 'high' | 'medium' | 'low';
  alternatives?: string[];
  reasoning: string;
  isAmbiguous: boolean;
  detectedTopics?: string[];
}

export interface SlideContent {
  title: string;
  bullets: string[];
  citationIds: number[]; // References to Citation.id
}

export interface DemoSlideEnhanced {
  id: string;
  before: SlideContent;
  after: SlideContent;
  changesSummary: string;
  visualStyle: {
    accentColor: string;
    layout: 'split' | 'stacked' | 'overlay';
  };
}

export interface DemoResult {
  slides: DemoSlideEnhanced[];
  citations: Citation[];
  metadata: {
    sector: string;
    location: string;
    updateMode: UpdateMode;
    generatedAt: string;
    searchQueries: string[];
  };
}

export interface ProjectConfig {
  goal: 'regulatory' | 'visual' | 'full';
  targetAudience: string;
  standardsContext: string;
  location: string;
}

export interface AnalysisMetrics {
  freshnessScore: number;
  engagementScore: number;
  freshnessIssues: string[];
  engagementIssues: string[];
  summary: string;
}

export interface RegulatoryUpdate {
  originalText: string;
  updatedText: string;
  citation: string;
  reason: string;
  id: string;
}

export interface VisualTransformation {
  sectionId: string;
  originalType: 'text_block' | 'bullet_list' | 'data_table';
  suggestedType: 'interactive_accordion' | 'timeline' | 'infographic' | 'flip_cards';
  visualDescription: string;
  imagePrompt: string;
  content: string;
}

export interface IngestedFile {
  name: string;
  type: string;
  data?: string;         // Base64 data URL (small files, inline)
  storagePath?: string;  // Supabase Storage path (large files)
  sizeBytes?: number;    // File size for display/progress
}

export interface FileUploadProgress {
  fileName: string;
  progress: number;  // 0-100
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

export interface DriveDownloadProgress {
  fileId: string;
  fileName: string;
  progress: number;    // 0-100
  status: 'downloading' | 'complete' | 'error';
  error?: string;
}

export interface CourseFinding {
  id: string;
  category: 'outdated' | 'missing' | 'compliance' | 'structural';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  sourceSnippet?: string;
  currentInfo?: string;
}

export interface FindingsScanResult {
  findings: CourseFinding[];
  searchQueries: string[];
  courseSummary: string;
}

export interface CourseData {
  title: string;
  rawContent: string;
  files: IngestedFile[];
  analysis: AnalysisMetrics | null;
  regulatoryUpdates: RegulatoryUpdate[];
  visualTransformations: VisualTransformation[];
}

export interface DemoSlide {
  title: string;
  bullets: string[];
  visualPrompt: string;
  colorTheme: string;
}

export interface GeneratedUseCase {
  industry: string;
  title: string;
  legacyInput: string;
  modernOutput: string;
  color: string;
  icon: string;
}