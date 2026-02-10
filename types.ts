export enum AppStep {
  LANDING = 'LANDING',
  DEMO = 'DEMO',
  DASHBOARD = 'DASHBOARD',
  INGESTION = 'INGESTION',
  CONFIGURATION = 'CONFIGURATION',
  DIAGNOSIS = 'DIAGNOSIS',
  REGULATORY = 'REGULATORY',
  VISUAL = 'VISUAL',
  EXPORT = 'EXPORT',
  ARCHITECTURE = 'ARCHITECTURE'
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
  subtitle?: string;
  bullets: string[];
  citationIds: number[]; // References to Citation.id
  keyFact?: string; // A single prominent stat/fact to display large (e.g., "73% reduction in incidents")
  sourcePageNumber?: number; // 1-based page number from uploaded PDF this slide corresponds to
}

export type SlideLayoutType = 'hero' | 'two-column' | 'stats-highlight' | 'comparison' | 'timeline' | 'split';

export interface DemoSlideEnhanced {
  id: string;
  before: SlideContent;
  after: SlideContent;
  changesSummary: string;
  visualStyle: {
    accentColor: string;
    layout: SlideLayoutType;
    iconSuggestion?: string; // Lucide icon name (e.g., "shield-check", "book-open")
    pageClassification?: PageClassification;
  };
  imagePrompt?: string; // Prompt for Gemini image generation
  imageUrl?: string; // Generated image URL (populated after generation)
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
  totalEstimatedFindings?: number;
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

// Design Mode — Client-side text extraction + AI theme generation

export type PageClassification = 'TEXT_HEAVY' | 'INFOGRAPHIC' | 'TITLE';

export interface ExtractedPageData {
  pageNumber: number;
  classification: PageClassification;
  title: string;
  subtitle: string;
  bullets: string[];
  textDensityScore: number;
}

export interface GeneratedTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  mutedTextColor: string;
  fontSuggestion: string;
  layoutStyle: string;
  designReasoning: string;
}

export interface ThemeOption {
  name: string;
  description: string;
  backgroundColor: string;
  textColor: string;
  primaryColor: string;
  secondaryColor: string;
  mutedTextColor: string;
  fontSuggestion: string;
  layoutStyle: string;
}

// Regulatory Output — diff/redline types
export interface DiffToken {
  text: string;
  type: 'same' | 'removed' | 'added';
}

export interface BulletDiff {
  type: 'unchanged' | 'removed' | 'added' | 'modified';
  beforeText?: string;
  afterText?: string;
  tokens?: DiffToken[]; // word-level diff for 'modified' type
}

export interface RedlineEntry {
  slideId: string;
  slideIndex: number;
  sourcePageNumber?: number;
  findingId?: string;
  findingTitle?: string;
  findingCategory?: string;
  findingSeverity?: string;
  changesSummary: string;
  titleDiff: { before: string; after: string; changed: boolean };
  bulletDiffs: BulletDiff[];
  citationIds: number[];
}

// Agent Orchestration Types

export interface VerifiedFinding {
  findingId: string;
  title: string;
  status: 'verified' | 'updated' | 'unverified';
  confidence: number; // 0-100
  sourceUrl?: string;
  sourceTitle?: string;
  verificationNote: string;
  originalDescription: string;
  updatedInfo?: string;
}

export interface VerificationResult {
  findings: VerifiedFinding[];
  searchQueries: string[];
  verifiedAt: string;
}

export interface CourseSummaryResult {
  courseTitle: string;
  learningObjectives: string[];
  keyTopics: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: string;
  moduleCount: number;
  summary: string;
}

export type AgentStatus = 'idle' | 'working' | 'complete' | 'error';

export interface AgentState {
  id: string;
  name: string;
  color: string;
  icon: string; // Lucide icon name
  status: AgentStatus;
  progress: string; // Current activity text
  result?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}