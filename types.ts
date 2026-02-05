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
  data: string; // Base64
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