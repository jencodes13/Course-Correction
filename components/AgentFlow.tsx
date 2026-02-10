import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
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
  ChevronDown,
  X,
  FileType,
  Brain,
  Tag,
  Check,
  ImagePlus,
  ShieldCheck,
  HelpCircle,
  AlertOctagon,
} from 'lucide-react';
import {
  inferSectorFromContent,
  generateDemoSlidesEnhanced,
  scanCourseFindings,
  generateAsset,
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
import { extractPdfPageImages } from '../utils/pdfPageRenderer';
import { extractPdfPageText } from '../utils/pdfTextExtractor';
import RegulatoryOutput from './RegulatoryOutput';
import VisualOutput from './VisualOutput';
import LocationInput from './LocationInput';
import { useWorkflow } from '../contexts/WorkflowContext';
import {
  UpdateMode,
  InferredSector,
  DemoResult,
  DemoSlideEnhanced,
  IngestedFile,
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

interface AgentFlowProps {
  files: IngestedFile[];
  topic: string;
  updateMode: UpdateMode;
  location: string;
  onBack: () => void;
  onComplete: () => void;
}

// Predefined sectors for the dropdown
const SECTORS = [
  'Healthcare', 'Construction', 'Manufacturing', 'Food Service',
  'Transportation & Logistics', 'Aviation', 'Finance & Banking',
  'Energy & Utilities', 'Legal & Compliance', 'Pharmaceuticals',
  'Information Technology', 'Cloud Computing', 'Cybersecurity',
  'Software Engineering', 'Data Science & AI', 'Telecommunications',
  'Education & Training', 'Human Resources', 'Project Management',
  'Real Estate', 'Insurance', 'Accounting & Audit',
  'Hospitality & Tourism', 'Retail & E-Commerce',
  'Government & Public Sector', 'Nonprofit & NGO', 'Agriculture',
  'Mining & Resources', 'Environmental & Sustainability',
  'Media & Communications', 'Other'
];

// Static theme options
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

const FONT_OPTIONS = [
  { name: 'Inter', description: 'Clean & modern' },
  { name: 'Poppins', description: 'Friendly & geometric' },
  { name: 'Playfair Display', description: 'Elegant & editorial' },
  { name: 'Source Sans Pro', description: 'Professional & neutral' },
  { name: 'Raleway', description: 'Light & contemporary' },
  { name: 'Merriweather', description: 'Warm & readable' },
];

const STYLES = [
  { id: 'modern', label: 'Modern Professional', description: 'White background, blue accent, clean corporate feel' },
  { id: 'playful', label: 'Warm & Engaging', description: 'Light warm tones, orange accent, friendly and approachable' },
  { id: 'minimal', label: 'Minimalist', description: 'Near-white, monochrome, maximum whitespace' },
  { id: 'academic', label: 'Academic & Formal', description: 'Dark navy, gold accents, scholarly authority' }
];

// Agent definitions
const REGULATORY_AGENTS: Omit<AgentState, 'status' | 'progress'>[] = [
  { id: 'fact-checker', name: 'Fact Checker', color: '#3b82f6', icon: 'shield-check' },
  { id: 'slide-designer', name: 'Slide Designer', color: '#c8956c', icon: 'palette' },
  { id: 'quiz-builder', name: 'Quiz Builder', color: '#8b5cf6', icon: 'help-circle' },
  { id: 'course-summary', name: 'Course Summary', color: '#10b981', icon: 'file-text' },
];

const VISUAL_AGENTS: Omit<AgentState, 'status' | 'progress'>[] = [
  { id: 'study-guide-agent', name: 'Study Guide Agent', color: '#10b981', icon: 'file-text' },
  { id: 'slide-deck-agent', name: 'Slide Deck Agent', color: '#c8956c', icon: 'palette' },
  { id: 'quiz-agent', name: 'Quiz Agent', color: '#8b5cf6', icon: 'help-circle' },
];

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

const AgentFlow: React.FC<AgentFlowProps> = ({
  files,
  topic,
  updateMode,
  location: initialLocation,
  onBack,
  onComplete,
}) => {
  const { setAgentResultsReady, activeResultTab, setActiveResultTab } = useWorkflow();

  // Internal step: 1=sector, 2=findings, 3=style, 4=agents/results
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Sector & Location
  const [inferredSector, setInferredSector] = useState<InferredSector | null>(null);
  const [selectedSector, setSelectedSector] = useState('');
  const [location, setLocation] = useState(initialLocation);
  const [isInferring, setIsInferring] = useState(false);
  const [deselectedTopics, setDeselectedTopics] = useState<Set<string>>(new Set());
  const [analysisPhase, setAnalysisPhase] = useState(0);

  // Step 2: Findings Review
  const [findings, setFindings] = useState<CourseFinding[]>([]);
  const [findingsScanResult, setFindingsScanResult] = useState<FindingsScanResult | null>(null);
  const [isScanningFindings, setIsScanningFindings] = useState(false);
  const [findingsPhase, setFindingsPhase] = useState(0);
  const [approvedFindingIds, setApprovedFindingIds] = useState<Set<string>>(new Set());
  const [userContext, setUserContext] = useState('');
  const [designQuestions, setDesignQuestions] = useState<{
    audience?: string;
    feeling?: string;
    emphasis?: string;
  }>({});
  const [currentFindingIndex, setCurrentFindingIndex] = useState(0);
  const [findingsReviewComplete, setFindingsReviewComplete] = useState(false);

  // Step 3: Style / Theme
  const [style, setStyle] = useState('modern');
  const [aiThemeOptions] = useState<ThemeOption[]>(STATIC_THEME_OPTIONS);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState<number | null>(null);
  const [selectedFontIndex, setSelectedFontIndex] = useState<number | null>(null);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [themeQuestionnaire, setThemeQuestionnaire] = useState<{
    brandPersonality?: string;
    audience?: string;
    desiredFeeling?: string;
    primaryColor?: string;
  }>({});
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

  // Step 4: Results
  const [result, setResult] = useState<DemoResult | null>(null);
  const [generatedTheme, setGeneratedTheme] = useState<GeneratedTheme | null>(null);

  // Agent orchestration state
  const [agentPhase, setAgentPhase] = useState<'idle' | 'running' | 'complete'>('idle');
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [verificationResults, setVerificationResults] = useState<VerifiedFinding[]>([]);
  const [quizResults, setQuizResults] = useState<QuizQuestion[]>([]);
  const [courseSummaryResult, setCourseSummaryResult] = useState<CourseSummaryResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const agentProgressIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Full mode tab - derived from context's activeResultTab
  const REGULATORY_TAB_IDS = ['redline', 'report', 'fact-check'];
  const VISUAL_TAB_IDS = ['document', 'study-guide', 'slides', 'quiz'];
  const fullModeTab: 'regulatory' | 'design' = VISUAL_TAB_IDS.includes(activeResultTab) ? 'design' : 'regulatory';

  // Pre-generated content from visual mode agent orchestration
  const [preGeneratedStudyGuide, setPreGeneratedStudyGuide] = useState<StudyGuideSection[]>([]);
  const [preGeneratedQuiz, setPreGeneratedQuiz] = useState<QuizQuestion[]>([]);
  const [preGeneratedSlides, setPreGeneratedSlides] = useState<GeneratedSlide[]>([]);
  const [slideVerification, setSlideVerification] = useState<SlideContentResult['dataVerification'] | null>(null);
  const [slideDisclaimer, setSlideDisclaimer] = useState<string | undefined>();

  // PDF page images
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [extractedPages, setExtractedPages] = useState<ExtractedPageData[]>([]);

  // Signal results ready to context (so sidebar shows deliverable tabs)
  useEffect(() => {
    if (showResults && result) {
      setAgentResultsReady(true, updateMode);
    }
  }, [showResults, result, updateMode, setAgentResultsReady]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      setAgentResultsReady(false);
    };
  }, [setAgentResultsReady]);

  // Extract PDF pages on mount
  useEffect(() => {
    const pdfFile = files.find(f =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFile?.data) {
      extractPdfPageImages(pdfFile.data, { scale: 1.5, quality: 0.85 })
        .then(images => setPageImages(images))
        .catch(err => console.warn('PDF page extraction failed:', err));
      extractPdfPageText(pdfFile.data)
        .then(pages => setExtractedPages(pages))
        .catch(err => console.warn('PDF text extraction failed:', err));
    }
  }, [files]);

  // Load Google Fonts for theme previews
  useEffect(() => {
    FONT_OPTIONS.forEach(f => {
      const linkId = `gfont-${f.name.replace(/\s+/g, '-')}`;
      if (document.getElementById(linkId)) return;
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.name)}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
    });
  }, []);

  // Infer sector on mount (step 1)
  useEffect(() => {
    if (step === 1 && !inferredSector && (files.length > 0 || topic)) {
      inferSector();
    }
  }, [step]);

  const inferSector = useCallback(async () => {
    setIsInferring(true);
    setError(null);
    setAnalysisPhase(1);

    await new Promise(r => setTimeout(r, 1400));
    setAnalysisPhase(2);

    try {
      const inferencePromise = inferSectorFromContent(topic, files);
      const phase2MinWait = new Promise(r => setTimeout(r, 2200));
      const [inferResult] = await Promise.all([inferencePromise, phase2MinWait]);

      setAnalysisPhase(3);
      await new Promise(r => setTimeout(r, 1200));
      setAnalysisPhase(4);
      await new Promise(r => setTimeout(r, 800));

      setInferredSector(inferResult);
      if (inferResult.sector && !inferResult.isAmbiguous) {
        setSelectedSector(inferResult.sector);
      }
      setAnalysisPhase(5);
    } catch (err) {
      console.error('Sector inference error:', err);
      setError('Could not auto-detect sector. Please select manually.');
      setAnalysisPhase(5);
    } finally {
      setIsInferring(false);
    }
  }, [topic, files]);

  // Trigger findings scan when entering step 2
  const runFindingsScan = useCallback(async () => {
    setIsScanningFindings(true);
    setError(null);
    setFindingsPhase(1);

    try {
      const scanPromise = scanCourseFindings(
        topic, selectedSector, location || 'United States', updateMode, files
      );

      await new Promise(r => setTimeout(r, 1800));
      setFindingsPhase(2);

      const phase2Wait = new Promise(r => setTimeout(r, 2000));
      const [scanResult] = await Promise.all([scanPromise, phase2Wait]);

      setFindingsPhase(3);
      await new Promise(r => setTimeout(r, 1500));
      setFindingsPhase(4);
      await new Promise(r => setTimeout(r, 1200));

      setFindingsScanResult(scanResult);
      setFindings(scanResult.findings);

      const defaultApproved = new Set<string>();
      scanResult.findings.forEach(f => {
        if (f.severity === 'high' || f.severity === 'medium') {
          defaultApproved.add(f.id);
        }
      });
      setApprovedFindingIds(defaultApproved);

      setFindingsPhase(5);
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error('Findings scan error:', err);
      setError('Could not scan course. You can retry or skip to generate directly.');
      setFindingsPhase(0);
    } finally {
      setIsScanningFindings(false);
    }
  }, [topic, selectedSector, location, updateMode, files]);

  useEffect(() => {
    if (step === 2 && updateMode !== 'visual' && !findingsScanResult && !isScanningFindings) {
      runFindingsScan();
    }
  }, [step]);

  // Agent helpers
  const updateAgent = (agentId: string, updates: Partial<AgentState>) => {
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, ...updates } : a));
  };

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

  const stopProgressCycle = (agentId: string) => {
    if (agentProgressIntervals.current[agentId]) {
      clearInterval(agentProgressIntervals.current[agentId]);
      delete agentProgressIntervals.current[agentId];
    }
  };

  useEffect(() => {
    return () => {
      Object.values(agentProgressIntervals.current).forEach(clearInterval);
    };
  }, []);

  // Build visual result from extracted text + theme
  const buildVisualResult = useCallback((pages: ExtractedPageData[], theme: GeneratedTheme): DemoResult => {
    const candidates = pages
      .filter(p => pageImages[p.pageNumber - 1])
      .sort((a, b) => {
        const classOrder = { TEXT_HEAVY: 0, INFOGRAPHIC: 1, TITLE: 2 };
        return (classOrder[a.classification] - classOrder[b.classification]) || (b.textDensityScore - a.textDensityScore);
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
        updateMode,
        generatedAt: new Date().toISOString(),
        searchQueries: [],
      },
    };
  }, [pageImages, selectedSector, location, updateMode]);

  // Launch agent helper
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

  // ── Regulatory mode (4 agents) ──
  const handleRegulatoryGenerate = async () => {
    if (!selectedSector) return;
    setIsProcessing(true);
    setError(null);

    const initialAgents: AgentState[] = REGULATORY_AGENTS.map(a => ({
      ...a, status: 'idle' as AgentStatus, progress: 'Waiting...',
    }));
    setAgents(initialAgents);
    setAgentPhase('running');
    setShowResults(false);
    setStep(4);

    const approved = findings.filter(f => approvedFindingIds.has(f.id));

    await Promise.allSettled([
      launchAgent('fact-checker', 0, async () => {
        if (approved.length > 0) {
          const vResult = await verifyFindings(approved, selectedSector, location || 'United States');
          setVerificationResults(vResult.findings);
          updateAgent('fact-checker', { result: `${vResult.findings.length} findings verified` });
        } else {
          updateAgent('fact-checker', { result: 'No findings to verify' });
        }
      }),
      launchAgent('slide-designer', 300, async () => {
        const demoResult = await generateDemoSlidesEnhanced(
          topic, selectedSector, location || 'United States', updateMode,
          style, files,
          approved.length > 0 ? approved : undefined,
          userContext || undefined,
          Object.keys(designQuestions).length > 0 ? designQuestions : undefined
        );
        setResult(demoResult);
        updateAgent('slide-designer', { result: `${demoResult.slides.length} slides generated` });

        // Fire off parallel image generation
        demoResult.slides
          .map((s, i) => ({ index: i, prompt: s.imagePrompt }))
          .filter((s): s is { index: number; prompt: string } => !!s.prompt)
          .forEach(async ({ index, prompt }) => {
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
      }),
      launchAgent('quiz-builder', 600, async () => {
        const qResult = await generateQuizQuestions(topic, selectedSector, files);
        setQuizResults(qResult.questions);
        updateAgent('quiz-builder', { result: `${qResult.questions.length} questions created` });
      }),
      launchAgent('course-summary', 200, async () => {
        const sResult = await generateCourseSummary(topic, selectedSector, files);
        setCourseSummaryResult(sResult);
        updateAgent('course-summary', { result: sResult.courseTitle || 'Summary ready' });
      }),
    ]);

    setAgentPhase('complete');
    setIsProcessing(false);
  };

  // ── Visual mode (3 agents) ──
  const handleVisualGenerate = async () => {
    setIsGeneratingTheme(true);
    setError(null);

    try {
      if (pageImages.length === 0) {
        setError('No pages could be rendered from the PDF. Please try a different file.');
        setIsGeneratingTheme(false);
        return;
      }

      const themes = aiThemeOptions || [];
      const selected = selectedThemeIndex !== null && themes[selectedThemeIndex]
        ? themes[selectedThemeIndex] : themes[0];

      if (!selected) {
        setError('Please select a theme first.');
        setIsGeneratingTheme(false);
        return;
      }

      const userColor = themeQuestionnaire.primaryColor;
      const selectedFont = selectedFontIndex !== null
        ? FONT_OPTIONS[selectedFontIndex].name : selected.fontSuggestion;

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
      setResult(buildVisualResult(extractedPages, theme));

      const initialAgents: AgentState[] = VISUAL_AGENTS.map(a => ({
        ...a, status: 'idle' as AgentStatus, progress: 'Waiting...',
      }));
      setAgents(initialAgents);
      setAgentPhase('running');
      setShowResults(false);
      setStep(4);
      setIsGeneratingTheme(false);

      let studyGuideSections: StudyGuideSection[] = [];

      const studyGuidePromise = launchAgent('study-guide-agent', 0, async () => {
        const sgResult = await generateStudyGuide(topic, selectedSector, files);
        if (sgResult.sections.length === 0) throw new Error('Study guide returned 0 sections');
        studyGuideSections = sgResult.sections;
        setPreGeneratedStudyGuide(sgResult.sections);
        updateAgent('study-guide-agent', { result: `${sgResult.sections.length} sections generated` });
      });

      const slideDeckPromise = launchAgent('slide-deck-agent', 200, async () => {
        const scResult = await generateSlideContent(topic, selectedSector, files,
          { name: selected.name, description: selected.description });
        if (scResult.slides.length === 0) throw new Error('Slide content returned 0 slides');
        setSlideVerification(scResult.dataVerification || null);
        if (scResult.disclaimer) setSlideDisclaimer(scResult.disclaimer);

        updateAgent('slide-deck-agent', { progress: 'Selecting slide for infographic...' });
        const infographicSelection = await selectInfographicSlide(scResult.slides, topic, selectedSector);
        updateAgent('slide-deck-agent', { progress: 'Generating infographic...' });
        const infographicUrl = await generateAsset(infographicSelection.imagePrompt);

        const slidesWithInfographic = scResult.slides.map((s, i) =>
          i === infographicSelection.selectedSlideIndex && infographicUrl
            ? { ...s, imageUrl: infographicUrl } : s
        );
        setPreGeneratedSlides(slidesWithInfographic);
        updateAgent('slide-deck-agent', {
          result: `${scResult.slides.length} slides + infographic${scResult.dataVerification ? ` — ${scResult.dataVerification.coveragePercentage}% coverage` : ''}`,
        });
      });

      await studyGuidePromise;

      const quizPromise = launchAgent('quiz-agent', 0, async () => {
        const qResult = await generateQuizQuestions(topic, selectedSector, files,
          studyGuideSections.length > 0 ? studyGuideSections : undefined);
        if (qResult.questions.length === 0) {
          const retry = await generateQuizQuestions(topic, selectedSector, files);
          if (retry.questions.length === 0) throw new Error('Quiz returned 0 questions after retry');
          setPreGeneratedQuiz(retry.questions);
          updateAgent('quiz-agent', { result: `${retry.questions.length} questions created` });
          return;
        }
        setPreGeneratedQuiz(qResult.questions);
        updateAgent('quiz-agent', { result: `${qResult.questions.length} questions created` });
      });

      await Promise.allSettled([slideDeckPromise, quizPromise]);
      setAgentPhase('complete');
      setIsProcessing(false);
    } catch (err) {
      console.error('Visual generation error:', err);
      setError('Failed to generate. Please try again.');
      setIsGeneratingTheme(false);
    }
  };

  // ── Full mode (6 agents) ──
  const handleFullGenerate = async () => {
    setIsGeneratingTheme(true);
    setError(null);

    try {
      const themes = aiThemeOptions || [];
      const selected = selectedThemeIndex !== null && themes[selectedThemeIndex]
        ? themes[selectedThemeIndex] : themes[0];

      if (selected) {
        const userColor = themeQuestionnaire.primaryColor;
        const selectedFont = selectedFontIndex !== null
          ? FONT_OPTIONS[selectedFontIndex].name : selected.fontSuggestion;

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
        setResult(buildVisualResult(extractedPages, theme));
      }

      const initialAgents: AgentState[] = FULL_AGENTS.map(a => ({
        ...a, status: 'idle' as AgentStatus, progress: 'Waiting...',
      }));
      setAgents(initialAgents);
      setAgentPhase('running');
      setShowResults(false);
      setStep(4);
      setIsGeneratingTheme(false);

      const approved = findings.filter(f => approvedFindingIds.has(f.id));
      let studyGuideSections: StudyGuideSection[] = [];

      const factCheckerPromise = launchAgent('fact-checker', 0, async () => {
        if (approved.length > 0) {
          const vResult = await verifyFindings(approved, selectedSector, location || 'United States');
          setVerificationResults(vResult.findings);
          updateAgent('fact-checker', { result: `${vResult.findings.length} findings verified` });
        } else {
          updateAgent('fact-checker', { result: 'No findings to verify' });
        }
      });

      const slideDesignerPromise = launchAgent('slide-designer', 300, async () => {
        const demoResult = await generateDemoSlidesEnhanced(
          topic, selectedSector, location || 'United States', updateMode,
          style, files,
          approved.length > 0 ? approved : undefined,
          userContext || undefined,
          Object.keys(designQuestions).length > 0 ? designQuestions : undefined
        );
        setResult(demoResult);
        updateAgent('slide-designer', { result: `${demoResult.slides.length} slides generated` });
      });

      const courseSummaryPromise = launchAgent('course-summary', 200, async () => {
        const sResult = await generateCourseSummary(topic, selectedSector, files);
        setCourseSummaryResult(sResult);
        updateAgent('course-summary', { result: sResult.courseTitle || 'Summary ready' });
      });

      const studyGuidePromise = launchAgent('study-guide-agent', 100, async () => {
        const sgResult = await generateStudyGuide(topic, selectedSector, files);
        if (sgResult.sections.length === 0) throw new Error('Study guide returned 0 sections');
        studyGuideSections = sgResult.sections;
        setPreGeneratedStudyGuide(sgResult.sections);
        updateAgent('study-guide-agent', { result: `${sgResult.sections.length} sections generated` });
      });

      const slideDeckPromise = launchAgent('slide-deck-agent', 400, async () => {
        const scResult = await generateSlideContent(topic, selectedSector, files,
          selected ? { name: selected.name, description: selected.description } : undefined);
        if (scResult.slides.length === 0) throw new Error('Slide content returned 0 slides');
        setSlideVerification(scResult.dataVerification || null);
        if (scResult.disclaimer) setSlideDisclaimer(scResult.disclaimer);

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

      await studyGuidePromise;

      const quizPromise = launchAgent('quiz-agent', 0, async () => {
        const qResult = await generateQuizQuestions(topic, selectedSector, files,
          studyGuideSections.length > 0 ? studyGuideSections : undefined);
        if (qResult.questions.length === 0) {
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

  // Navigation
  const canProceed = (): boolean => {
    switch (step) {
      case 1: return selectedSector.length > 0;
      case 2: return findingsPhase === 5 && (findingsReviewComplete || findings.length === 0);
      case 3: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (!canProceed()) return;
    if (step === 1 && updateMode === 'visual') {
      setStep(3); // Skip findings
    } else if (step === 2) {
      if (updateMode === 'regulatory') {
        handleRegulatoryGenerate();
      } else {
        setStep(3); // Go to style for full mode
      }
    } else if (step === 3) {
      if (updateMode === 'visual') handleVisualGenerate();
      else if (updateMode === 'full') handleFullGenerate();
      else handleRegulatoryGenerate();
    } else {
      setStep(s => s + 1);
    }
  };

  const prevStep = () => {
    if (step === 1) {
      onBack();
    } else if (step === 3 && updateMode === 'visual') {
      setStep(1);
      setAnalysisPhase(0);
      setInferredSector(null);
      setDeselectedTopics(new Set());
    } else {
      if (step === 1) {
        setAnalysisPhase(0);
        setInferredSector(null);
        setDeselectedTopics(new Set());
      }
      if (step === 2) {
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
  const totalSteps = updateMode === 'full' ? 4 : 3;
  const currentProgress = updateMode === 'visual'
    ? Math.min(step === 3 ? 2 : step, totalSteps)
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

  // ─── STEP 1: Sector Inference ───────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-full max-w-lg bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
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
              {[
                { phase: 1, icon: <FileType className="w-5 h-5 text-accent shrink-0" />, text: `Reading document${files.length > 1 ? 's' : ''}...`, sub: files.map(f => f.name).join(', ') },
                { phase: 2, icon: <Search className="w-5 h-5 text-accent shrink-0" />, text: 'Identifying sector...' },
                { phase: 3, icon: <Tag className="w-5 h-5 text-accent shrink-0" />, text: 'Mapping key topics...' },
                { phase: 4, icon: <Brain className="w-5 h-5 text-accent shrink-0" />, text: 'Building content profile...' },
              ].map(({ phase, icon, text, sub }) => (
                <div key={phase} className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                  analysisPhase >= phase ? 'bg-surface border-surface-border opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}>
                  {analysisPhase > phase ? (
                    <Check className="w-5 h-5 text-success shrink-0" />
                  ) : analysisPhase === phase ? (
                    <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                  ) : (
                    <div className="w-5 h-5 shrink-0" />
                  )}
                  {icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{text}</p>
                    {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Sector dropdown */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-text-primary mb-2">Industry</label>
                <div className="relative">
                  <select
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                    className="w-full bg-surface border border-surface-border text-text-primary rounded-xl px-4 py-3 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  >
                    <option value="">Select your industry...</option>
                    {SECTORS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
                {inferredSector && inferredSector.confidence !== 'low' && (
                  <p className="text-xs text-text-muted mt-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-accent" />
                    Auto-detected: {inferredSector.sector}
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      inferredSector.confidence === 'high' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
                    }`}>
                      {inferredSector.confidence}
                    </span>
                  </p>
                )}
              </div>

              {/* Detected topics */}
              {inferredSector?.detectedTopics && inferredSector.detectedTopics.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-text-primary mb-2">Detected Topics</label>
                  <p className="text-xs text-text-muted mb-3">Deselect any that aren't relevant to focus the analysis.</p>
                  <div className="flex flex-wrap gap-2">
                    {inferredSector.detectedTopics.map(t => {
                      const isOff = deselectedTopics.has(t);
                      return (
                        <button
                          key={t}
                          onClick={() => setDeselectedTopics(prev => {
                            const next = new Set(prev);
                            if (isOff) next.delete(t); else next.add(t);
                            return next;
                          })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            isOff
                              ? 'border-surface-border text-text-muted line-through opacity-50'
                              : 'border-accent/30 text-accent bg-accent/5'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Location */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-text-primary mb-2">Jurisdiction / Location</label>
                <LocationInput
                  value={location}
                  onChange={setLocation}
                  placeholder="e.g., California, United Kingdom, EU"
                />
                <p className="text-xs text-text-muted mt-1.5">
                  {updateMode === 'visual'
                    ? 'Helps us reference local standards in your materials.'
                    : 'Helps target region-specific regulations and standards.'}
                </p>
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
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1 bg-accent text-white py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/30"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── STEP 2: Findings Review ────────────────────────────────────────────────
  if (step === 2) {
    const totalFindings = findings.length;
    const hasFindings = totalFindings > 0;
    const currentFinding = hasFindings ? findings[currentFindingIndex] : null;
    const isReviewingFindings = hasFindings && !findingsReviewComplete && currentFindingIndex < totalFindings;

    const handleIncludeFinding = () => {
      if (!currentFinding) return;
      setApprovedFindingIds(prev => new Set(prev).add(currentFinding.id));
      if (currentFindingIndex + 1 >= totalFindings) setFindingsReviewComplete(true);
      else setCurrentFindingIndex(i => i + 1);
    };

    const handleSkipFinding = () => {
      if (!currentFinding) return;
      setApprovedFindingIds(prev => { const next = new Set(prev); next.delete(currentFinding.id); return next; });
      if (currentFindingIndex + 1 >= totalFindings) setFindingsReviewComplete(true);
      else setCurrentFindingIndex(i => i + 1);
    };

    const handleUndoFinding = () => {
      if (currentFindingIndex > 0) { setCurrentFindingIndex(i => i - 1); setFindingsReviewComplete(false); }
    };

    const categoryLabels: Record<string, string> = {
      outdated: 'Outdated Content', missing: 'Missing Topic',
      compliance: 'Compliance Gap', structural: 'Structure Issue',
    };
    const severityColors: Record<string, string> = {
      high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-green-500',
    };

    return (
      <div className="flex flex-col items-center">
        <div className="w-full max-w-lg bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
          {renderProgressBar()}

          {isScanningFindings ? (
            <>
              <h2 className="text-2xl font-bold text-center mb-2">Fact-checking your course</h2>
              <p className="text-text-muted text-center mb-8">
                Comparing your content against current {selectedSector || 'industry'} standards...
              </p>
              <div className="space-y-4 py-4">
                {[
                  { phase: 1, icon: <Search className="w-5 h-5 text-accent shrink-0" />, active: `Cross-referencing ${selectedSector || 'industry'} standards...`, done: 'Standards cross-referenced', doneSub: 'Searched current regulations and best practices' },
                  { phase: 2, icon: <AlertCircle className="w-5 h-5 text-accent shrink-0" />, active: `Checking ${location || 'regional'} regulatory updates...`, done: 'Regulatory changes checked', doneSub: `Verified against ${new Date().getFullYear()} requirements` },
                  { phase: 3, icon: <Brain className="w-5 h-5 text-accent shrink-0" />, active: 'Comparing against latest best practices...', done: 'Best practices compared' },
                  { phase: 4, icon: <Sparkles className="w-5 h-5 text-accent shrink-0" />, active: 'Prioritizing by impact...', done: `Found ${findings.length} improvement${findings.length !== 1 ? 's' : ''}`,
                    doneSub: findings.length > 0 ? `${findings.filter(f => f.severity === 'high').length} high priority, ${findings.filter(f => f.severity === 'medium').length} medium` : undefined },
                ].map(({ phase, icon, active, done, doneSub }) => (
                  <div key={phase} className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                    findingsPhase >= phase ? 'bg-surface border-surface-border opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                  }`}>
                    {findingsPhase > phase ? (
                      <Check className="w-5 h-5 text-success shrink-0" />
                    ) : findingsPhase === phase ? (
                      <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                    ) : (
                      <div className="w-5 h-5 shrink-0" />
                    )}
                    {icon}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {findingsPhase > phase ? done : active}
                      </p>
                      {findingsPhase > phase && doneSub && (
                        <p className={`text-xs mt-0.5 animate-in fade-in duration-300 ${phase === 4 && findings.length > 0 ? 'text-success' : 'text-text-muted'}`}>
                          {doneSub}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>

          ) : isReviewingFindings && currentFinding ? (
            <div key={currentFinding.id} className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-medium text-text-muted">
                  Finding {currentFindingIndex + 1} of {totalFindings}
                </span>
                <div className="flex gap-1.5">
                  {findings.map((_, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                      i < currentFindingIndex
                        ? approvedFindingIds.has(findings[i].id) ? 'bg-success' : 'bg-surface-border'
                        : i === currentFindingIndex ? 'bg-accent scale-125' : 'bg-surface-border'
                    }`} />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {categoryLabels[currentFinding.category] || currentFinding.category}
                </span>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${severityColors[currentFinding.severity]}`} />
                  <span className="text-xs text-text-muted capitalize">{currentFinding.severity} priority</span>
                </div>
              </div>

              <h3 className="text-xl font-bold text-text-primary mb-4">{currentFinding.title}</h3>

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

              <p className="text-sm text-text-muted leading-relaxed mb-4">{currentFinding.description}</p>

              {currentFinding.currentInfo && (
                <div className="bg-success/5 rounded-xl border border-success/20 overflow-hidden mb-6">
                  <div className="px-4 py-2 border-b border-success/20">
                    <span className="text-xs text-success font-medium">Updated information</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-success/90 leading-relaxed">{currentFinding.currentInfo}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {currentFindingIndex > 0 && (
                  <button onClick={handleUndoFinding} className="px-4 py-3.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface transition-all" title="Go back">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <button onClick={handleSkipFinding} className="flex-1 bg-surface text-text-muted py-3.5 rounded-xl font-semibold hover:bg-surface-border hover:text-text-primary transition-all">
                  Skip
                </button>
                <button onClick={handleIncludeFinding} className="flex-1 bg-accent text-background py-3.5 rounded-xl font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> {
                    currentFinding.category === 'outdated' ? 'Remove' :
                    currentFinding.category === 'missing' ? 'Include' : 'Update'
                  }
                </button>
              </div>
            </div>

          ) : findingsReviewComplete || (hasFindings && currentFindingIndex >= totalFindings) ? (
            <>
              <div className="text-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
                <h2 className="text-2xl font-bold mb-1">Review complete</h2>
                <p className="text-text-muted">
                  {approvedFindingIds.size} of {totalFindings} finding{totalFindings !== 1 ? 's' : ''} selected for update
                </p>
              </div>

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

              {error && (
                <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">{error}</div>
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
            <>
              <div className="text-center mb-8">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Your content looks current!</h2>
                <p className="text-text-muted mt-2">
                  We didn't find significant issues with your materials. Let's freshen up the design instead.
                </p>
              </div>
              <button
                onClick={() => { updateMode === 'regulatory' ? handleRegulatoryGenerate() : setStep(3); }}
                disabled={isProcessing}
                className="w-full bg-accent text-background py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <>Continue to Design Update <Palette className="w-4 h-4" /></>}
              </button>
            </>

          ) : (
            <>
              <h2 className="text-2xl font-bold text-center mb-2">Scan incomplete</h2>
              <p className="text-text-muted text-center mb-6">We couldn't complete the analysis. You can retry or skip ahead.</p>
              {error && <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">{error}</div>}
              <div className="flex gap-3">
                <button onClick={prevStep} className="flex-1 bg-surface text-text-primary py-4 rounded-xl font-bold hover:bg-surface transition-all flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={runFindingsScan} className="flex-1 bg-accent text-background py-4 rounded-xl font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Retry Scan
                </button>
              </div>
              <button
                onClick={() => { updateMode === 'regulatory' ? handleRegulatoryGenerate() : setStep(3); }}
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

  // ─── STEP 3: Style Selection ────────────────────────────────────────────────
  if (step === 3) {
    if (updateMode === 'visual' || updateMode === 'full') {
      const themes = aiThemeOptions || [];
      const selectedTheme = selectedThemeIndex !== null ? themes[selectedThemeIndex] : null;

      const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('Logo must be under 5MB.'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => setBrandLogo(ev.target?.result as string);
        reader.readAsDataURL(file);
      };

      const renderLayoutAccent = (theme: ThemeOption) => {
        switch (theme.layoutStyle) {
          case 'organic': return <div className="absolute" style={{ bottom: '10%', right: '8%', width: '22%', height: '22%', borderRadius: '50%', background: theme.primaryColor, opacity: 0.25 }} />;
          case 'editorial': return <div className="absolute" style={{ top: 0, right: 0, width: '35%', height: '100%', background: `linear-gradient(135deg, transparent 50%, ${theme.primaryColor}22 50%)` }} />;
          case 'bold': return <div className="absolute" style={{ top: '12%', right: '6%', width: '28%', height: '55%', background: theme.primaryColor, opacity: 0.15, borderRadius: 4 }} />;
          case 'minimal': return <div className="absolute" style={{ bottom: '15%', left: '14%', right: '14%', height: 1, background: theme.primaryColor, opacity: 0.3 }} />;
          case 'structured': return <div className="absolute" style={{ top: 0, right: 0, width: '40%', height: '100%', borderLeft: `2px solid ${theme.primaryColor}33`, background: `${theme.primaryColor}08` }} />;
          default: return <div className="absolute" style={{ top: '15%', right: '8%', width: '18%', height: '18%', background: theme.primaryColor, opacity: 0.2, transform: 'rotate(45deg)' }} />;
        }
      };

      return (
        <div className="flex flex-col items-center overflow-y-auto">
          <div className="w-full max-w-2xl bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
            {renderProgressBar()}
            <h2 className="text-2xl font-bold text-center mb-2">Pick a vibe</h2>
            <p className="text-text-muted text-center mb-8">Choose a direction, then customize with your brand color and logo.</p>

            <div className="space-y-6">
              {themes.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {themes.map((theme, idx) => {
                    const isSelected = selectedThemeIndex === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedThemeIndex(idx)}
                        className={`rounded-xl border-2 text-left transition-all overflow-hidden ${
                          isSelected ? 'border-accent ring-2 ring-accent/30 scale-[1.02]' : 'border-surface-border hover:border-accent/30 hover:scale-[1.01]'
                        }`}
                      >
                        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9', background: theme.backgroundColor }}>
                          {renderLayoutAccent(theme)}
                          <div className="relative z-10 p-[12%] flex flex-col gap-[6%]">
                            <div style={{ width: '65%', height: 'clamp(4px, 0.8vw, 7px)', background: theme.textColor, borderRadius: 2, opacity: 0.85 }} />
                            <div style={{ width: '45%', height: 'clamp(3px, 0.5vw, 5px)', background: theme.primaryColor, borderRadius: 2 }} />
                            <div className="flex flex-col gap-[4px] mt-auto">
                              <div style={{ width: '80%', height: 'clamp(2px, 0.35vw, 3px)', background: theme.mutedTextColor, borderRadius: 1, opacity: 0.5 }} />
                              <div style={{ width: '60%', height: 'clamp(2px, 0.35vw, 3px)', background: theme.mutedTextColor, borderRadius: 1, opacity: 0.3 }} />
                            </div>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-semibold text-text-primary">{theme.name}</p>
                          <p className="text-[10px] text-text-muted mt-0.5 leading-tight">{theme.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedTheme && (
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-3">Typography</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FONT_OPTIONS.map((f, idx) => {
                      const isSelected = selectedFontIndex === idx;
                      return (
                        <button key={f.name} onClick={() => setSelectedFontIndex(isSelected ? null : idx)}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${isSelected ? 'border-accent bg-accent/10' : 'border-surface-border hover:border-accent/30'}`}>
                          <span className="text-base font-semibold text-text-primary" style={{ fontFamily: f.name }}>Aa</span>
                          <p className="text-[10px] text-text-muted mt-1">{f.name}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedTheme && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-text-muted mb-2">Brand Color (optional)</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={themeQuestionnaire.primaryColor || selectedTheme.primaryColor}
                        onChange={(e) => setThemeQuestionnaire(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-10 h-10 rounded-lg border border-surface-border cursor-pointer" />
                      <span className="text-xs text-text-muted">{themeQuestionnaire.primaryColor ? 'Custom' : 'Theme default'}</span>
                      {themeQuestionnaire.primaryColor && (
                        <button onClick={() => setThemeQuestionnaire(prev => ({ ...prev, primaryColor: undefined }))} className="text-xs text-accent hover:underline">Reset</button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-text-muted mb-2">Logo (optional)</label>
                    {brandLogo ? (
                      <div className="flex items-center gap-2">
                        <img src={brandLogo} alt="Logo" className="w-10 h-10 object-contain rounded-lg border border-surface-border" />
                        <button onClick={() => setBrandLogo(null)} className="text-xs text-accent hover:underline">Remove</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-surface-border text-text-muted hover:border-accent/30 hover:text-accent cursor-pointer transition-all">
                        <ImagePlus className="w-4 h-4" />
                        <span className="text-xs">Upload</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>

            {error && <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">{error}</div>}

            <div className="flex gap-3 mt-8">
              <button onClick={prevStep} className="flex-1 bg-surface text-text-primary py-4 rounded-xl font-bold hover:bg-surface transition-all flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={nextStep} disabled={!canProceed() || isGeneratingTheme}
                className="flex-1 bg-accent text-white py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/30">
                {isGeneratingTheme ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating theme...</> : <>Generate <Sparkles className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Regulatory-only: simple style picker
    return (
      <div className="flex flex-col items-center">
        <div className="w-full max-w-lg bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
          {renderProgressBar()}
          <h2 className="text-2xl font-bold text-center mb-2">Choose a style</h2>
          <p className="text-text-muted text-center mb-8">Set the visual direction for your modernized slides.</p>
          <div className="grid grid-cols-1 gap-4 mb-8">
            {STYLES.map((s) => (
              <button key={s.id} onClick={() => setStyle(s.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${style === s.id ? 'border-accent bg-accent/10' : 'border-surface-border hover:border-surface-border'}`}>
                <div className="flex items-center gap-3">
                  <Palette className={`w-5 h-5 ${style === s.id ? 'text-accent' : 'text-text-muted'}`} />
                  <div>
                    <span className={`font-semibold ${style === s.id ? 'text-accent' : 'text-text-muted'}`}>{s.label}</span>
                    <p className="text-xs text-text-muted mt-0.5">{s.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {error && <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">{error}</div>}
          <div className="flex gap-3">
            <button onClick={prevStep} className="flex-1 bg-surface text-text-primary py-4 rounded-xl font-bold hover:bg-surface transition-all flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={handleRegulatoryGenerate} disabled={isProcessing}
              className="flex-1 bg-accent text-white py-4 rounded-xl font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/30">
              {isProcessing ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : <>Generate Slides <Sparkles className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 4: Agent Orchestration + Results ──────────────────────────────────
  if (step === 4) {
    // Phase 1: Agent panel
    if (!showResults && agentPhase !== 'idle') {
      const allDone = agents.length > 0 && agents.every(a => a.status === 'complete' || a.status === 'error');
      const completedCount = agents.filter(a => a.status === 'complete').length;
      const hasEnoughResults = result !== null || completedCount >= 2;

      return (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-2xl bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
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

            <div className="grid grid-cols-2 gap-4 mb-8">
              {agents.map((agent, agentIdx) => {
                const isWorking = agent.status === 'working';
                const isComplete = agent.status === 'complete';
                const isError = agent.status === 'error';
                const isIdle = agent.status === 'idle';
                const isLastOdd = agents.length % 2 === 1 && agentIdx === agents.length - 1;

                return (
                  <div key={agent.id}
                    className={`relative rounded-2xl border-2 p-5 transition-all duration-500${isLastOdd ? ' col-span-2' : ''}`}
                    style={{
                      borderColor: isWorking ? agent.color : isComplete ? `${agent.color}80` : isError ? '#c27056' : 'rgba(255,248,230,0.08)',
                      backgroundColor: isWorking ? `${agent.color}08` : isComplete ? `${agent.color}05` : 'rgba(26,25,20,0.8)',
                      backdropFilter: 'blur(8px)',
                      boxShadow: isWorking ? `0 0 20px ${agent.color}15, 0 0 40px ${agent.color}08` : 'none',
                      animation: isWorking ? 'pulse 2s ease-in-out infinite' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
                        style={{
                          backgroundColor: isComplete || isWorking ? `${agent.color}20` : 'rgba(255,248,230,0.04)',
                          color: isComplete || isWorking ? agent.color : 'rgba(245,240,224,0.3)',
                        }}>
                        {agentIconMap[agent.icon] || <FileText className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{agent.name}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: isComplete ? '#6abf8a' : isWorking ? agent.color : isError ? '#c27056' : 'rgba(245,240,224,0.3)' }}>
                          {isComplete ? 'Done' : isWorking ? 'Working' : isError ? 'Error' : 'Queued'}
                        </span>
                      </div>
                      {isComplete && <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: '#6abf8a' }} />}
                      {isWorking && <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: agent.color }} />}
                      {isError && <AlertOctagon className="w-5 h-5 shrink-0" style={{ color: '#c27056' }} />}
                    </div>
                    <div className="min-h-[24px]">
                      {isWorking && <p className="text-xs text-text-muted transition-opacity duration-500" style={{ opacity: 0.8 }}>{agent.progress}</p>}
                      {isComplete && agent.result && <p className="text-xs font-medium" style={{ color: agent.color }}>{agent.result}</p>}
                      {isError && <p className="text-xs text-warning truncate">{agent.error || 'An error occurred'}</p>}
                      {isIdle && <p className="text-xs text-text-muted" style={{ opacity: 0.4 }}>Waiting to start...</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            {(allDone || agentPhase === 'complete') && (
              <button onClick={() => setShowResults(true)} disabled={!hasEnoughResults}
                className="w-full bg-accent text-background py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20">
                View Results <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {allDone && (
              <button onClick={onComplete} className="w-full mt-3 text-sm text-text-muted hover:text-text-primary transition-colors">
                Back to dashboard
              </button>
            )}
          </div>
        </div>
      );
    }

    // Phase 2: Results
    if (result) {
      if (updateMode === 'full') {
        return (
          <div>
            {fullModeTab === 'regulatory' ? (
              <RegulatoryOutput result={result} findings={findings} approvedFindingIds={approvedFindingIds}
                pageImages={pageImages} extractedPages={extractedPages} selectedSector={selectedSector}
                location={location} topic={topic} presentationTitle={courseSummaryResult?.courseTitle || topic}
                updateMode={updateMode} onReset={onComplete} verificationResults={verificationResults}
                externalActiveTab={REGULATORY_TAB_IDS.includes(activeResultTab) ? activeResultTab : undefined}
                onExternalTabChange={setActiveResultTab} />
            ) : (
              <VisualOutput result={result} pageImages={pageImages} extractedPages={extractedPages}
                generatedTheme={generatedTheme} selectedSector={selectedSector} location={location}
                topic={topic} presentationTitle={courseSummaryResult?.courseTitle || topic} files={files}
                onReset={onComplete}
                preGeneratedStudyGuide={preGeneratedStudyGuide.length > 0 ? preGeneratedStudyGuide : undefined}
                preGeneratedQuiz={preGeneratedQuiz.length > 0 ? preGeneratedQuiz : undefined}
                preGeneratedSlides={preGeneratedSlides.length > 0 ? preGeneratedSlides : undefined}
                slideVerification={slideVerification} disclaimer={slideDisclaimer}
                externalActiveTab={VISUAL_TAB_IDS.includes(activeResultTab) ? activeResultTab : undefined}
                onExternalTabChange={setActiveResultTab} />
            )}
          </div>
        );
      }

      if (updateMode === 'regulatory') {
        return (
          <RegulatoryOutput result={result} findings={findings} approvedFindingIds={approvedFindingIds}
            pageImages={pageImages} extractedPages={extractedPages} selectedSector={selectedSector}
            location={location} topic={topic} presentationTitle={courseSummaryResult?.courseTitle || topic}
            updateMode={updateMode} onReset={onComplete} verificationResults={verificationResults}
            externalActiveTab={activeResultTab} onExternalTabChange={setActiveResultTab} />
        );
      }

      return (
        <VisualOutput result={result} pageImages={pageImages} extractedPages={extractedPages}
          generatedTheme={generatedTheme} selectedSector={selectedSector} location={location}
          topic={topic} presentationTitle={courseSummaryResult?.courseTitle || topic} files={files}
          onReset={onComplete}
          preGeneratedStudyGuide={preGeneratedStudyGuide.length > 0 ? preGeneratedStudyGuide : undefined}
          preGeneratedQuiz={preGeneratedQuiz.length > 0 ? preGeneratedQuiz : undefined}
          preGeneratedSlides={preGeneratedSlides.length > 0 ? preGeneratedSlides : undefined}
          slideVerification={slideVerification} disclaimer={slideDisclaimer}
          externalActiveTab={activeResultTab} onExternalTabChange={setActiveResultTab} />
      );
    }
  }

  // Fallback / Loading
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );
};

export default AgentFlow;
