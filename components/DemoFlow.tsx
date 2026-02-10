import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  Palette,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileText,
  Search,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  X,
  FileType,
  Brain,
  Tag,
  Check,
  ImagePlus,
  Paintbrush,
  ShieldCheck,
  HelpCircle,
  AlertOctagon,
} from 'lucide-react';
import {
  inferSectorFromContent,
  generateDemoSlidesEnhanced,
  scanCourseFindings,
  generateAsset,
  generatePresentationTheme,
  verifyFindings,
  generateQuizQuestions,
  generateCourseSummary,
  generateStudyGuide,
  generateSlideContent,
  selectInfographicSlide,
  QuizQuestion,
  StudyGuideSection,
  GeneratedSlide,
  SlideContentResult,
} from '../services/geminiService';
import { processFileForUpload } from '../services/supabaseClient';
import { extractPdfPageImages } from '../utils/pdfPageRenderer';
import { extractPdfPageText } from '../utils/pdfTextExtractor';
import { useGoogleDrivePicker } from '../hooks/useGoogleDrivePicker';
import GoogleDriveButton from './GoogleDriveButton';
import RegulatoryOutput from './RegulatoryOutput';
import VisualOutput from './VisualOutput';
import {
  UpdateMode,
  InferredSector,
  DemoResult,
  DemoSlideEnhanced,
  IngestedFile,
  FileUploadProgress,
  CourseFinding,
  FindingsScanResult,
  ExtractedPageData,
  GeneratedTheme,
  ThemeOption,
  AgentState,
  AgentStatus,
  VerifiedFinding,
  CourseSummaryResult,
} from '../types';
import LocationInput from './LocationInput';

interface DemoFlowProps {
  onBack: () => void;
}

// Predefined sectors for the dropdown — grouped by category
const SECTORS = [
  // Regulated / Safety-Critical
  'Healthcare',
  'Construction',
  'Manufacturing',
  'Food Service',
  'Transportation & Logistics',
  'Aviation',
  'Finance & Banking',
  'Energy & Utilities',
  'Legal & Compliance',
  'Pharmaceuticals',
  // Technology
  'Information Technology',
  'Cloud Computing',
  'Cybersecurity',
  'Software Engineering',
  'Data Science & AI',
  'Telecommunications',
  // Professional Services
  'Education & Training',
  'Human Resources',
  'Project Management',
  'Real Estate',
  'Insurance',
  'Accounting & Audit',
  // Other Industries
  'Hospitality & Tourism',
  'Retail & E-Commerce',
  'Government & Public Sector',
  'Nonprofit & NGO',
  'Agriculture',
  'Mining & Resources',
  'Environmental & Sustainability',
  'Media & Communications',
  'Other'
];

const STYLES = [
  { id: 'modern', label: 'Modern Professional', description: 'White background, blue accent, clean corporate feel' },
  { id: 'playful', label: 'Warm & Engaging', description: 'Light warm tones, orange accent, friendly and approachable' },
  { id: 'minimal', label: 'Minimalist', description: 'Near-white, monochrome, maximum whitespace' },
  { id: 'academic', label: 'Academic & Formal', description: 'Dark navy, gold accents, scholarly authority' }
];

const FONT_OPTIONS = [
  { name: 'Inter', description: 'Clean & modern' },
  { name: 'Poppins', description: 'Friendly & geometric' },
  { name: 'Playfair Display', description: 'Elegant & editorial' },
  { name: 'Source Sans Pro', description: 'Professional & neutral' },
  { name: 'Raleway', description: 'Light & contemporary' },
  { name: 'Merriweather', description: 'Warm & readable' },
];

// Static theme options — no AI generation needed
const STATIC_THEME_OPTIONS: ThemeOption[] = [
  {
    name: 'Clean & Light',
    description: 'Airy and modern with warm white space and teal accents',
    backgroundColor: '#fafaf9', textColor: '#1c1917', primaryColor: '#0d9488',
    secondaryColor: '#5eead4', mutedTextColor: '#78716c', fontSuggestion: 'Inter', layoutStyle: 'minimal',
  },
  {
    name: 'Midnight Bold',
    description: 'High-contrast dark navy with bright amber highlights',
    backgroundColor: '#0f172a', textColor: '#f8fafc', primaryColor: '#f59e0b',
    secondaryColor: '#fbbf24', mutedTextColor: '#94a3b8', fontSuggestion: 'Space Grotesk', layoutStyle: 'bold',
  },
  {
    name: 'Warm Sunset',
    description: 'Inviting cream tones with warm red energy',
    backgroundColor: '#fef3c7', textColor: '#451a03', primaryColor: '#dc2626',
    secondaryColor: '#f97316', mutedTextColor: '#92400e', fontSuggestion: 'DM Sans', layoutStyle: 'organic',
  },
  {
    name: 'Ocean Professional',
    description: 'Deep blue authority with cool sky blue accents',
    backgroundColor: '#0c4a6e', textColor: '#e0f2fe', primaryColor: '#38bdf8',
    secondaryColor: '#7dd3fc', mutedTextColor: '#7dd3fc', fontSuggestion: 'IBM Plex Sans', layoutStyle: 'structured',
  },
  {
    name: 'Forest & Gold',
    description: 'Rich green prestige with gold accent flourishes',
    backgroundColor: '#14532d', textColor: '#f0fdf4', primaryColor: '#eab308',
    secondaryColor: '#a3e635', mutedTextColor: '#86efac', fontSuggestion: 'Playfair Display', layoutStyle: 'editorial',
  },
  {
    name: 'Neon Tech',
    description: 'Edgy dark zinc with vibrant purple glow',
    backgroundColor: '#18181b', textColor: '#e4e4e7', primaryColor: '#a855f7',
    secondaryColor: '#c084fc', mutedTextColor: '#71717a', fontSuggestion: 'Outfit', layoutStyle: 'geometric',
  },
];

// Agent definitions for orchestration panel (regulatory/full mode — 4 agents)
const INITIAL_AGENTS: Omit<AgentState, 'status' | 'progress'>[] = [
  { id: 'fact-checker', name: 'Fact Checker', color: '#3b82f6', icon: 'shield-check' },
  { id: 'slide-designer', name: 'Slide Designer', color: '#c8956c', icon: 'palette' },
  { id: 'quiz-builder', name: 'Quiz Builder', color: '#8b5cf6', icon: 'help-circle' },
  { id: 'course-summary', name: 'Course Summary', color: '#10b981', icon: 'file-text' },
];

// Agent definitions for visual/design mode — 3 agents
const VISUAL_AGENTS: Omit<AgentState, 'status' | 'progress'>[] = [
  { id: 'study-guide-agent', name: 'Study Guide Agent', color: '#10b981', icon: 'file-text' },
  { id: 'slide-deck-agent', name: 'Slide Deck Agent', color: '#c8956c', icon: 'palette' },
  { id: 'quiz-agent', name: 'Quiz Agent', color: '#8b5cf6', icon: 'help-circle' },
];

// Agent definitions for full mode — both regulatory + visual
const FULL_AGENTS: Omit<AgentState, 'status' | 'progress'>[] = [
  { id: 'fact-checker', name: 'Fact Checker', color: '#3b82f6', icon: 'shield-check' },
  { id: 'slide-designer', name: 'Slide Designer', color: '#ef4444', icon: 'palette' },
  { id: 'study-guide-agent', name: 'Study Guide Agent', color: '#10b981', icon: 'file-text' },
  { id: 'slide-deck-agent', name: 'Slide Deck Agent', color: '#c8956c', icon: 'palette' },
  { id: 'quiz-agent', name: 'Quiz Agent', color: '#8b5cf6', icon: 'help-circle' },
  { id: 'course-summary', name: 'Course Summary', color: '#06b6d4', icon: 'file-text' },
];

const AGENT_PROGRESS_TEXT: Record<string, string[]> = {
  'fact-checker': ['Searching current standards...', 'Cross-referencing sources...', 'Verifying claims...', 'Compiling verification report...'],
  'slide-designer': ['Reading course materials...', 'Designing layouts...', 'Generating visuals...', 'Polishing slides...'],
  'quiz-builder': ['Identifying key concepts...', 'Crafting questions...', 'Validating answers...', 'Finalizing quiz...'],
  'course-summary': ['Analyzing structure...', 'Mapping objectives...', 'Building overview...', 'Summarizing course...'],
  'study-guide-agent': ['Reading course materials...', 'Extracting key concepts...', 'Fact-checking with Gemini Search...', 'Finalizing study guide...'],
  'slide-deck-agent': ['Analyzing content structure...', 'Generating slide content...', 'Applying theme styles...', 'Verifying data coverage...'],
  'quiz-agent': ['Waiting for study guide...', 'Identifying testable concepts...', 'Crafting exam questions...', 'Finalizing quiz module...'],
};

// Lucide icon map for agent cards
const agentIconMap: Record<string, React.ReactNode> = {
  'shield-check': <ShieldCheck className="w-5 h-5" />,
  'palette': <Palette className="w-5 h-5" />,
  'help-circle': <HelpCircle className="w-5 h-5" />,
  'file-text': <FileText className="w-5 h-5" />,
};

const DemoFlow: React.FC<DemoFlowProps> = ({ onBack }) => {
  // Flow state
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Update Mode
  const [updateMode, setUpdateMode] = useState<UpdateMode | null>(null);

  // Step 2: Content
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<IngestedFile[]>([]);

  // Step 3: Sector & Location (inferred + editable)
  const [inferredSector, setInferredSector] = useState<InferredSector | null>(null);
  const [selectedSector, setSelectedSector] = useState('');
  const [location, setLocation] = useState('');
  const [isInferring, setIsInferring] = useState(false);
  const [deselectedTopics, setDeselectedTopics] = useState<Set<string>>(new Set());

  // Progressive analysis phases
  const [analysisPhase, setAnalysisPhase] = useState(0);
  // Phase 0: idle, 1: reading files, 2: identifying sector, 3: mapping topics, 4: building profile, 5: done

  // Step 4: Style
  const [style, setStyle] = useState('modern');

  // Step 5: Results
  const [result, setResult] = useState<DemoResult | null>(null);

  // Step 4: Findings Review (NEW — two-stage flow)
  const [findings, setFindings] = useState<CourseFinding[]>([]);
  const [findingsScanResult, setFindingsScanResult] = useState<FindingsScanResult | null>(null);
  const [isScanningFindings, setIsScanningFindings] = useState(false);
  const [findingsPhase, setFindingsPhase] = useState(0);
  // Phase 0: idle, 1: reading materials, 2: researching standards, 3: identifying opportunities, 4: done
  const [approvedFindingIds, setApprovedFindingIds] = useState<Set<string>>(new Set());
  const [userContext, setUserContext] = useState('');
  const [designQuestions, setDesignQuestions] = useState<{
    audience?: string;
    feeling?: string;
    emphasis?: string;
  }>({});
  const [currentFindingIndex, setCurrentFindingIndex] = useState(0);
  const [findingsReviewComplete, setFindingsReviewComplete] = useState(false);

  // Step 5: Style (was step 4)
  // Step 6: Results (was step 5)

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([]);

  // PDF page images — extracted thumbnails for "before" slides
  const [pageImages, setPageImages] = useState<string[]>([]);

  // Design mode — text extraction + AI theme
  const [extractedPages, setExtractedPages] = useState<ExtractedPageData[]>([]);
  const [generatedTheme, setGeneratedTheme] = useState<GeneratedTheme | null>(null);
  const [brandLogo, setBrandLogo] = useState<string | null>(null); // data URL
  const [themeQuestionnaire, setThemeQuestionnaire] = useState<{
    brandPersonality?: string;
    audience?: string;
    desiredFeeling?: string;
    primaryColor?: string;
  }>({});
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

  // AI-generated theme options (step 5)
  const [aiThemeOptions] = useState<ThemeOption[]>(STATIC_THEME_OPTIONS);
  const isLoadingThemeOptions = false;
  const [selectedThemeIndex, setSelectedThemeIndex] = useState<number | null>(null);

  // Font selection (step 5 — uses static FONT_OPTIONS)
  const [selectedFontIndex, setSelectedFontIndex] = useState<number | null>(null);

  // Agent orchestration state
  const [agentPhase, setAgentPhase] = useState<'idle' | 'running' | 'complete'>('idle');
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [verificationResults, setVerificationResults] = useState<VerifiedFinding[]>([]);
  const [quizResults, setQuizResults] = useState<QuizQuestion[]>([]);
  const [courseSummaryResult, setCourseSummaryResult] = useState<CourseSummaryResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const agentProgressIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Full mode output tab: switch between regulatory and design views
  const [fullModeTab, setFullModeTab] = useState<'regulatory' | 'design'>('regulatory');

  // Pre-generated content from visual mode agent orchestration
  const [preGeneratedStudyGuide, setPreGeneratedStudyGuide] = useState<StudyGuideSection[]>([]);
  const [preGeneratedQuiz, setPreGeneratedQuiz] = useState<QuizQuestion[]>([]);
  const [preGeneratedSlides, setPreGeneratedSlides] = useState<GeneratedSlide[]>([]);
  const [slideVerification, setSlideVerification] = useState<SlideContentResult['dataVerification'] | null>(null);
  const [slideDisclaimer, setSlideDisclaimer] = useState<string | undefined>();

  // Extract PDF pages from a raw File object (works regardless of file size)
  const extractPdfFromRawFile = useCallback((file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;
      // Extract page images (for "before" slides)
      extractPdfPageImages(dataUrl, { scale: 1.5, quality: 0.85 })
        .then(images => setPageImages(images))
        .catch(err => console.warn('PDF page extraction failed:', err));
      // Extract page text (for design mode — deterministic text extraction)
      extractPdfPageText(dataUrl)
        .then(pages => setExtractedPages(pages))
        .catch(err => console.warn('PDF text extraction failed:', err));
    };
    reader.readAsDataURL(file);
  }, []);

  // Google Drive Picker
  const handleDriveFiles = useCallback(async (driveFiles: File[]) => {
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    for (const file of driveFiles) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds 50MB limit.`);
        continue;
      }

      // Extract PDF pages from raw file BEFORE processFileForUpload (which may strip data for large files)
      extractPdfFromRawFile(file);

      setUploadProgress(prev => [...prev, {
        fileName: file.name,
        progress: 0,
        status: 'uploading' as const,
      }]);
      try {
        const ingestedFile = await processFileForUpload(
          file,
          (progress) => {
            setUploadProgress(prev => prev.map(p =>
              p.fileName === file.name ? { ...p, progress } : p
            ));
          }
        );
        setUploadProgress(prev => prev.map(p =>
          p.fileName === file.name ? { ...p, progress: 100, status: 'complete' as const } : p
        ));
        setFiles(prev => [...prev, ingestedFile]);
        if (!topic) {
          setTopic(file.name.split('.')[0].replace(/[-_]/g, ' '));
        }
      } catch (err) {
        console.error('Drive file processing error:', err);
        setUploadProgress(prev => prev.map(p =>
          p.fileName === file.name
            ? { ...p, status: 'error' as const, error: String(err) }
            : p
        ));
        setError(`Failed to process "${file.name}". Please try again.`);
      }
    }
  }, [topic, extractPdfFromRawFile]);

  const {
    openPicker: openDrivePicker,
    isLoading: isDriveLoading,
    downloadProgress: driveDownloadProgress,
    error: driveError,
  } = useGoogleDrivePicker({ onFilesSelected: handleDriveFiles });

  // Surface Drive errors
  useEffect(() => {
    if (driveError) setError(driveError);
  }, [driveError]);

  // Handle file upload — small files go inline, large files go to Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

    for (const file of Array.from(uploadedFiles) as File[]) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds 50MB limit.`);
        continue;
      }

      // Extract PDF pages from raw file BEFORE processFileForUpload (which may strip data for large files)
      extractPdfFromRawFile(file);

      // Add progress entry
      setUploadProgress(prev => [...prev, {
        fileName: file.name,
        progress: 0,
        status: 'uploading' as const,
      }]);

      try {
        const ingestedFile = await processFileForUpload(
          file,
          (progress) => {
            setUploadProgress(prev => prev.map(p =>
              p.fileName === file.name ? { ...p, progress } : p
            ));
          }
        );

        setUploadProgress(prev => prev.map(p =>
          p.fileName === file.name ? { ...p, progress: 100, status: 'complete' as const } : p
        ));

        setFiles(prev => [...prev, ingestedFile]);

        // Auto-fill topic from first file name if empty
        if (!topic) {
          setTopic(file.name.split('.')[0].replace(/[-_]/g, ' '));
        }
      } catch (err) {
        console.error('File upload error:', err);
        setUploadProgress(prev => prev.map(p =>
          p.fileName === file.name
            ? { ...p, status: 'error' as const, error: String(err) }
            : p
        ));
        setError(`Failed to upload "${file.name}". Please try again.`);
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Fallback: extract PDF page images + text from inline data for small files
  // (Large files are handled at upload time via extractPdfFromRawFile)
  useEffect(() => {
    if (pageImages.length > 0) return; // Already extracted from raw file
    const pdfFile = files.find(f => f.type === 'application/pdf' && f.data);
    if (!pdfFile || !pdfFile.data) return;
    let cancelled = false;
    extractPdfPageImages(pdfFile.data, { scale: 1.5, quality: 0.85 })
      .then(images => { if (!cancelled) setPageImages(images); })
      .catch(err => console.warn('PDF page extraction failed:', err));
    if (extractedPages.length === 0) {
      extractPdfPageText(pdfFile.data)
        .then(pages => { if (!cancelled) setExtractedPages(pages); })
        .catch(err => console.warn('PDF text extraction failed:', err));
    }
    return () => { cancelled = true; };
  }, [files, pageImages.length, extractedPages.length]);

  // Load Google Font when theme is generated
  useEffect(() => {
    if (!generatedTheme?.fontSuggestion) return;
    const fontName = generatedTheme.fontSuggestion;
    const linkId = `google-font-${fontName.replace(/\s+/g, '-')}`;
    if (document.getElementById(linkId)) return;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;600;700;800&display=swap`;
    document.head.appendChild(link);
  }, [generatedTheme?.fontSuggestion]);

  // Theme options are now static — no AI generation needed

  // Preload all 6 static font options from Google Fonts
  useEffect(() => {
    FONT_OPTIONS.forEach(f => {
      const linkId = `google-font-${f.name.replace(/\s+/g, '-')}`;
      if (document.getElementById(linkId)) return;
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.name)}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
    });
  }, []);

  // Infer sector when moving to step 3
  useEffect(() => {
    if (step === 3 && !inferredSector && (files.length > 0 || topic)) {
      inferSector();
    }
  }, [step]);

  const inferSector = useCallback(async () => {
    setIsInferring(true);
    setError(null);
    setAnalysisPhase(1); // Reading files

    // Phase 1: Reading documents
    await new Promise(r => setTimeout(r, 1400));
    setAnalysisPhase(2); // Identifying sector

    try {
      // Fire the API call, but enforce minimum display time for phase 2
      const inferencePromise = inferSectorFromContent(topic, files);
      const phase2MinWait = new Promise(r => setTimeout(r, 2200));

      const [result] = await Promise.all([inferencePromise, phase2MinWait]);

      // Store result but reveal progressively
      setInferredSector(result);

      // Phase 3: Show industry identified — let the user see it
      setAnalysisPhase(3);
      await new Promise(r => setTimeout(r, 1800));

      // Phase 4: Mapping key topics — show the specific topics discovered
      setAnalysisPhase(4);
      await new Promise(r => setTimeout(r, 1500));

      // Extract the primary sector to match SECTORS dropdown
      const sectorParts = result.sector.split(',').map((s: string) => s.trim());
      // Try exact match first, then case-insensitive partial match, then first part
      const matchedSector = SECTORS.find(s => sectorParts.includes(s))
        || SECTORS.find(s => sectorParts.some(sp => s.toLowerCase().includes(sp.toLowerCase()) || sp.toLowerCase().includes(s.toLowerCase())))
        || (SECTORS.includes(sectorParts[0]) ? sectorParts[0] : '')
        || result.sector;
      if (matchedSector && SECTORS.includes(matchedSector)) {
        setSelectedSector(matchedSector);
      }
      // If no SECTORS match, leave dropdown empty so user picks manually

      // Phase 5: done — brief hold before transitioning
      setAnalysisPhase(5);
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error('Sector inference error:', err);
      setError('Could not analyze content. Please select an industry manually.');
      setAnalysisPhase(0);
    } finally {
      setIsInferring(false);
    }
  }, [topic, files]);

  // Scan for findings when entering step 4
  const runFindingsScan = useCallback(async () => {
    if (!updateMode || !selectedSector) return;

    setIsScanningFindings(true);
    setError(null);
    setFindingsPhase(1); // Cross-referencing standards

    try {
      // Fire the API call and reveal phases progressively
      const scanPromise = scanCourseFindings(
        topic,
        selectedSector,
        location || 'United States',
        updateMode,
        files
      );

      // Phase 1 → 2 with minimum display
      const phase1Wait = new Promise(r => setTimeout(r, 1800));
      await phase1Wait;
      setFindingsPhase(2); // Checking regulatory updates

      const phase2Wait = new Promise(r => setTimeout(r, 2000));
      const [scanResult] = await Promise.all([scanPromise, phase2Wait]);

      setFindingsPhase(3); // Comparing best practices
      await new Promise(r => setTimeout(r, 1500));

      setFindingsPhase(4); // Prioritizing
      await new Promise(r => setTimeout(r, 1200));

      setFindingsScanResult(scanResult);
      setFindings(scanResult.findings);

      // Default: HIGH and MEDIUM on, LOW off
      const defaultApproved = new Set<string>();
      scanResult.findings.forEach(f => {
        if (f.severity === 'high' || f.severity === 'medium') {
          defaultApproved.add(f.id);
        }
      });
      setApprovedFindingIds(defaultApproved);

      setFindingsPhase(5); // Done
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error('Findings scan error:', err);
      setError('Could not scan course. You can retry or skip to generate directly.');
      setFindingsPhase(0);
    } finally {
      setIsScanningFindings(false);
    }
  }, [topic, selectedSector, location, updateMode, files]);

  // Trigger findings scan when entering step 4 — only for regulatory/full modes
  useEffect(() => {
    if (step === 4 && updateMode !== 'visual' && !findingsScanResult && !isScanningFindings) {
      runFindingsScan();
    }
  }, [step]);

  // Helper: update a single agent's state
  const updateAgent = (agentId: string, updates: Partial<AgentState>) => {
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, ...updates } : a));
  };

  // Helper: start cycling progress text for an agent
  const startProgressCycle = (agentId: string) => {
    const texts = AGENT_PROGRESS_TEXT[agentId] || ['Working...'];
    let idx = 0;
    updateAgent(agentId, { progress: texts[0] });
    const interval = setInterval(() => {
      idx = (idx + 1) % texts.length;
      updateAgent(agentId, { progress: texts[idx] });
    }, 2500);
    agentProgressIntervals.current[agentId] = interval;
  };

  // Helper: stop cycling progress text for an agent
  const stopProgressCycle = (agentId: string) => {
    if (agentProgressIntervals.current[agentId]) {
      clearInterval(agentProgressIntervals.current[agentId]);
      delete agentProgressIntervals.current[agentId];
    }
  };

  // Cleanup progress intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(agentProgressIntervals.current).forEach(clearInterval);
    };
  }, []);

  // Generate slides — multi-agent orchestration
  const handleGenerate = async () => {
    if (!updateMode || !selectedSector) return;

    setIsProcessing(true);
    setError(null);

    // Initialize all 4 agents
    const initialAgents: AgentState[] = INITIAL_AGENTS.map(a => ({
      ...a,
      status: 'idle' as AgentStatus,
      progress: 'Waiting...',
    }));
    setAgents(initialAgents);
    setAgentPhase('running');
    setShowResults(false);
    setStep(6);

    const approved = findings.filter(f => approvedFindingIds.has(f.id));

    // Launch all 4 agents in parallel with staggered starts
    const launchAgent = async (
      agentId: string,
      staggerMs: number,
      work: () => Promise<void>,
    ) => {
      await new Promise(r => setTimeout(r, staggerMs));
      updateAgent(agentId, { status: 'working', startedAt: Date.now() });
      startProgressCycle(agentId);
      try {
        await work();
        stopProgressCycle(agentId);
        updateAgent(agentId, { status: 'complete', completedAt: Date.now() });
      } catch (err) {
        stopProgressCycle(agentId);
        console.error(`Agent ${agentId} error:`, err);
        updateAgent(agentId, {
          status: 'error',
          error: String(err),
          progress: 'Failed',
          completedAt: Date.now(),
        });
      }
    };

    const agentPromises = Promise.allSettled([
      // Agent 1: Fact Checker
      launchAgent('fact-checker', 0, async () => {
        if (approved.length > 0) {
          const vResult = await verifyFindings(approved, selectedSector, location || 'United States');
          setVerificationResults(vResult.findings);
          updateAgent('fact-checker', {
            result: `${vResult.findings.length} findings verified`,
          });
        } else {
          updateAgent('fact-checker', { result: 'No findings to verify' });
        }
      }),

      // Agent 2: Slide Designer
      launchAgent('slide-designer', 300, async () => {
        const demoResult = await generateDemoSlidesEnhanced(
          topic,
          selectedSector,
          location || 'United States',
          updateMode,
          style,
          files,
          approved.length > 0 ? approved : undefined,
          userContext || undefined,
          Object.keys(designQuestions).length > 0 ? designQuestions : undefined
        );
        setResult(demoResult);
        updateAgent('slide-designer', {
          result: `${demoResult.slides.length} slides generated`,
        });

        // Fire off parallel image generation for each slide with an imagePrompt
        const slidesWithPrompts = demoResult.slides
          .map((s, i) => ({ index: i, prompt: s.imagePrompt }))
          .filter((s): s is { index: number; prompt: string } => !!s.prompt);

        if (slidesWithPrompts.length > 0) {
          slidesWithPrompts.forEach(async ({ index, prompt }) => {
            try {
              const imageUrl = await generateAsset(prompt);
              if (imageUrl) {
                setResult(prev => {
                  if (!prev) return prev;
                  const updated = { ...prev, slides: [...prev.slides] };
                  updated.slides[index] = { ...updated.slides[index], imageUrl };
                  return updated;
                });
              }
            } catch (err) {
              console.warn(`Image gen failed for slide ${index}:`, err);
            }
          });
        }
      }),

      // Agent 3: Quiz Builder
      launchAgent('quiz-builder', 600, async () => {
        const qResult = await generateQuizQuestions(topic, selectedSector, files);
        setQuizResults(qResult.questions);
        updateAgent('quiz-builder', {
          result: `${qResult.questions.length} questions created`,
        });
      }),

      // Agent 4: Course Summary
      launchAgent('course-summary', 200, async () => {
        const sResult = await generateCourseSummary(topic, selectedSector, files);
        setCourseSummaryResult(sResult);
        updateAgent('course-summary', {
          result: sResult.courseTitle || 'Summary ready',
        });
      }),
    ]);

    await agentPromises;
    setAgentPhase('complete');
    setIsProcessing(false);
  };

  // Build slides from extracted text + generated theme (design mode — no AI for content)
  const buildVisualResult = useCallback((pages: ExtractedPageData[], theme: GeneratedTheme): DemoResult => {
    // Pick the 3 best content-rich pages that have corresponding images
    // Prioritize TEXT_HEAVY (most content to showcase), then others
    const candidates = pages
      .filter(p => pageImages[p.pageNumber - 1]) // must have a rendered image
      .sort((a, b) => {
        // TEXT_HEAVY first, then INFOGRAPHIC, then TITLE
        const classOrder = { TEXT_HEAVY: 0, INFOGRAPHIC: 1, TITLE: 2 };
        const classDiff = classOrder[a.classification] - classOrder[b.classification];
        if (classDiff !== 0) return classDiff;
        // Within same classification, prefer higher text density
        return b.textDensityScore - a.textDensityScore;
      })
      .slice(0, 3);

    const layoutCycle = ['hero', 'two-column', 'stats-highlight'] as const;
    const changeSummaryCycle = ['REDESIGNED', 'VISUAL HIERARCHY', 'MODERNIZED LAYOUT'];

    const slides: DemoSlideEnhanced[] = candidates.map((page, idx) => ({
      id: `slide-${idx + 1}`,
      before: {
        title: page.title || `Page ${page.pageNumber}`,
        subtitle: page.subtitle || '',
        bullets: page.bullets || [],
        citationIds: [],
        sourcePageNumber: page.pageNumber,
      },
      after: {
        title: page.title || `Page ${page.pageNumber}`,
        subtitle: page.subtitle || '',
        bullets: page.bullets || [],
        citationIds: [],
        sourcePageNumber: page.pageNumber,
      },
      changesSummary: changeSummaryCycle[idx % changeSummaryCycle.length],
      visualStyle: {
        accentColor: theme.primaryColor,
        layout: layoutCycle[idx % layoutCycle.length],
        pageClassification: page.classification,
      },
    }));

    return {
      slides,
      citations: [],
      metadata: {
        sector: selectedSector || 'General',
        location: location || 'United States',
        updateMode: 'visual',
        generatedAt: new Date().toISOString(),
        searchQueries: [],
      },
    };
  }, [pageImages, selectedSector, location]);

  // Generate theme and build visual result with agent orchestration (design mode)
  const handleDesignGenerateWithAgents = async () => {
    setIsGeneratingTheme(true);
    setError(null);

    try {
      if (pageImages.length === 0) {
        setError('No pages could be rendered from the PDF. Please try a different file.');
        setIsGeneratingTheme(false);
        return;
      }

      // Use the AI-generated or fallback theme option
      const themes = aiThemeOptions || [];
      const selected = selectedThemeIndex !== null && themes[selectedThemeIndex]
        ? themes[selectedThemeIndex]
        : themes[0];

      if (!selected) {
        setError('Please select a theme first.');
        setIsGeneratingTheme(false);
        return;
      }

      // If user provided a custom brand color, use it as the accent
      const userColor = themeQuestionnaire.primaryColor;
      const selectedFont = selectedFontIndex !== null
        ? FONT_OPTIONS[selectedFontIndex].name
        : selected.fontSuggestion;

      const theme: GeneratedTheme = {
        backgroundColor: selected.backgroundColor,
        textColor: selected.textColor,
        primaryColor: userColor || selected.primaryColor,
        secondaryColor: selected.secondaryColor,
        mutedTextColor: selected.mutedTextColor,
        fontSuggestion: selectedFont,
        layoutStyle: selected.layoutStyle,
        designReasoning: selected.description,
      };
      setGeneratedTheme(theme);

      // Build the basic visual result (used as fallback)
      const demoResult = buildVisualResult(extractedPages, theme);
      setResult(demoResult);

      // Initialize 3 visual agents and show orchestration panel
      const initialAgents: AgentState[] = VISUAL_AGENTS.map(a => ({
        ...a,
        status: 'idle' as AgentStatus,
        progress: 'Waiting...',
      }));
      setAgents(initialAgents);
      setAgentPhase('running');
      setShowResults(false);
      setStep(6);
      setIsGeneratingTheme(false);

      // Helper to launch an agent with staggered start
      const launchAgent = async (
        agentId: string,
        staggerMs: number,
        work: () => Promise<void>,
      ) => {
        await new Promise(r => setTimeout(r, staggerMs));
        updateAgent(agentId, { status: 'working', startedAt: Date.now() });
        startProgressCycle(agentId);
        try {
          await work();
          stopProgressCycle(agentId);
          updateAgent(agentId, { status: 'complete', completedAt: Date.now() });
        } catch (err) {
          stopProgressCycle(agentId);
          console.error(`Agent ${agentId} error:`, err);
          updateAgent(agentId, {
            status: 'error',
            error: String(err),
            progress: 'Failed',
            completedAt: Date.now(),
          });
        }
      };

      // Study guide + Slide deck run in parallel. Quiz waits for study guide.
      let studyGuideSections: StudyGuideSection[] = [];

      console.log('[Visual Agents] Starting orchestration', { topic, selectedSector, fileCount: files.length, fileNames: files.map(f => f.name) });

      const studyGuidePromise = launchAgent('study-guide-agent', 0, async () => {
        console.log('[Study Guide Agent] Calling generateStudyGuide...');
        const sgResult = await generateStudyGuide(topic, selectedSector, files);
        console.log('[Study Guide Agent] Result:', sgResult.sections.length, 'sections');
        if (sgResult.sections.length === 0) {
          throw new Error('Study guide returned 0 sections — API may have failed');
        }
        studyGuideSections = sgResult.sections;
        setPreGeneratedStudyGuide(sgResult.sections);
        updateAgent('study-guide-agent', {
          result: `${sgResult.sections.length} sections generated`,
        });
      });

      const slideDeckPromise = launchAgent('slide-deck-agent', 200, async () => {
        console.log('[Slide Deck Agent] Calling generateSlideContent...');
        const scResult = await generateSlideContent(
          topic,
          selectedSector,
          files,
          { name: selected.name, description: selected.description },
        );
        console.log('[Slide Deck Agent] Result:', scResult.slides.length, 'slides');
        if (scResult.slides.length === 0) {
          throw new Error('Slide content returned 0 slides — API may have failed');
        }
        setSlideVerification(scResult.dataVerification || null);
        if (scResult.disclaimer) setSlideDisclaimer(scResult.disclaimer);

        // Phase 2: Gemini Reasoning picks the best slide for an infographic
        updateAgent('slide-deck-agent', { progress: 'Selecting slide for infographic...' });
        console.log('[Slide Deck Agent] Selecting infographic slide...');
        const infographicSelection = await selectInfographicSlide(scResult.slides, topic, selectedSector);
        console.log('[Slide Deck Agent] Selected slide', infographicSelection.selectedSlideIndex, ':', infographicSelection.reasoning);

        // Phase 3: Generate infographic image
        updateAgent('slide-deck-agent', { progress: 'Generating infographic...' });
        console.log('[Slide Deck Agent] Generating infographic with prompt:', infographicSelection.imagePrompt.slice(0, 100));
        const infographicUrl = await generateAsset(infographicSelection.imagePrompt);

        // Attach infographic to the selected slide
        const slidesWithInfographic = scResult.slides.map((s, i) =>
          i === infographicSelection.selectedSlideIndex && infographicUrl
            ? { ...s, imageUrl: infographicUrl }
            : s
        );
        setPreGeneratedSlides(slidesWithInfographic);

        updateAgent('slide-deck-agent', {
          result: `${scResult.slides.length} slides + infographic${scResult.dataVerification ? ` — ${scResult.dataVerification.coveragePercentage}% coverage` : ''}`,
        });
      });

      // Wait for study guide to finish before launching quiz (but don't block if it failed)
      await studyGuidePromise;

      // Launch quiz agent — uses study guide sections if available, falls back to topic-only
      const quizPromise = launchAgent('quiz-agent', 0, async () => {
        console.log('[Quiz Agent] Calling generateQuizQuestions with', studyGuideSections.length, 'study guide sections...');
        const qResult = await generateQuizQuestions(topic, selectedSector, files, studyGuideSections.length > 0 ? studyGuideSections : undefined);
        console.log('[Quiz Agent] Result:', qResult.questions.length, 'questions');
        if (qResult.questions.length === 0) {
          // Retry once without study guide context
          console.warn('[Quiz Agent] 0 questions, retrying without study guide...');
          const retry = await generateQuizQuestions(topic, selectedSector, files);
          if (retry.questions.length === 0) {
            throw new Error('Quiz returned 0 questions after retry');
          }
          setPreGeneratedQuiz(retry.questions);
          updateAgent('quiz-agent', { result: `${retry.questions.length} questions created` });
          return;
        }
        setPreGeneratedQuiz(qResult.questions);
        updateAgent('quiz-agent', {
          result: `${qResult.questions.length} questions created`,
        });
      });

      // Wait for slide deck and quiz to finish
      await Promise.allSettled([slideDeckPromise, quizPromise]);
      setAgentPhase('complete');
      setIsProcessing(false);
    } catch (err) {
      console.error('Design generation error:', err);
      setError('Failed to generate design. Please try again.');
      setIsGeneratingTheme(false);
    }
  };

  // Full mode: combined regulatory + visual agent orchestration
  const handleFullGenerate = async () => {
    setIsGeneratingTheme(true);
    setError(null);

    try {
      // Build theme from selected vibe (same as visual mode)
      const themes = aiThemeOptions || [];
      const selected = selectedThemeIndex !== null && themes[selectedThemeIndex]
        ? themes[selectedThemeIndex]
        : themes[0];

      if (selected) {
        const userColor = themeQuestionnaire.primaryColor;
        const selectedFont = selectedFontIndex !== null
          ? FONT_OPTIONS[selectedFontIndex].name
          : selected.fontSuggestion;

        const theme: GeneratedTheme = {
          backgroundColor: selected.backgroundColor,
          textColor: selected.textColor,
          primaryColor: userColor || selected.primaryColor,
          secondaryColor: selected.secondaryColor,
          mutedTextColor: selected.mutedTextColor,
          fontSuggestion: selectedFont,
          layoutStyle: selected.layoutStyle,
          designReasoning: selected.description,
        };
        setGeneratedTheme(theme);

        // Build the basic visual result as fallback
        const demoResult = buildVisualResult(extractedPages, theme);
        setResult(demoResult);
      }

      // Initialize 6 agents (regulatory + visual)
      const initialAgents: AgentState[] = FULL_AGENTS.map(a => ({
        ...a,
        status: 'idle' as AgentStatus,
        progress: 'Waiting...',
      }));
      setAgents(initialAgents);
      setAgentPhase('running');
      setShowResults(false);
      setStep(6);
      setIsGeneratingTheme(false);

      const approved = findings.filter(f => approvedFindingIds.has(f.id));
      let studyGuideSections: StudyGuideSection[] = [];

      // Helper: launch an agent with staggered start
      const launchAgentFull = async (
        agentId: string,
        staggerMs: number,
        work: () => Promise<void>,
      ) => {
        await new Promise(r => setTimeout(r, staggerMs));
        updateAgent(agentId, { status: 'working', startedAt: Date.now() });
        startProgressCycle(agentId);
        try {
          await work();
          stopProgressCycle(agentId);
          updateAgent(agentId, { status: 'complete', completedAt: Date.now() });
        } catch (err) {
          stopProgressCycle(agentId);
          console.error(`Agent ${agentId} error:`, err);
          updateAgent(agentId, {
            status: 'error',
            error: String(err),
            progress: 'Failed',
            completedAt: Date.now(),
          });
        }
      };

      // Launch all independent agents in parallel
      // Regulatory: Fact Checker, Slide Designer, Course Summary
      const factCheckerPromise = launchAgentFull('fact-checker', 0, async () => {
        if (approved.length > 0) {
          const vResult = await verifyFindings(approved, selectedSector, location || 'United States');
          setVerificationResults(vResult.findings);
          updateAgent('fact-checker', { result: `${vResult.findings.length} findings verified` });
        } else {
          updateAgent('fact-checker', { result: 'No findings to verify' });
        }
      });

      const slideDesignerPromise = launchAgentFull('slide-designer', 300, async () => {
        const demoResult = await generateDemoSlidesEnhanced(
          topic, selectedSector, location || 'United States', updateMode || 'full',
          style, files,
          approved.length > 0 ? approved : undefined,
          userContext || undefined,
          Object.keys(designQuestions).length > 0 ? designQuestions : undefined
        );
        setResult(demoResult);
        updateAgent('slide-designer', { result: `${demoResult.slides.length} slides generated` });
      });

      const courseSummaryPromise = launchAgentFull('course-summary', 200, async () => {
        const sResult = await generateCourseSummary(topic, selectedSector, files);
        setCourseSummaryResult(sResult);
        updateAgent('course-summary', { result: sResult.courseTitle || 'Summary ready' });
      });

      // Visual: Study Guide (then Quiz), Slide Deck (then infographic)
      const studyGuidePromise = launchAgentFull('study-guide-agent', 100, async () => {
        const sgResult = await generateStudyGuide(topic, selectedSector, files);
        if (sgResult.sections.length === 0) throw new Error('Study guide returned 0 sections');
        studyGuideSections = sgResult.sections;
        setPreGeneratedStudyGuide(sgResult.sections);
        updateAgent('study-guide-agent', { result: `${sgResult.sections.length} sections generated` });
      });

      const slideDeckPromise = launchAgentFull('slide-deck-agent', 400, async () => {
        const scResult = await generateSlideContent(
          topic, selectedSector, files,
          selected ? { name: selected.name, description: selected.description } : undefined,
        );
        if (scResult.slides.length === 0) throw new Error('Slide content returned 0 slides');
        setSlideVerification(scResult.dataVerification || null);
        if (scResult.disclaimer) setSlideDisclaimer(scResult.disclaimer);

        // Infographic selection + generation
        updateAgent('slide-deck-agent', { progress: 'Selecting slide for infographic...' });
        const infographicSelection = await selectInfographicSlide(scResult.slides, topic, selectedSector);
        updateAgent('slide-deck-agent', { progress: 'Generating infographic...' });
        const infographicUrl = await generateAsset(infographicSelection.imagePrompt);
        const slidesWithInfographic = scResult.slides.map((s, i) =>
          i === infographicSelection.selectedSlideIndex && infographicUrl
            ? { ...s, imageUrl: infographicUrl } : s
        );
        setPreGeneratedSlides(slidesWithInfographic);
        updateAgent('slide-deck-agent', { result: `${scResult.slides.length} slides + infographic` });
      });

      // Wait for study guide to finish, then launch quiz (falls back to topic-only if study guide failed)
      await studyGuidePromise;

      const quizPromise = launchAgentFull('quiz-agent', 0, async () => {
        const qResult = await generateQuizQuestions(topic, selectedSector, files, studyGuideSections.length > 0 ? studyGuideSections : undefined);
        if (qResult.questions.length === 0) {
          // Retry once without study guide context
          const retry = await generateQuizQuestions(topic, selectedSector, files);
          if (retry.questions.length === 0) throw new Error('Quiz returned 0 questions after retry');
          setPreGeneratedQuiz(retry.questions);
          setQuizResults(retry.questions);
          updateAgent('quiz-agent', { result: `${retry.questions.length} questions created` });
          return;
        }
        setPreGeneratedQuiz(qResult.questions);
        setQuizResults(qResult.questions);
        updateAgent('quiz-agent', { result: `${qResult.questions.length} questions created` });
      });

      // Wait for all remaining agents
      await Promise.allSettled([
        factCheckerPromise, slideDesignerPromise, courseSummaryPromise,
        slideDeckPromise, quizPromise,
      ]);
      setAgentPhase('complete');
      setIsProcessing(false);
    } catch (err) {
      console.error('Full generation error:', err);
      setError('Failed to generate. Please try again.');
      setIsGeneratingTheme(false);
    }
  };

  // Navigation helpers
  const canProceed = (): boolean => {
    switch (step) {
      case 1: return updateMode !== null;
      case 2: return topic.trim().length > 0 || files.length > 0;
      case 3: return selectedSector.length > 0;
      case 4: return findingsPhase === 5 && (findingsReviewComplete || findings.length === 0);
      case 5: return true; // Style selection / design questionnaire
      default: return false;
    }
  };

  const nextStep = () => {
    if (!canProceed()) return;

    if (step === 3 && updateMode === 'visual') {
      // Visual-only: skip findings scan (step 4), go to design questionnaire (step 5)
      setStep(5);
    } else if (step === 4) {
      // After findings review: skip style for regulatory-only, go to style for full
      if (updateMode === 'regulatory') {
        handleGenerate();
      } else {
        setStep(5);
      }
    } else if (step === 5) {
      if (updateMode === 'visual') {
        handleDesignGenerateWithAgents();
      } else {
        handleGenerate();
      }
    } else {
      setStep(s => s + 1);
    }
  };

  const prevStep = () => {
    if (step === 1) {
      onBack();
    } else if (step === 5 && updateMode === 'visual') {
      // Visual-only: back from style goes to sector (step 3), skipping findings
      setStep(3);
      setAnalysisPhase(0);
      setInferredSector(null);
      setDeselectedTopics(new Set());
    } else {
      if (step === 3) {
        // Reset analysis state when going back from step 3
        setAnalysisPhase(0);
        setInferredSector(null);
        setDeselectedTopics(new Set());
      }
      if (step === 4) {
        // Reset findings state when going back from step 4
        setFindingsScanResult(null);
        setFindings([]);
        setFindingsPhase(0);
        setApprovedFindingIds(new Set());
        setUserContext('');
        setCurrentFindingIndex(0);
        setFindingsReviewComplete(false);
      }
      setStep(s => s - 1);
    }
  };

  // Progress indicator
  // regulatory: mode → upload → sector → findings (4 steps, no style)
  // visual: mode → upload → sector → style (4 steps, no findings)
  // full: mode → upload → sector → findings → style (5 steps)
  const totalSteps = updateMode === 'full' ? 5 : 4;
  // For visual mode, step 5 (style) is the 4th visible step
  const currentProgress = updateMode === 'visual'
    ? Math.min(step === 5 ? 4 : step, totalSteps)
    : Math.min(step, totalSteps);

  const renderProgressBar = () => (
    <div className="flex justify-between mb-8 max-w-xs mx-auto">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 mx-1 rounded-full transition-all duration-300 ${
            currentProgress > i ? 'bg-accent' : 'bg-surface-border'
          }`}
        />
      ))}
    </div>
  );

  // --- STEP 1: Update Mode Selection ---
  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
          <h2 className="text-2xl font-bold text-center mb-2">What do you need?</h2>
          <p className="text-text-muted text-center mb-8">
            Choose how you'd like to update your course materials.
          </p>

          <div className="space-y-4">
            <button
              onClick={() => setUpdateMode('regulatory')}
              className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                updateMode === 'regulatory'
                  ? 'border-accent bg-accent/10'
                  : 'border-surface-border hover:border-accent/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  updateMode === 'regulatory' ? 'bg-accent text-white' : 'bg-surface text-text-muted'
                }`}>
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-primary">Regulatory Update</h3>
                  <p className="text-text-muted text-sm mt-1">
                    Fact-check regulations, update compliance info, add citations
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setUpdateMode('visual')}
              className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                updateMode === 'visual'
                  ? 'border-accent bg-accent/10'
                  : 'border-surface-border hover:border-accent/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  updateMode === 'visual' ? 'bg-accent text-white' : 'bg-surface text-text-muted'
                }`}>
                  <Palette className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-primary">Visual Update</h3>
                  <p className="text-text-muted text-sm mt-1">
                    Modernize design, improve layouts, enhance engagement
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setUpdateMode('full')}
              className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                updateMode === 'full'
                  ? 'border-accent bg-accent/10'
                  : 'border-surface-border hover:border-accent/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  updateMode === 'full' ? 'bg-accent text-white' : 'bg-surface text-text-muted'
                }`}>
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-primary">Full Refresh</h3>
                  <p className="text-text-muted text-sm mt-1">
                    Complete overhaul — regulations + visual modernization
                  </p>
                </div>
              </div>
            </button>
          </div>

          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="w-full mt-8 bg-accent text-background py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>

          <button onClick={onBack} className="w-full mt-4 text-sm text-text-muted hover:text-text-primary">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // --- STEP 2: Upload Content ---
  if (step === 2) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
          {renderProgressBar()}
          <h2 className="text-2xl font-bold text-center mb-2">Upload your materials</h2>
          <p className="text-text-muted text-center mb-8">
            {updateMode === 'visual'
              ? 'Add documents or describe your topic. We\'ll redesign them next.'
              : 'Add documents or describe your topic. We\'ll analyze them next.'
            }
          </p>

          <div className="space-y-6">
            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-surface-border rounded-xl p-8 text-center hover:bg-surface transition-colors relative">
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileUpload}
                accept=".pdf,.png,.jpg,.jpeg,.pptx,.docx"
                multiple
              />
              <div className="flex flex-col items-center text-text-muted">
                <Upload className="w-8 h-8 mb-2" />
                <span className="font-medium">Drop files here or click to upload</span>
                <span className="text-xs mt-1">PDF, Images, PPTX, DOCX</span>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-surface-border" />
              <span className="text-xs text-text-muted">or</span>
              <div className="flex-1 h-px bg-surface-border" />
            </div>

            {/* Google Drive Import */}
            <GoogleDriveButton
              onClick={openDrivePicker}
              isLoading={isDriveLoading}
            />

            {/* Drive Download Progress */}
            {driveDownloadProgress.filter(p => p.status === 'downloading').map((p) => (
              <div key={p.fileId} className="bg-surface rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    <span className="text-sm text-text-primary truncate max-w-[200px]">
                      {p.fileName}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">{p.progress}%</span>
                </div>
                <div className="w-full bg-surface-border rounded-full h-1.5">
                  <div
                    className="bg-accent h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              </div>
            ))}

            {/* Upload Progress */}
            {uploadProgress.filter(p => p.status === 'uploading').map((p, idx) => (
              <div key={`progress-${idx}`} className="bg-surface rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    <span className="text-sm text-text-primary truncate max-w-[200px]">{p.fileName}</span>
                  </div>
                  <span className="text-xs text-text-muted">{p.progress}%</span>
                </div>
                <div className="w-full bg-surface-border rounded-full h-1.5">
                  <div
                    className="bg-accent h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              </div>
            ))}

            {/* Uploaded Files List */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-surface rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-accent" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-text-primary truncate block max-w-[200px]">
                          {file.name}
                        </span>
                        {file.sizeBytes && (
                          <span className="text-xs text-text-muted">
                            {(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                            {file.storagePath ? ' · Uploaded to cloud' : ' · Inline'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-text-muted hover:text-warning transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Topic Input */}
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Topic / Subject {files.length > 0 && <span className="font-normal text-text-muted">(optional)</span>}
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Residential Plumbing Safety, Forklift Operation"
                className="w-full border border-surface-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-accent outline-none bg-card text-text-primary placeholder:text-text-muted"
              />
            </div>

            {error && (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
                {error}
              </div>
            )}

            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="w-full bg-accent text-background py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {updateMode === 'visual' ? 'Design' : 'Analyze'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- STEP 3: Confirm Sector & Location ---
  if (step === 3) {
    return (
      <div className="min-h-screen flex flex-col items-center bg-background p-6 py-12 overflow-y-auto">
        <div className="w-full max-w-lg bg-card p-8 rounded-3xl shadow-xl border border-surface-border my-auto">
          {renderProgressBar()}
          <h2 className="text-2xl font-bold text-center mb-2">
            {isInferring
              ? (updateMode === 'visual' ? 'Reading your content' : 'Analyzing your content')
              : 'Confirm details'}
          </h2>
          <p className="text-text-muted text-center mb-8">
            {isInferring
              ? (updateMode === 'visual' ? 'Identifying industry and design context...' : 'Identifying industry and relevant regulations...')
              : (updateMode === 'visual' ? 'We\'ve read your content. Verify we got it right.' : 'We\'ve analyzed your content. Verify we got it right.')}
          </p>

          {isInferring ? (
            <div className="space-y-4 py-4">
              {/* Phase 1: File detection */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                analysisPhase >= 1 ? 'bg-surface border-surface-border opacity-100' : 'opacity-0'
              }`}>
                {analysisPhase > 1 ? (
                  <Check className="w-5 h-5 text-success shrink-0" />
                ) : (
                  <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                )}
                <FileType className="w-5 h-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">Reading document{files.length > 1 ? 's' : ''}...</p>
                  {analysisPhase > 1 && files.length > 0 && (
                    <p className="text-xs text-text-muted mt-0.5 animate-in fade-in duration-300">
                      {files.map(f => {
                        const ext = f.name.split('.').pop()?.toUpperCase() || 'FILE';
                        return ext;
                      }).join(', ')} detected — {files.map(f => f.name).join(', ')}
                    </p>
                  )}
                  {analysisPhase > 1 && files.length === 0 && topic && (
                    <p className="text-xs text-text-muted mt-0.5 animate-in fade-in duration-300">
                      Topic input: "{topic.length > 60 ? topic.substring(0, 60) + '...' : topic}"
                    </p>
                  )}
                </div>
              </div>

              {/* Phase 2: Analyzing content */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                analysisPhase >= 2 ? 'bg-surface border-surface-border opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}>
                {analysisPhase > 2 ? (
                  <Check className="w-5 h-5 text-success shrink-0" />
                ) : analysisPhase === 2 ? (
                  <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 shrink-0" />
                )}
                <Search className="w-5 h-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {analysisPhase > 2 ? 'Content analyzed' : 'Analyzing content...'}
                  </p>
                  {analysisPhase > 2 && (
                    <p className="text-xs text-text-muted mt-0.5 animate-in fade-in duration-300">
                      {files.length > 0
                        ? `Scanned ${files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0) > 0
                            ? `${(files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0) / (1024 * 1024)).toFixed(1)}MB`
                            : `${files.length} file${files.length > 1 ? 's' : ''}`
                          } of course material`
                        : 'Topic description processed'
                      }
                    </p>
                  )}
                </div>
              </div>

              {/* Phase 3: Industry identification */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                analysisPhase >= 3 ? 'bg-surface border-surface-border opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}>
                {analysisPhase > 3 ? (
                  <Check className="w-5 h-5 text-success shrink-0" />
                ) : analysisPhase === 3 ? (
                  <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 shrink-0" />
                )}
                <Brain className="w-5 h-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {analysisPhase > 3 ? 'Industry identified' : 'Identifying industry...'}
                  </p>
                  {analysisPhase > 3 && inferredSector && (
                    <p className="text-xs text-success mt-0.5 animate-in fade-in duration-300">
                      {inferredSector.sector.split(',')[0]?.trim()} — {inferredSector.confidence} confidence
                    </p>
                  )}
                </div>
              </div>

              {/* Phase 4: Topic mapping */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                analysisPhase >= 4 ? 'bg-surface border-surface-border opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}>
                {analysisPhase > 4 ? (
                  <Check className="w-5 h-5 text-success shrink-0" />
                ) : analysisPhase === 4 ? (
                  <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 shrink-0" />
                )}
                <Tag className="w-5 h-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {analysisPhase > 4 ? 'Key topics mapped' : 'Mapping key topics...'}
                  </p>
                  {analysisPhase > 4 && inferredSector?.detectedTopics && inferredSector.detectedTopics.length > 0 && (
                    <p className="text-xs text-text-muted mt-0.5 animate-in fade-in duration-300">
                      {inferredSector.detectedTopics.slice(0, 4).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Industry Selection */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">
                  Industry
                </label>

                {inferredSector && (
                  <div className={`mb-3 p-3 rounded-lg flex items-start gap-3 ${
                    inferredSector.isAmbiguous
                      ? 'bg-warning/10 border border-warning/20'
                      : inferredSector.confidence === 'high'
                        ? 'bg-success/10 border border-success/20'
                        : 'bg-accent/10 border border-accent/20'
                  }`}>
                    {inferredSector.isAmbiguous ? (
                      <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${
                        inferredSector.confidence === 'high' ? 'text-success' : 'text-accent'
                      }`} />
                    )}
                    <div className="text-sm">
                      <p className={`font-medium ${
                        inferredSector.isAmbiguous ? 'text-warning' : 'text-text-primary'
                      }`}>
                        {inferredSector.isAmbiguous
                          ? 'Multiple industries detected — please confirm the primary focus'
                          : `Detected: ${selectedSector || inferredSector.sector.split(',')[0]?.trim()}`
                        }
                      </p>
                      {inferredSector.detectedTopics && inferredSector.detectedTopics.length > 0 && (
                        <p className="text-text-muted mt-1 text-xs line-clamp-2">
                          Topics: {inferredSector.detectedTopics.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <select
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                    className="w-full border border-surface-border rounded-xl px-4 py-3 appearance-none focus:ring-2 focus:ring-accent outline-none bg-card text-text-primary"
                  >
                    <option value="">Select an industry...</option>
                    {SECTORS.map(sector => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
                </div>

                {/* Detected topic tags — clickable to deselect */}
                {inferredSector?.detectedTopics && inferredSector.detectedTopics.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-text-muted mb-2">Detected topics — click to exclude:</p>
                    <div className="flex flex-wrap gap-2">
                      {inferredSector.detectedTopics.map(t => {
                        const isActive = !deselectedTopics.has(t);
                        return (
                          <button
                            key={t}
                            onClick={() => setDeselectedTopics(prev => {
                              const next = new Set(prev);
                              if (next.has(t)) next.delete(t); else next.add(t);
                              return next;
                            })}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-accent/15 border-accent/30 text-accent'
                                : 'bg-surface border-surface-border text-text-muted line-through opacity-50'
                            }`}
                          >
                            {isActive && <Check className="w-3 h-3" />}
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {inferredSector?.alternatives && inferredSector.alternatives.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs text-text-muted">Also consider:</span>
                    {inferredSector.alternatives.map(alt => (
                      <button
                        key={alt}
                        onClick={() => setSelectedSector(alt)}
                        className="text-xs px-2 py-1 rounded-full bg-surface text-text-muted hover:text-text-primary transition-colors"
                      >
                        {alt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Location Input */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">
                  Target Location
                </label>
                <LocationInput
                  value={location}
                  onChange={setLocation}
                  placeholder="e.g. Austin, TX or United Kingdom"
                />
                <p className="text-xs text-text-muted mt-2">
                  We'll search for regulations specific to this region.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex-1 bg-surface text-text-primary py-4 rounded-xl font-bold hover:bg-surface transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={nextStep}
                  disabled={!canProceed() || isProcessing}
                  className="flex-1 bg-accent text-background py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                    </>
                  ) : updateMode === 'visual' ? (
                    <>
                      Design <Palette className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Analyze <Search className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- STEP 4: Findings Review (NEW — one-at-a-time card carousel) ---
  if (step === 4) {
    const totalFindings = findings.length;
    const hasFindings = totalFindings > 0;
    const currentFinding = hasFindings ? findings[currentFindingIndex] : null;
    const isReviewingFindings = hasFindings && !findingsReviewComplete && currentFindingIndex < totalFindings;

    const handleIncludeFinding = () => {
      if (!currentFinding) return;
      setApprovedFindingIds(prev => new Set(prev).add(currentFinding.id));
      if (currentFindingIndex + 1 >= totalFindings) {
        setFindingsReviewComplete(true);
      } else {
        setCurrentFindingIndex(i => i + 1);
      }
    };

    const handleSkipFinding = () => {
      if (!currentFinding) return;
      setApprovedFindingIds(prev => {
        const next = new Set(prev);
        next.delete(currentFinding.id);
        return next;
      });
      if (currentFindingIndex + 1 >= totalFindings) {
        setFindingsReviewComplete(true);
      } else {
        setCurrentFindingIndex(i => i + 1);
      }
    };

    const handleUndoFinding = () => {
      if (currentFindingIndex > 0) {
        setCurrentFindingIndex(i => i - 1);
        setFindingsReviewComplete(false);
      }
    };

    const categoryLabels: Record<string, string> = {
      outdated: 'Outdated Content',
      missing: 'Missing Topic',
      compliance: 'Compliance Gap',
      structural: 'Structure Issue',
    };

    const severityColors: Record<string, string> = {
      high: 'bg-red-500',
      medium: 'bg-amber-500',
      low: 'bg-green-500',
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
          {renderProgressBar()}

          {isScanningFindings ? (
            // Scanning animation — each phase reflects what this step actually does
            <>
              <h2 className="text-2xl font-bold text-center mb-2">Fact-checking your course</h2>
              <p className="text-text-muted text-center mb-8">
                Comparing your content against current {selectedSector || 'industry'} standards...
              </p>
              <div className="space-y-4 py-4">
                {/* Phase 1: Cross-referencing standards */}
                <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                  findingsPhase >= 1 ? 'bg-surface border-surface-border opacity-100' : 'opacity-0'
                }`}>
                  {findingsPhase > 1 ? (
                    <Check className="w-5 h-5 text-success shrink-0" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                  )}
                  <Search className="w-5 h-5 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {findingsPhase > 1 ? 'Standards cross-referenced' : `Cross-referencing ${selectedSector || 'industry'} standards...`}
                    </p>
                    {findingsPhase > 1 && (
                      <p className="text-xs text-text-muted mt-0.5 animate-in fade-in duration-300">
                        Searched current regulations and best practices
                      </p>
                    )}
                  </div>
                </div>

                {/* Phase 2: Checking regulatory updates */}
                <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                  findingsPhase >= 2 ? 'bg-surface border-surface-border opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}>
                  {findingsPhase > 2 ? (
                    <Check className="w-5 h-5 text-success shrink-0" />
                  ) : findingsPhase === 2 ? (
                    <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                  ) : (
                    <div className="w-5 h-5 shrink-0" />
                  )}
                  <AlertCircle className="w-5 h-5 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {findingsPhase > 2 ? 'Regulatory changes checked' : `Checking ${location || 'regional'} regulatory updates...`}
                    </p>
                    {findingsPhase > 2 && (
                      <p className="text-xs text-text-muted mt-0.5 animate-in fade-in duration-300">
                        Verified against {new Date().getFullYear()} requirements
                      </p>
                    )}
                  </div>
                </div>

                {/* Phase 3: Comparing best practices */}
                <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                  findingsPhase >= 3 ? 'bg-surface border-surface-border opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}>
                  {findingsPhase > 3 ? (
                    <Check className="w-5 h-5 text-success shrink-0" />
                  ) : findingsPhase === 3 ? (
                    <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                  ) : (
                    <div className="w-5 h-5 shrink-0" />
                  )}
                  <Brain className="w-5 h-5 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {findingsPhase > 3 ? 'Best practices compared' : 'Comparing against latest best practices...'}
                    </p>
                  </div>
                </div>

                {/* Phase 4: Prioritizing findings */}
                <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                  findingsPhase >= 4 ? 'bg-surface border-surface-border opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}>
                  {findingsPhase > 4 ? (
                    <Check className="w-5 h-5 text-success shrink-0" />
                  ) : findingsPhase === 4 ? (
                    <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                  ) : (
                    <div className="w-5 h-5 shrink-0" />
                  )}
                  <Sparkles className="w-5 h-5 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {findingsPhase > 4 ? `Found ${findings.length} improvement${findings.length !== 1 ? 's' : ''}` : 'Prioritizing by impact...'}
                    </p>
                    {findingsPhase > 4 && findings.length > 0 && (
                      <p className="text-xs text-success mt-0.5 animate-in fade-in duration-300">
                        {findings.filter(f => f.severity === 'high').length} high priority, {findings.filter(f => f.severity === 'medium').length} medium
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>

          ) : isReviewingFindings && currentFinding ? (
            // One-at-a-time finding card carousel
            <div key={currentFinding.id} className="animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Header: counter + progress dots */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-medium text-text-muted">
                  Free demo finding {currentFindingIndex + 1} of {totalFindings}
                </span>
                <div className="flex gap-1.5">
                  {findings.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i < currentFindingIndex
                          ? approvedFindingIds.has(findings[i].id) ? 'bg-success' : 'bg-surface-border'
                          : i === currentFindingIndex ? 'bg-accent scale-125' : 'bg-surface-border'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Category + Severity */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {categoryLabels[currentFinding.category] || currentFinding.category}
                </span>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${severityColors[currentFinding.severity]}`} />
                  <span className="text-xs text-text-muted capitalize">{currentFinding.severity} priority</span>
                </div>
              </div>

              {/* Finding title */}
              <h3 className="text-xl font-bold text-text-primary mb-4">
                {currentFinding.title}
              </h3>

              {/* Source: what the course currently says */}
              {currentFinding.sourceSnippet && (
                <div className="bg-surface rounded-xl border border-surface-border overflow-hidden mb-4">
                  <div className="px-4 py-2 border-b border-surface-border">
                    <span className="text-xs text-text-muted font-medium">In your course</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-text-primary/70 leading-relaxed italic">
                      &ldquo;{currentFinding.sourceSnippet}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* What's changed / why it matters */}
              <p className="text-sm text-text-muted leading-relaxed mb-4">
                {currentFinding.description}
              </p>

              {/* Current correct information */}
              {currentFinding.currentInfo && (
                <div className="bg-success/5 rounded-xl border border-success/20 overflow-hidden mb-6">
                  <div className="px-4 py-2 border-b border-success/20">
                    <span className="text-xs text-success font-medium">Updated information</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-success/90 leading-relaxed">
                      {currentFinding.currentInfo}
                    </p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {currentFindingIndex > 0 && (
                  <button
                    onClick={handleUndoFinding}
                    className="px-4 py-3.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface transition-all"
                    title="Go back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleSkipFinding}
                  className="flex-1 bg-surface text-text-muted py-3.5 rounded-xl font-semibold hover:bg-surface-border hover:text-text-primary transition-all"
                >
                  Skip
                </button>
                <button
                  onClick={handleIncludeFinding}
                  className="flex-1 bg-accent text-background py-3.5 rounded-xl font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> {
                    currentFinding.category === 'outdated' ? 'Remove' :
                    currentFinding.category === 'missing' ? 'Include' : 'Update'
                  }
                </button>
              </div>
            </div>

          ) : findingsReviewComplete || (hasFindings && currentFindingIndex >= totalFindings) ? (
            // Review complete — summary + blurred pro teaser + proceed
            <>
              <div className="text-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
                <h2 className="text-2xl font-bold mb-1">Review complete</h2>
                <p className="text-text-muted">
                  {approvedFindingIds.size} of {totalFindings} free demo finding{totalFindings !== 1 ? 's' : ''} selected for update
                </p>
              </div>

              {/* Compact summary of decisions */}
              <div className="space-y-2 mb-6">
                {findings.map(f => (
                  <div key={f.id} className="flex items-center gap-3 text-sm">
                    {approvedFindingIds.has(f.id) ? (
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-text-muted shrink-0" />
                    )}
                    <span className={approvedFindingIds.has(f.id) ? 'text-text-primary' : 'text-text-muted line-through'}>
                      {f.title}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pro findings teaser — realistic locked finding rows behind glass */}
              <div className="relative mb-6 overflow-hidden rounded-xl">
                <div className="space-y-2">
                  {[
                    { title: 'Deprecated IAM Policy References', tag: 'Compliance', tagColor: 'accent' },
                    { title: 'Missing Alt Text on Architecture Diagrams', tag: 'Accessibility', tagColor: 'warning' },
                    { title: 'Outdated Service Naming Conventions', tag: 'Content', tagColor: 'text-muted' },
                    { title: 'Visual Layout & Readability Improvements', tag: 'Design', tagColor: 'success' },
                  ].map((item, i) => (
                    <div key={i} className="p-3.5 bg-surface/60 rounded-lg border border-surface-border flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 border-${item.tagColor}/40 flex-shrink-0 flex items-center justify-center`}>
                        <div className={`w-1.5 h-1.5 rounded-full bg-${item.tagColor}/40`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary/70 truncate">{item.title}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider text-${item.tagColor}/50 bg-${item.tagColor}/10 px-2 py-0.5 rounded-full flex-shrink-0`}>{item.tag}</span>
                    </div>
                  ))}
                </div>
                {/* Glass overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/60 to-card flex flex-col items-center justify-end pb-5">
                  <p className="text-sm font-bold text-accent mb-1">
                    {findingsScanResult?.totalEstimatedFindings
                      ? `${findingsScanResult.totalEstimatedFindings - totalFindings}+ more findings available`
                      : 'More findings available'
                    }
                  </p>
                  <p className="text-xs text-text-muted">Compliance, accessibility, visual design, and more</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setCurrentFindingIndex(0); setFindingsReviewComplete(false); }}
                  className="px-4 py-3.5 bg-surface text-text-primary rounded-xl font-bold hover:bg-surface-border transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Re-review
                </button>
                <button
                  onClick={nextStep}
                  disabled={!canProceed() || isProcessing}
                  className="flex-1 bg-accent text-background py-3.5 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : updateMode === 'regulatory' ? (
                    <>Generate <Sparkles className="w-4 h-4" /></>
                  ) : (
                    <>Next: Style <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </>

          ) : findingsPhase === 5 && !hasFindings ? (
            // Path B: No findings — content is current, nudge to design update
            <>
              <div className="text-center mb-8">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Your content looks current!</h2>
                <p className="text-text-muted mt-2">
                  We didn't find significant issues with your materials. Let's freshen up the design instead.
                </p>
              </div>

              <button
                onClick={() => {
                  if (updateMode === 'regulatory') {
                    handleGenerate();
                  } else {
                    setStep(5);
                  }
                }}
                disabled={isProcessing}
                className="w-full bg-accent text-background py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                  <>Continue to Design Update <Palette className="w-4 h-4" /></>
                )}
              </button>
            </>

          ) : (
            // Error / retry state
            <>
              <h2 className="text-2xl font-bold text-center mb-2">Scan incomplete</h2>
              <p className="text-text-muted text-center mb-6">
                We couldn't complete the analysis. You can retry or skip ahead.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex-1 bg-surface text-text-primary py-4 rounded-xl font-bold hover:bg-surface transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={runFindingsScan}
                  className="flex-1 bg-accent text-background py-4 rounded-xl font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Retry Scan
                </button>
              </div>
              <button
                onClick={() => {
                  if (updateMode === 'regulatory') {
                    handleGenerate();
                  } else {
                    setStep(5);
                  }
                }}
                className="w-full mt-3 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Skip and generate directly
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- STEP 5: Style Selection (Full mode) or Design Questionnaire (Visual mode) ---
  if (step === 5) {
    // Visual/Full mode: AI-generated theme options + optional color & logo
    if (updateMode === 'visual' || updateMode === 'full') {
      const themes = aiThemeOptions || [];

      const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          setError('Logo must be under 5MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          setBrandLogo(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
      };

      const selectedTheme = selectedThemeIndex !== null ? themes[selectedThemeIndex] : null;

      // Layout shape varies by layoutStyle
      const renderLayoutAccent = (theme: ThemeOption) => {
        switch (theme.layoutStyle) {
          case 'organic':
            return <div className="absolute" style={{ bottom: '10%', right: '8%', width: '22%', height: '22%', borderRadius: '50%', background: theme.primaryColor, opacity: 0.25 }} />;
          case 'editorial':
            return <div className="absolute" style={{ top: 0, right: 0, width: '35%', height: '100%', background: `linear-gradient(135deg, transparent 50%, ${theme.primaryColor}22 50%)` }} />;
          case 'bold':
            return <div className="absolute" style={{ top: '12%', right: '6%', width: '28%', height: '55%', background: theme.primaryColor, opacity: 0.15, borderRadius: 4 }} />;
          case 'minimal':
            return <div className="absolute" style={{ bottom: '15%', left: '14%', right: '14%', height: 1, background: theme.primaryColor, opacity: 0.3 }} />;
          case 'structured':
            return <div className="absolute" style={{ top: 0, right: 0, width: '40%', height: '100%', borderLeft: `2px solid ${theme.primaryColor}33`, background: `${theme.primaryColor}08` }} />;
          default: // geometric
            return <div className="absolute" style={{ top: '15%', right: '8%', width: '18%', height: '18%', background: theme.primaryColor, opacity: 0.2, transform: 'rotate(45deg)' }} />;
        }
      };

      return (
        <div className="min-h-screen flex flex-col items-center bg-background p-6 py-12 overflow-y-auto">
          <div className="w-full max-w-2xl bg-card p-8 rounded-3xl shadow-xl border border-surface-border my-auto">
            {renderProgressBar()}
            <h2 className="text-2xl font-bold text-center mb-2">Pick a vibe</h2>
            <p className="text-text-muted text-center mb-8">
              {isLoadingThemeOptions
                ? 'Curating design themes for your course...'
                : 'Choose a direction, then customize with your brand color and logo.'}
            </p>

            <div className="space-y-6">
              {/* Loading shimmer state */}
              {isLoadingThemeOptions && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} className="rounded-xl border-2 border-surface-border overflow-hidden animate-pulse">
                      <div className="w-full bg-surface" style={{ aspectRatio: '16 / 9' }} />
                      <div className="p-3 space-y-2">
                        <div className="h-3 bg-surface rounded w-2/3" />
                        <div className="h-2 bg-surface rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Theme options grid — 2x3 with rich slide previews */}
              {!isLoadingThemeOptions && themes.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {themes.map((theme, idx) => {
                    const isSelected = selectedThemeIndex === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedThemeIndex(idx)}
                        className={`rounded-xl border-2 text-left transition-all overflow-hidden ${
                          isSelected
                            ? 'border-accent ring-2 ring-accent/30 scale-[1.02]'
                            : 'border-surface-border hover:border-accent/30 hover:scale-[1.01]'
                        }`}
                      >
                        {/* Rich slide thumbnail */}
                        <div
                          className="relative w-full overflow-hidden"
                          style={{
                            aspectRatio: '16 / 9',
                            background: theme.backgroundColor,
                          }}
                        >
                          {/* Accent sidebar */}
                          <div className="absolute left-0 top-0 bottom-0" style={{ width: '5%', background: theme.primaryColor }} />

                          {/* Heading text */}
                          <div className="absolute" style={{ top: '16%', left: '12%', right: '10%' }}>
                            <div style={{ width: '65%', height: 'clamp(5px, 1.4vw, 8px)', background: theme.textColor, borderRadius: 2, opacity: 0.9 }} />
                            {/* Accent underline */}
                            <div style={{ width: '35%', height: 'clamp(2px, 0.6vw, 3px)', background: theme.primaryColor, borderRadius: 2, marginTop: 'clamp(3px, 0.6vw, 5px)' }} />
                          </div>

                          {/* Bullet content lines */}
                          <div className="absolute" style={{ top: '48%', left: '12%', right: '10%' }}>
                            {[0.88, 0.72, 0.6].map((w, i) => (
                              <div key={i} className="flex items-center gap-1" style={{ marginBottom: 'clamp(3px, 0.6vw, 5px)' }}>
                                {/* Bullet dot */}
                                <div style={{ width: 'clamp(2px, 0.4vw, 3px)', height: 'clamp(2px, 0.4vw, 3px)', borderRadius: '50%', background: theme.primaryColor, flexShrink: 0 }} />
                                {/* Line */}
                                <div style={{
                                  width: `${w * 100}%`, height: 'clamp(2px, 0.5vw, 3px)',
                                  background: theme.mutedTextColor, borderRadius: 1, opacity: 0.4,
                                }} />
                              </div>
                            ))}
                          </div>

                          {/* Layout-specific geometric accent */}
                          {renderLayoutAccent(theme)}

                          {/* Selected check */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-sm">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        {/* Label */}
                        <div className="p-2.5">
                          <span className={`font-semibold text-sm block leading-tight ${
                            isSelected ? 'text-accent' : 'text-text-primary'
                          }`}>{theme.name}</span>
                          <p className="text-xs text-text-muted mt-0.5 leading-snug line-clamp-2">{theme.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Font picker — loads when a theme is selected */}
              {selectedThemeIndex !== null && (
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Heading font
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {/* Keep original option */}
                    <button
                      onClick={() => setSelectedFontIndex(null)}
                      className={`flex-1 min-w-[100px] py-3 px-3 rounded-xl border-2 text-center transition-all ${
                        selectedFontIndex === null
                          ? 'border-accent ring-2 ring-accent/30 bg-accent/5'
                          : 'border-surface-border hover:border-accent/30'
                      }`}
                    >
                      <span className="text-xs text-text-muted block mb-0.5">Keep original</span>
                      <span className="text-sm font-semibold text-text-primary" style={{ fontFamily: themes[selectedThemeIndex]?.fontSuggestion || 'system-ui' }}>
                        {themes[selectedThemeIndex]?.fontSuggestion || 'Default'}
                      </span>
                    </button>
                    {FONT_OPTIONS.map((font, idx) => (
                      <button
                        key={font.name}
                        onClick={() => setSelectedFontIndex(idx)}
                        className={`flex-1 min-w-[100px] py-3 px-3 rounded-xl border-2 text-center transition-all ${
                          selectedFontIndex === idx
                            ? 'border-accent ring-2 ring-accent/30 bg-accent/5'
                            : 'border-surface-border hover:border-accent/30'
                        }`}
                      >
                        <span className="text-xs text-text-muted block mb-0.5">{font.description}</span>
                        <span className="text-sm font-semibold text-text-primary" style={{ fontFamily: `${font.name}, system-ui, sans-serif` }}>
                          {font.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand color (optional) — only show after themes loaded */}
              {!isLoadingThemeOptions && themes.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Brand color <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={themeQuestionnaire.primaryColor || selectedTheme?.primaryColor || '#2563eb'}
                      onChange={(e) => setThemeQuestionnaire(q => ({ ...q, primaryColor: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-surface-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={themeQuestionnaire.primaryColor || ''}
                      onChange={(e) => setThemeQuestionnaire(q => ({ ...q, primaryColor: e.target.value }))}
                      placeholder={selectedTheme?.primaryColor || '#2563eb'}
                      className="flex-1 border border-surface-border rounded-xl px-4 py-2.5 bg-card text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-accent outline-none"
                    />
                    {themeQuestionnaire.primaryColor && (
                      <button
                        onClick={() => setThemeQuestionnaire(q => { const { primaryColor, ...rest } = q; return rest; })}
                        className="text-text-muted hover:text-text-primary transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Brand logo (optional) */}
              {!isLoadingThemeOptions && themes.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Logo <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  {brandLogo ? (
                    <div className="flex items-center gap-4 p-3 bg-surface rounded-xl border border-surface-border">
                      <img src={brandLogo} alt="Logo" className="w-12 h-12 object-contain rounded" />
                      <span className="text-sm text-text-primary flex-1">Logo uploaded</span>
                      <button
                        onClick={() => setBrandLogo(null)}
                        className="text-text-muted hover:text-warning transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-surface-border rounded-xl p-4 text-center hover:bg-surface transition-colors relative">
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleLogoUpload}
                        accept=".png,.jpg,.jpeg,.svg,.webp"
                      />
                      <div className="flex flex-col items-center text-text-muted">
                        <ImagePlus className="w-6 h-6 mb-1" />
                        <span className="text-sm">Drop logo or click to upload</span>
                        <span className="text-xs mt-0.5">PNG, JPG, SVG</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex-1 bg-surface text-text-primary py-4 rounded-xl font-bold hover:bg-surface transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={updateMode === 'full' ? handleFullGenerate : handleDesignGenerateWithAgents}
                  disabled={isGeneratingTheme || selectedThemeIndex === null || isLoadingThemeOptions}
                  className="flex-1 bg-accent text-white py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/30"
                >
                  {isGeneratingTheme ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      {updateMode === 'full' ? 'Full Refresh' : 'Redesign'} <Paintbrush className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Full mode: show original style selection
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
          {renderProgressBar()}
          <h2 className="text-2xl font-bold text-center mb-2">Choose a style</h2>
          <p className="text-text-muted text-center mb-8">
            Set the visual direction for your modernized slides.
          </p>

          <div className="grid grid-cols-1 gap-4 mb-8">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  style === s.id
                    ? 'border-accent bg-accent/10'
                    : 'border-surface-border hover:border-surface-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Palette className={`w-5 h-5 ${
                    style === s.id ? 'text-accent' : 'text-text-muted'
                  }`} />
                  <div>
                    <span className={`font-semibold ${
                      style === s.id ? 'text-accent' : 'text-text-muted'
                    }`}>
                      {s.label}
                    </span>
                    <p className="text-xs text-text-muted mt-0.5">{s.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={prevStep}
              className="flex-1 bg-surface text-text-primary py-4 rounded-xl font-bold hover:bg-surface transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={isProcessing}
              className="flex-1 bg-accent text-white py-4 rounded-xl font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/30"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  Generate Slides <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- STEP 6: Results - Cinematic Slide Presentation ---

  // Icon resolver for dynamic Lucide icons from slide data
  const iconMap: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
    'shield-check': (p) => <svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>,
    'book-open': (p) => <svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>,
    'trending-up': (p) => <svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
    'alert-triangle': (p) => <svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
    'clock': (p) => <svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    'zap': (p) => <svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>,
    'target': (p) => <svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    'award': (p) => <svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>,
    'star': (p) => <svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>,
  };
  const SlideIcon = ({ name, className, style: s }: { name?: string; className?: string; style?: React.CSSProperties }) => {
    const Ic = name && iconMap[name] ? iconMap[name] : iconMap['zap'];
    return <Ic className={className} style={s} />;
  };

  // Renders a bullet, highlighting inline citation markers like [1] in accent color
  const BulletText = ({ text, accentColor }: { text: string; accentColor: string }) => {
    const match = text.match(/^(.*?)\s*\[(\d+)\]\s*$/);
    if (!match) return <>{text}</>;
    return (
      <>
        <span>{match[1]}</span>
        <span
          className="inline-flex items-center justify-center ml-1 font-bold rounded"
          style={{
            background: `${accentColor}18`, color: accentColor,
            padding: '0px 4px', verticalAlign: 'middle',
            fontSize: '0.75em', lineHeight: '1.4',
          }}
        >
          {match[2]}
        </span>
      </>
    );
  };

  // --- 16:9 Presentation Slide Components ---

  // Sector-aware accent colors for the "Original" slide to mimic uploaded content
  const sectorAccentMap: Record<string, { accent: string; accentLight: string; bg: string }> = {
    'Cloud Computing':      { accent: '#f59e0b', accentLight: '#fbbf24', bg: '#ffffff' }, // AWS orange
    'Information Technology': { accent: '#2563eb', accentLight: '#60a5fa', bg: '#ffffff' }, // Tech blue
    'Cybersecurity':        { accent: '#059669', accentLight: '#34d399', bg: '#ffffff' }, // Security green
    'Healthcare':           { accent: '#0891b2', accentLight: '#22d3ee', bg: '#f8fafc' }, // Medical teal
    'Construction':         { accent: '#d97706', accentLight: '#fbbf24', bg: '#fffbeb' }, // Safety amber
    'Manufacturing':        { accent: '#dc2626', accentLight: '#f87171', bg: '#ffffff' }, // Industrial red
    'Finance & Banking':    { accent: '#1d4ed8', accentLight: '#3b82f6', bg: '#f8fafc' }, // Finance navy
    'Aviation':             { accent: '#1e40af', accentLight: '#3b82f6', bg: '#ffffff' }, // Aviation blue
    'Food Service':         { accent: '#16a34a', accentLight: '#4ade80', bg: '#ffffff' }, // Fresh green
    'Education & Training': { accent: '#7c3aed', accentLight: '#a78bfa', bg: '#faf5ff' }, // Edu purple
  };
  const defaultSectorAccent = { accent: '#2563eb', accentLight: '#60a5fa', bg: '#ffffff' };
  const originalAccent = sectorAccentMap[selectedSector] || defaultSectorAccent;

  // Helper: determine if a hex color is light (for contrast decisions)
  const isLightColor = (hex: string): boolean => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  };

  // Professional presentation palettes — designed to look like real Keynote/PowerPoint themes
  const stylePalettes: Record<string, {
    bg: string; bgGradient: string; title: string; accent: string;
    body: string; bodyMuted: string; bulletBg: string; feel: string;
  }> = {
    modern: {
      bg: '#ffffff', bgGradient: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
      title: '#0f172a', accent: '#2563eb', body: '#334155',
      bodyMuted: '#94a3b8', bulletBg: 'rgba(37,99,235,0.06)', feel: 'geometric',
    },
    playful: {
      bg: '#fffbeb', bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fff7ed 100%)',
      title: '#1c1917', accent: '#ea580c', body: '#44403c',
      bodyMuted: '#a8a29e', bulletBg: 'rgba(234,88,12,0.08)', feel: 'rounded',
    },
    minimal: {
      bg: '#fafafa', bgGradient: 'linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)',
      title: '#171717', accent: '#18181b', body: '#525252',
      bodyMuted: '#a3a3a3', bulletBg: 'rgba(24,24,27,0.04)', feel: 'precise',
    },
    academic: {
      bg: '#0f172a', bgGradient: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
      title: '#f8fafc', accent: '#d4a843', body: '#cbd5e1',
      bodyMuted: '#64748b', bulletBg: 'rgba(212,168,67,0.08)', feel: 'structured',
    },
  };

  // 16:9 slide frame wrapper
  const SlideFrame = ({ children, label, labelColor }: { children: React.ReactNode; label: string; labelColor?: string }) => (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2"
        style={{ color: labelColor || 'rgba(245,240,224,0.4)' }}>
        <span className="w-5 h-px inline-block" style={{ background: labelColor || 'rgba(245,240,224,0.2)' }} />
        {label}
      </p>
      <div
        className="relative overflow-hidden select-none"
        style={{
          aspectRatio: '16 / 9',
          borderRadius: 6,
          boxShadow: '0 8px 30px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {children}
      </div>
    </div>
  );

  // "Before" slide — shows the ACTUAL PDF page when available, falls back to text recreation
  const OriginalSlide = ({ slide, slideIndex }: { slide: typeof result.slides[0]; slideIndex: number }) => {
    // Try sourcePageNumber first, then fall back to spread heuristic
    let pageImage: string | null = null;
    if (pageImages.length > 0) {
      const pageNum = slide.before.sourcePageNumber;
      if (pageNum && pageNum > 0 && pageNum <= pageImages.length) {
        pageImage = pageImages[pageNum - 1];
      } else {
        // No sourcePageNumber — pick pages spread across the PDF
        // Skip first 2 pages (usually title/TOC), then spread evenly
        const startPage = Math.min(2, pageImages.length - 1);
        const usablePages = pageImages.length - startPage;
        const totalSlides = result.slides.length;
        const step = Math.max(1, Math.floor(usablePages / (totalSlides + 1)));
        const idx = startPage + step * (slideIndex + 1);
        pageImage = pageImages[Math.min(idx, pageImages.length - 1)] || null;
      }
    }

    if (pageImage) {
      return (
        <div className="absolute inset-0">
          <img
            src={pageImage}
            alt={`Original slide: ${slide.before.title}`}
            className="w-full h-full object-contain"
            style={{ background: '#f8f8f8' }}
          />
        </div>
      );
    }

    // Fallback: text-based recreation when no PDF pages extracted
    return (
      <div className="absolute inset-0 flex flex-col" style={{ background: originalAccent.bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ height: '2.5%', background: `linear-gradient(90deg, ${originalAccent.accent}, ${originalAccent.accentLight})` }} />
        <div style={{ padding: '5% 7% 0' }}>
          {slide.before.subtitle && slide.before.subtitle !== 'Original slide' && slide.before.subtitle !== 'Current version' && (
            <p style={{ fontSize: 'clamp(6px, 0.9vw, 9px)', color: '#999', marginBottom: '2%', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
              {slide.before.subtitle}
            </p>
          )}
          <h4 style={{ fontSize: 'clamp(12px, 2.4vw, 22px)', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.15 }}>
            {slide.before.title}
          </h4>
          <div style={{ width: '12%', height: 2, background: originalAccent.accent, marginTop: '3%', opacity: 0.5 }} />
        </div>
        <div style={{ padding: '4% 7% 5%', flex: 1, overflow: 'hidden' }}>
          <ul style={{ margin: 0, paddingLeft: 0, listStyleType: 'none' }}>
            {slide.before.bullets.map((b, i) => (
              <li key={i} style={{
                fontSize: 'clamp(7px, 1.2vw, 12px)', color: '#555', lineHeight: 1.55, marginBottom: '3%',
                display: 'flex', alignItems: 'flex-start', gap: '2.5%',
              }}>
                <span style={{
                  display: 'inline-block', width: 'clamp(4px, 0.5vw, 5px)', height: 'clamp(4px, 0.5vw, 5px)',
                  borderRadius: '50%', background: originalAccent.accent, flexShrink: 0, marginTop: 'clamp(4px, 0.55vw, 6px)', opacity: 0.7,
                }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{
          height: '5%', background: `linear-gradient(90deg, ${originalAccent.accent}10, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 7%',
          borderTop: `1px solid ${originalAccent.accent}15`,
        }}>
          <span style={{ fontSize: 'clamp(5px, 0.7vw, 7px)', color: '#bbb', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
            Current Version
          </span>
          <span style={{ fontSize: 'clamp(5px, 0.7vw, 7px)', color: '#ccc' }}>{selectedSector || ''}</span>
        </div>
      </div>
    );
  };

  // Modernized slide — clean presentation design inspired by professional keynote templates
  // Design principles: flat bg, typography hierarchy, thin 1px borders, metric-style grid cells, no decorative gradients
  const ModernizedSlide = ({ slide }: { slide: typeof result.slides[0] }) => {
    // Use generated theme colors when available (visual mode), otherwise use style palettes
    const useTheme = generatedTheme && updateMode === 'visual';
    const p = useTheme
      ? {
          bg: generatedTheme!.backgroundColor,
          bgGradient: `linear-gradient(180deg, ${generatedTheme!.backgroundColor} 0%, ${generatedTheme!.backgroundColor}ee 100%)`,
          title: generatedTheme!.textColor,
          accent: generatedTheme!.primaryColor,
          body: generatedTheme!.textColor,
          bodyMuted: generatedTheme!.mutedTextColor,
          bulletBg: `${generatedTheme!.primaryColor}08`,
          feel: generatedTheme!.layoutStyle || 'geometric',
        }
      : stylePalettes[style] || stylePalettes.modern;
    const c = useTheme ? generatedTheme!.primaryColor : (slide.visualStyle.accentColor || p.accent);
    const layout = slide.visualStyle.layout || 'hero';
    const isLight = useTheme
      ? isLightColor(generatedTheme!.backgroundColor)
      : (style === 'modern' || style === 'playful' || style === 'minimal');
    const headingFont = useTheme && generatedTheme!.fontSuggestion
      ? `${generatedTheme!.fontSuggestion}, Poppins, system-ui, sans-serif`
      : 'Poppins, system-ui, sans-serif';

    // Shared: eyebrow label — displayed as a small category badge
    const Eyebrow = ({ text }: { text: string }) => (
      <span style={{
        display: 'inline-block',
        fontSize: 'clamp(5px, 0.6vw, 7px)', fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase' as const, color: isLight ? c : `${c}dd`,
        background: isLight ? `${c}0a` : `${c}15`,
        padding: 'clamp(2px, 0.3vw, 4px) clamp(4px, 0.6vw, 8px)',
        borderRadius: 3,
      }}>
        {text}
      </span>
    );

    // Shared: the keyFact display — the visual anchor of every slide
    const KeyFactDisplay = ({ text, size = 'large' }: { text: string; size?: 'large' | 'medium' }) => (
      <p style={{
        fontSize: size === 'large' ? 'clamp(14px, 1.8vw, 20px)' : 'clamp(12px, 1.5vw, 17px)',
        fontWeight: 800, color: c,
        lineHeight: 1.1, fontFamily: headingFont,
        letterSpacing: '-0.02em',
      }}>
        {text}
      </p>
    );

    // Shared: simple bullet list
    const BulletList = ({ items }: { items: string[] }) => (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 'clamp(5px, 0.7vw, 8px)' }}>
        {items.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(5px, 0.6vw, 7px)' }}>
            <span style={{
              fontSize: 'clamp(6px, 0.55vw, 7px)', color: c, fontWeight: 700, flexShrink: 0,
              marginTop: 'clamp(1px, 0.15vw, 2px)', opacity: 0.7,
            }}>
              {'//'}
            </span>
            <span style={{ fontSize: 'clamp(7px, 0.95vw, 11px)', color: p.body, lineHeight: 1.5 }}>
              <BulletText text={b} accentColor={c} />
            </span>
          </div>
        ))}
      </div>
    );

    // Shared: thin horizontal rule
    const Rule = () => (
      <div style={{ height: 1, background: isLight ? `${c}15` : `${c}20`, margin: '3% 0' }} />
    );

    // Hero layout: accent sidebar + keyFact dominant + image placeholder
    const renderHero = () => (
      <div className="absolute inset-0 flex" style={{ background: p.bg }}>
        {/* Bold accent sidebar */}
        <div style={{
          width: '5%', minWidth: 12,
          background: `linear-gradient(180deg, ${c}, ${c}aa)`,
        }} />
        {/* Decorative dot grid pattern */}
        <div className="absolute pointer-events-none" style={{
          top: '10%', left: '8%', width: '35%', height: '35%', opacity: 0.04,
          backgroundImage: `radial-gradient(${c} 1px, transparent 1px)`,
          backgroundSize: 'clamp(6px, 1vw, 10px) clamp(6px, 1vw, 10px)',
        }} />
        {/* Ambient glow */}
        <div className="absolute pointer-events-none" style={{
          top: '-30%', right: '-5%', width: '60%', height: '60%',
          background: `radial-gradient(circle, ${c}12, transparent 65%)`,
        }} />
        <div className="relative flex flex-col h-full flex-1" style={{ padding: '5% 6% 5% 5%' }}>
          {updateMode !== 'visual' && <Eyebrow text={slide.changesSummary} />}
          {updateMode === 'visual' ? (
            <>
              {/* Visual mode: title is dominant, keyFact is secondary accent */}
              <h3 style={{
                fontSize: 'clamp(12px, 1.8vw, 20px)', fontWeight: 800, color: p.title,
                lineHeight: 1.15, marginTop: '1%', fontFamily: headingFont,
                letterSpacing: '-0.02em',
              }}>
                {slide.after.title}
              </h3>
              {slide.after.subtitle && (
                <p style={{ fontSize: 'clamp(6px, 0.75vw, 9px)', color: p.bodyMuted, marginTop: '1.5%' }}>
                  {slide.after.subtitle}
                </p>
              )}
              {slide.after.keyFact && (
                <p style={{
                  fontSize: 'clamp(10px, 1.3vw, 15px)', fontWeight: 800, color: c,
                  lineHeight: 1.1, marginTop: '2%', fontFamily: headingFont,
                }}>
                  {slide.after.keyFact}
                </p>
              )}
            </>
          ) : (
            <>
              {/* Content mode: keyFact is dominant hero stat, title below */}
              {slide.after.keyFact && (
                <div style={{ marginTop: '2%' }}>
                  <p style={{
                    fontSize: 'clamp(16px, 2.2vw, 26px)', fontWeight: 900, color: c,
                    lineHeight: 1.05, fontFamily: headingFont,
                    letterSpacing: '-0.03em',
                  }}>
                    {slide.after.keyFact}
                  </p>
                </div>
              )}
              <h3 style={{
                fontSize: 'clamp(9px, 1.2vw, 14px)', fontWeight: 700, color: p.title,
                lineHeight: 1.2, marginTop: '2.5%', fontFamily: headingFont,
                letterSpacing: '-0.01em',
              }}>
                {slide.after.title}
              </h3>
              {slide.after.subtitle && (
                <p style={{ fontSize: 'clamp(6px, 0.75vw, 9px)', color: p.bodyMuted, marginTop: '1%' }}>
                  {slide.after.subtitle}
                </p>
              )}
            </>
          )}
          <Rule />
          {/* Bullets */}
          <div style={{ flex: 1 }}>
            <BulletList items={slide.after.bullets} />
          </div>
        </div>
        {/* Image placeholder — only show when actual image exists */}
        {slide.imageUrl && (
          <div className="absolute overflow-hidden" style={{
            bottom: 0, right: 0, width: '32%', height: '50%', borderTopLeftRadius: 12,
          }}>
            <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${p.bg} 0%, transparent 50%)` }} />
          </div>
        )}
      </div>
    );

    // Two-column: content left, accent sidebar right
    const renderTwoColumn = () => (
      <div className="absolute inset-0 flex" style={{ background: p.bg }}>
        {/* Main content area */}
        <div style={{ flex: 1, padding: '5.5% 5% 5.5% 7%', display: 'flex', flexDirection: 'column' as const }}>
          {updateMode !== 'visual' && <Eyebrow text={slide.changesSummary} />}
          <h3 style={{
            fontSize: 'clamp(10px, 1.4vw, 16px)', fontWeight: 700, color: p.title,
            lineHeight: 1.2, marginTop: '3%', fontFamily: headingFont,
            letterSpacing: '-0.01em',
          }}>
            {slide.after.title}
          </h3>
          {slide.after.subtitle && (
            <p style={{ fontSize: 'clamp(7px, 0.85vw, 10px)', color: p.bodyMuted, marginTop: '1.5%' }}>
              {slide.after.subtitle}
            </p>
          )}
          {slide.after.keyFact && (
            <p style={{
              fontSize: 'clamp(10px, 1.3vw, 15px)', fontWeight: 800, color: c,
              lineHeight: 1.1, marginTop: '2%', fontFamily: headingFont,
            }}>
              {slide.after.keyFact}
            </p>
          )}
          <Rule />
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <BulletList items={slide.after.bullets} />
          </div>
        </div>
        {/* Accent sidebar — narrow decorative bar */}
        <div className="relative overflow-hidden" style={{
          width: '5%', minWidth: 12,
          background: `linear-gradient(180deg, ${c}, ${c}88)`,
        }}>
          {/* Diagonal decorative stripe */}
          <div className="absolute pointer-events-none" style={{
            top: '-20%', right: '-40%', width: '200%', height: '140%',
            background: 'rgba(255,255,255,0.06)', transform: 'rotate(-12deg)',
          }} />
        </div>
      </div>
    );

    // Stats highlight: MASSIVE keyFact centered + compact metric cards
    const renderStats = () => (
      <div className="absolute inset-0 flex flex-col" style={{ background: p.bg }}>
        {/* Accent band behind keyFact */}
        <div className="absolute pointer-events-none" style={{
          top: '15%', left: 0, right: 0, height: '35%',
          background: `linear-gradient(180deg, ${c}08, ${c}12, ${c}08)`,
        }} />
        <div className="relative flex flex-col h-full" style={{ padding: '5% 7%' }}>
          {updateMode !== 'visual' && <Eyebrow text={slide.changesSummary} />}
          {updateMode === 'visual' ? (
            <>
              {/* Visual mode: title dominant, keyFact as accent */}
              <h3 style={{
                fontSize: 'clamp(11px, 1.6vw, 18px)', fontWeight: 800, color: p.title,
                lineHeight: 1.15, marginTop: '2%', textAlign: 'center' as const,
                fontFamily: headingFont, letterSpacing: '-0.02em',
              }}>
                {slide.after.title}
              </h3>
              {slide.after.keyFact && (
                <p style={{
                  fontSize: 'clamp(10px, 1.4vw, 16px)', fontWeight: 800, color: c,
                  lineHeight: 1.0, marginTop: '2%', textAlign: 'center' as const,
                  fontFamily: headingFont,
                }}>
                  {slide.after.keyFact}
                </p>
              )}
              {slide.after.subtitle && (
                <p style={{ fontSize: 'clamp(6px, 0.75vw, 9px)', color: p.bodyMuted, marginTop: '0.5%', textAlign: 'center' as const }}>
                  {slide.after.subtitle}
                </p>
              )}
            </>
          ) : (
            <>
              {/* Content mode: keyFact MASSIVE, title smaller */}
              {slide.after.keyFact && (
                <div style={{ textAlign: 'center' as const, marginTop: '3%', padding: '0 5%' }}>
                  <p style={{
                    fontSize: 'clamp(20px, 3vw, 36px)', fontWeight: 900, color: c,
                    lineHeight: 1.0, fontFamily: headingFont,
                    letterSpacing: '-0.04em',
                  }}>
                    {slide.after.keyFact}
                  </p>
                </div>
              )}
              <h3 style={{
                fontSize: 'clamp(8px, 1.1vw, 13px)', fontWeight: 700, color: p.title,
                lineHeight: 1.2, marginTop: '2%', textAlign: 'center' as const,
                fontFamily: headingFont,
              }}>
                {slide.after.title}
              </h3>
              {slide.after.subtitle && (
                <p style={{ fontSize: 'clamp(6px, 0.75vw, 9px)', color: p.bodyMuted, marginTop: '0.5%', textAlign: 'center' as const }}>
                  {slide.after.subtitle}
                </p>
              )}
            </>
          )}
          {/* Metric cards — individual cards with accent left border */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(slide.after.bullets.length, 4)}, 1fr)`,
            gap: 'clamp(4px, 0.6vw, 8px)',
            marginTop: 'auto', paddingTop: '3%',
          }}>
            {slide.after.bullets.map((b, i) => (
              <div key={i} style={{
                padding: 'clamp(6px, 1vw, 12px) clamp(5px, 0.8vw, 10px)',
                background: isLight ? `${c}06` : `${c}10`,
                borderRadius: 4,
                borderLeft: `3px solid ${c}`,
                display: 'flex', alignItems: 'center',
              }}>
                <span style={{ fontSize: 'clamp(6px, 0.8vw, 9px)', color: p.body, lineHeight: 1.4, fontWeight: 500 }}>
                  <BulletText text={b} accentColor={c} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    // Comparison: two equal columns with all bullets distributed evenly
    const renderComparison = () => {
      const half = Math.ceil(slide.after.bullets.length / 2);
      const col1 = slide.after.bullets.slice(0, half);
      const col2 = slide.after.bullets.slice(half);
      return (
        <div className="absolute inset-0 flex flex-col" style={{ background: p.bg, overflow: 'hidden' }}>
          <div className="flex flex-col" style={{ padding: '4% 5%', height: '100%', minHeight: 0 }}>
            {updateMode !== 'visual' && <Eyebrow text={slide.changesSummary} />}
            <h3 style={{
              fontSize: 'clamp(10px, 1.4vw, 16px)', fontWeight: 700, color: p.title,
              lineHeight: 1.2, marginTop: '1%', fontFamily: headingFont,
              flexShrink: 0,
            }}>
              {slide.after.title}
            </h3>
            {slide.after.keyFact && (
              <p style={{
                fontSize: 'clamp(9px, 1.1vw, 13px)', fontWeight: 800, color: c,
                marginTop: '1.5%', fontFamily: headingFont, flexShrink: 0,
              }}>
                {slide.after.keyFact}
              </p>
            )}
            <Rule />
            <div style={{
              flex: 1, minHeight: 0, overflow: 'hidden',
              display: 'grid', gridTemplateColumns: '1fr clamp(2px, 0.3vw, 4px) 1fr', gap: 0,
              alignContent: 'start',
            }}>
              {/* Column 1 */}
              <div style={{ paddingRight: 'clamp(4px, 0.8vw, 10px)', overflow: 'hidden' }}>
                <BulletList items={col1} />
              </div>
              {/* Accent divider */}
              <div style={{
                borderRadius: 2,
                background: `linear-gradient(180deg, ${c}50, ${c}15)`,
              }} />
              {/* Column 2 */}
              <div style={{
                paddingLeft: 'clamp(4px, 0.8vw, 10px)', overflow: 'hidden',
              }}>
                <BulletList items={col2} />
              </div>
            </div>
          </div>
        </div>
      );
    };

    // Timeline: thick accent line with numbered step badges and cards
    const renderTimeline = () => (
      <div className="absolute inset-0 flex flex-col" style={{ background: p.bg }}>
        <div className="flex flex-col h-full" style={{ padding: '5% 7%' }}>
          {updateMode !== 'visual' && <Eyebrow text={slide.changesSummary} />}
          <h3 style={{
            fontSize: 'clamp(10px, 1.5vw, 16px)', fontWeight: 700, color: p.title,
            lineHeight: 1.2, marginTop: '2%', fontFamily: headingFont,
          }}>
            {slide.after.title}
          </h3>
          {slide.after.keyFact && (
            <div style={{ marginTop: '1.5%' }}>
              <KeyFactDisplay text={slide.after.keyFact} size="medium" />
            </div>
          )}
          <Rule />
          {/* Timeline with thick line and numbered badges */}
          <div style={{ flex: 1, position: 'relative' as const, marginLeft: 'clamp(8px, 1.2vw, 14px)' }}>
            {/* Thick vertical line */}
            <div style={{
              position: 'absolute' as const, left: 'clamp(6px, 0.8vw, 9px)', top: 0, bottom: 0,
              width: 'clamp(3px, 0.35vw, 4px)', background: `linear-gradient(180deg, ${c}40, ${c}12)`,
              borderRadius: 2,
            }} />
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 'clamp(5px, 0.8vw, 10px)' }}>
              {slide.after.bullets.map((b, i) => (
                <div key={i} style={{
                  position: 'relative' as const,
                  paddingLeft: 'clamp(22px, 3vw, 32px)',
                }}>
                  {/* Numbered step badge */}
                  <div style={{
                    position: 'absolute' as const, left: 0, top: 'clamp(1px, 0.2vw, 3px)',
                    width: 'clamp(14px, 1.8vw, 20px)', height: 'clamp(14px, 1.8vw, 20px)',
                    borderRadius: '50%',
                    background: c, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'clamp(5px, 0.55vw, 7px)', fontWeight: 800,
                    boxShadow: `0 2px 6px ${c}40`,
                  }}>
                    {i + 1}
                  </div>
                  {/* Step card */}
                  <div style={{
                    background: isLight ? `${c}05` : `${c}08`,
                    borderRadius: 4,
                    padding: 'clamp(4px, 0.6vw, 8px) clamp(6px, 0.8vw, 10px)',
                    border: `1px solid ${isLight ? c + '10' : c + '12'}`,
                  }}>
                    <span style={{ fontSize: 'clamp(7px, 0.85vw, 10px)', color: p.body, lineHeight: 1.4 }}>
                      <BulletText text={b} accentColor={c} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    // Render the layout and overlay the brand logo if present
    const layoutRenderers: Record<string, () => React.ReactElement> = {
      'two-column': renderTwoColumn,
      'stats-highlight': renderStats,
      'comparison': renderComparison,
      'timeline': renderTimeline,
      'hero': renderHero,
    };
    const renderLayout = layoutRenderers[layout] || renderHero;

    return (
      <>
        {renderLayout()}
        {/* Brand logo overlay — consistent position on every modernized slide */}
        {brandLogo && (
          <img
            src={brandLogo}
            alt="Brand logo"
            className="absolute pointer-events-none"
            style={{
              bottom: '4%', right: '3%',
              width: '8%', height: 'auto',
              objectFit: 'contain', opacity: 0.85,
              zIndex: 10,
            }}
          />
        )}
      </>
    );
  };

  if (step === 6) {
    const resetAll = () => {
      setResult(null);
      setStep(1);
      setUpdateMode(null);
      setFiles([]);
      setTopic('');
      setInferredSector(null);
      setSelectedSector('');
      setLocation('');
      setAnalysisPhase(0);
      setUploadProgress([]);
      setPageImages([]);
      setDeselectedTopics(new Set());
      setFindings([]);
      setFindingsScanResult(null);
      setFindingsPhase(0);
      setApprovedFindingIds(new Set());
      setUserContext('');
      setDesignQuestions({});
      setCurrentFindingIndex(0);
      setFindingsReviewComplete(false);
      setExtractedPages([]);
      setGeneratedTheme(null);
      setBrandLogo(null);
      setThemeQuestionnaire({});
      setIsGeneratingTheme(false);
      setSelectedFontIndex(null);
      // Agent orchestration cleanup
      setAgentPhase('idle');
      setAgents([]);
      setVerificationResults([]);
      setQuizResults([]);
      setCourseSummaryResult(null);
      setShowResults(false);
      setPreGeneratedStudyGuide([]);
      setPreGeneratedQuiz([]);
      setPreGeneratedSlides([]);
      setSlideVerification(null);
      setSlideDisclaimer(undefined);
      Object.values(agentProgressIntervals.current).forEach(clearInterval);
      agentProgressIntervals.current = {};
    };

    // Phase 1: Agent Orchestration Panel (show while agents are working or just completed)
    if (!showResults && agentPhase !== 'idle') {
      const allDone = agents.length > 0 && agents.every(a => a.status === 'complete' || a.status === 'error');
      const completedCount = agents.filter(a => a.status === 'complete').length;
      const hasEnoughResults = result !== null || completedCount >= 2;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
          <div className="w-full max-w-2xl bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                {allDone ? 'Analysis Complete' : 'AI Agents at Work'}
              </h2>
              <p className="text-text-muted text-sm">
                {allDone
                  ? `${completedCount} of ${agents.length} agents finished successfully`
                  : `${agents.length} specialized agents are ${updateMode === 'visual' ? 'building your course materials' : 'analyzing your course'} in parallel`}
              </p>
            </div>

            {/* Agent Grid — 2x2 for 4 agents, last spans 2 cols for 3 agents */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {agents.map((agent, agentIdx) => {
                const isWorking = agent.status === 'working';
                const isComplete = agent.status === 'complete';
                const isError = agent.status === 'error';
                const isIdle = agent.status === 'idle';

                const isLastOdd = agents.length % 2 === 1 && agentIdx === agents.length - 1;

                return (
                  <div
                    key={agent.id}
                    className={`relative rounded-2xl border-2 p-5 transition-all duration-500${isLastOdd ? ' col-span-2' : ''}`}
                    style={{
                      borderColor: isWorking
                        ? agent.color
                        : isComplete
                          ? `${agent.color}80`
                          : isError
                            ? '#c27056'
                            : 'rgba(255,248,230,0.08)',
                      backgroundColor: isWorking
                        ? `${agent.color}08`
                        : isComplete
                          ? `${agent.color}05`
                          : 'rgba(26,25,20,0.8)',
                      backdropFilter: 'blur(8px)',
                      boxShadow: isWorking
                        ? `0 0 20px ${agent.color}15, 0 0 40px ${agent.color}08`
                        : 'none',
                      animation: isWorking ? 'pulse 2s ease-in-out infinite' : 'none',
                    }}
                  >
                    {/* Agent Icon + Name */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
                        style={{
                          backgroundColor: isComplete || isWorking
                            ? `${agent.color}20`
                            : 'rgba(255,248,230,0.04)',
                          color: isComplete || isWorking
                            ? agent.color
                            : 'rgba(245,240,224,0.3)',
                        }}
                      >
                        {agentIconMap[agent.icon] || <FileText className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{agent.name}</p>
                        {/* Status badge */}
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            color: isComplete
                              ? '#6abf8a'
                              : isWorking
                                ? agent.color
                                : isError
                                  ? '#c27056'
                                  : 'rgba(245,240,224,0.3)',
                          }}
                        >
                          {isComplete ? 'Done' : isWorking ? 'Working' : isError ? 'Error' : 'Queued'}
                        </span>
                      </div>
                      {/* Status icon */}
                      {isComplete && (
                        <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: '#6abf8a' }} />
                      )}
                      {isWorking && (
                        <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: agent.color }} />
                      )}
                      {isError && (
                        <AlertOctagon className="w-5 h-5 shrink-0" style={{ color: '#c27056' }} />
                      )}
                    </div>

                    {/* Progress text / result preview */}
                    <div className="min-h-[24px]">
                      {isWorking && (
                        <p
                          className="text-xs text-text-muted transition-opacity duration-500"
                          style={{ opacity: 0.8 }}
                        >
                          {agent.progress}
                        </p>
                      )}
                      {isComplete && agent.result && (
                        <p className="text-xs font-medium" style={{ color: agent.color }}>
                          {agent.result}
                        </p>
                      )}
                      {isError && (
                        <p className="text-xs text-warning truncate">{agent.error || 'An error occurred'}</p>
                      )}
                      {isIdle && (
                        <p className="text-xs text-text-muted" style={{ opacity: 0.4 }}>
                          Waiting to start...
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* View Results button — appears when agents are done */}
            {(allDone || (agentPhase === 'complete')) && (
              <button
                onClick={() => setShowResults(true)}
                disabled={!hasEnoughResults}
                className="w-full bg-accent text-background py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
              >
                View Results <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Start Over link */}
            {allDone && (
              <button
                onClick={resetAll}
                className="w-full mt-3 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Start over
              </button>
            )}
          </div>
        </div>
      );
    }

    // Phase 2: Show results (existing logic, enhanced with new data)
    if (result) {
      // Full mode → tabbed view with both regulatory and design outputs
      if (updateMode === 'full') {
        return (
          <div className="min-h-screen bg-background">
            {/* Tab switcher */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-surface-border">
              <div className="max-w-5xl mx-auto px-6 flex gap-1 pt-3 pb-0">
                {([
                  { id: 'regulatory' as const, label: 'Regulatory Updates', icon: <ShieldCheck className="w-4 h-4" /> },
                  { id: 'design' as const, label: 'Design Materials', icon: <Palette className="w-4 h-4" /> },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setFullModeTab(tab.id)}
                    className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all rounded-t-lg"
                    style={{
                      color: fullModeTab === tab.id ? '#c8956c' : 'rgba(245,240,224,0.5)',
                      borderBottom: fullModeTab === tab.id ? '2px solid #c8956c' : '2px solid transparent',
                      background: fullModeTab === tab.id ? 'rgba(200,149,108,0.05)' : 'transparent',
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {fullModeTab === 'regulatory' ? (
              <RegulatoryOutput
                result={result}
                findings={findings}
                approvedFindingIds={approvedFindingIds}
                pageImages={pageImages}
                extractedPages={extractedPages}
                selectedSector={selectedSector}
                location={location}
                topic={topic}
                presentationTitle={courseSummaryResult?.courseTitle || topic}
                updateMode={updateMode}
                onReset={resetAll}
                verificationResults={verificationResults}
              />
            ) : (
              <VisualOutput
                result={result}
                pageImages={pageImages}
                extractedPages={extractedPages}
                generatedTheme={generatedTheme}
                selectedSector={selectedSector}
                location={location}
                topic={topic}
                presentationTitle={courseSummaryResult?.courseTitle || topic}
                files={files}
                onReset={resetAll}
                preGeneratedStudyGuide={preGeneratedStudyGuide.length > 0 ? preGeneratedStudyGuide : undefined}
                preGeneratedQuiz={preGeneratedQuiz.length > 0 ? preGeneratedQuiz : undefined}
                preGeneratedSlides={preGeneratedSlides.length > 0 ? preGeneratedSlides : undefined}
                slideVerification={slideVerification}
                disclaimer={slideDisclaimer}
              />
            )}
          </div>
        );
      }

      // Regulatory mode → redline view with deliverable previews
      if (updateMode === 'regulatory') {
        return (
          <RegulatoryOutput
            result={result}
            findings={findings}
            approvedFindingIds={approvedFindingIds}
            pageImages={pageImages}
            extractedPages={extractedPages}
            selectedSector={selectedSector}
            location={location}
            topic={topic}
            presentationTitle={courseSummaryResult?.courseTitle || topic}
            updateMode={updateMode}
            onReset={resetAll}
            verificationResults={verificationResults}
          />
        );
      }

      // Visual mode → new materials output (document, study guide, slides, quiz)
      return (
        <VisualOutput
          result={result}
          pageImages={pageImages}
          extractedPages={extractedPages}
          generatedTheme={generatedTheme}
          selectedSector={selectedSector}
          location={location}
          topic={topic}
          presentationTitle={courseSummaryResult?.courseTitle || topic}
          files={files}
          onReset={resetAll}
          preGeneratedStudyGuide={preGeneratedStudyGuide.length > 0 ? preGeneratedStudyGuide : undefined}
          preGeneratedQuiz={preGeneratedQuiz.length > 0 ? preGeneratedQuiz : undefined}
          preGeneratedSlides={preGeneratedSlides.length > 0 ? preGeneratedSlides : undefined}
          slideVerification={slideVerification}
          disclaimer={slideDisclaimer}
        />
      );
    }
  }

  // Fallback / Loading
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );
};

export default DemoFlow;
