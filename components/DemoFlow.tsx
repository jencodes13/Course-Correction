import React, { useState, useEffect, useCallback } from 'react';
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
  Paintbrush
} from 'lucide-react';
import {
  inferSectorFromContent,
  generateDemoSlidesEnhanced,
  scanCourseFindings,
  generateAsset,
  generatePresentationTheme
} from '../services/geminiService';
import { processFileForUpload } from '../services/supabaseClient';
import { extractPdfPageImages } from '../utils/pdfPageRenderer';
import { extractPdfPageText } from '../utils/pdfTextExtractor';
import { recolorSlideImage } from '../utils/pdfColorRemapper';
import { useGoogleDrivePicker } from '../hooks/useGoogleDrivePicker';
import GoogleDriveButton from './GoogleDriveButton';
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
  GeneratedTheme
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
  const [recoloredImages, setRecoloredImages] = useState<Record<number, string>>({}); // pageNumber → recolored data URL
  const [brandLogo, setBrandLogo] = useState<string | null>(null); // data URL
  const [themeQuestionnaire, setThemeQuestionnaire] = useState<{
    brandPersonality?: string;
    audience?: string;
    desiredFeeling?: string;
    primaryColor?: string;
  }>({});
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

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
      const matchedSector = SECTORS.find(s => sectorParts.includes(s)) || sectorParts[0] || result.sector;
      setSelectedSector(matchedSector);

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

  // Generate slides
  const handleGenerate = async () => {
    if (!updateMode || !selectedSector) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Pass approved findings + user context + design preferences to guided generation
      const approved = findings.filter(f => approvedFindingIds.has(f.id));
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
      setStep(6);

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
    } catch (err) {
      console.error('Generation error:', err);
      setError('Failed to generate slides. Please try again.');
    } finally {
      setIsProcessing(false);
    }
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

    const slides: DemoSlideEnhanced[] = candidates.map((page, idx) => ({
      id: `slide-${idx + 1}`,
      before: {
        title: page.title || `Page ${page.pageNumber}`,
        subtitle: '',
        bullets: [],
        citationIds: [],
        sourcePageNumber: page.pageNumber,
      },
      after: {
        title: page.title || `Page ${page.pageNumber}`,
        subtitle: '',
        bullets: [],
        citationIds: [],
        sourcePageNumber: page.pageNumber,
      },
      changesSummary: 'REDESIGNED',
      visualStyle: {
        accentColor: theme.primaryColor,
        layout: 'hero' as const,
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

  // Vibe presets — these define the exact recoloring targets.
  // Keeping them here (not just in step 5 JSX) so handleDesignGenerate can access them.
  const VIBE_THEMES: Record<string, { bg: string; text: string; accent: string; font: string; reasoning: string }> = {
    'light-minimal': { bg: '#f8f9fa', text: '#1e293b', accent: '#64748b', font: 'Inter', reasoning: 'Clean minimal palette with maximum whitespace' },
    'dark-bold':     { bg: '#0f172a', text: '#f1f5f9', accent: '#3b82f6', font: 'Space Grotesk', reasoning: 'High-contrast dark mode with bold blue accents' },
    'colorful-warm': { bg: '#1c1917', text: '#fef3c7', accent: '#ea580c', font: 'DM Sans', reasoning: 'Warm dark tones with vibrant orange energy' },
    'structured-corporate': { bg: '#0c1222', text: '#e2e8f0', accent: '#1d4ed8', font: 'IBM Plex Sans', reasoning: 'Navy corporate palette with institutional authority' },
  };

  // Generate theme and build visual result (design mode)
  const handleDesignGenerate = async () => {
    setIsGeneratingTheme(true);
    setError(null);

    try {
      if (pageImages.length === 0) {
        setError('No pages could be rendered from the PDF. Please try a different file.');
        setIsGeneratingTheme(false);
        return;
      }

      // Use the selected vibe's predefined colors — these are reliable and dramatic
      const vibeId = themeQuestionnaire.brandPersonality || 'dark-bold';
      const vibePreset = VIBE_THEMES[vibeId] || VIBE_THEMES['dark-bold'];

      // If user provided a custom brand color, use it as the accent
      const userColor = themeQuestionnaire.primaryColor;

      const theme: GeneratedTheme = {
        backgroundColor: vibePreset.bg,
        textColor: vibePreset.text,
        primaryColor: userColor || vibePreset.accent,
        secondaryColor: vibePreset.accent,
        mutedTextColor: vibePreset.text + '99',
        fontSuggestion: vibePreset.font,
        layoutStyle: 'geometric',
        designReasoning: vibePreset.reasoning,
      };
      setGeneratedTheme(theme);

      const demoResult = buildVisualResult(extractedPages, theme);

      // Recolor the selected page images with the vibe colors
      const recolored: Record<number, string> = {};
      await Promise.all(
        demoResult.slides.map(async (slide) => {
          const pageNum = slide.before.sourcePageNumber;
          if (pageNum && pageNum > 0 && pageNum <= pageImages.length) {
            recolored[pageNum] = await recolorSlideImage(
              pageImages[pageNum - 1],
              theme.backgroundColor,
              theme.textColor,
            );
          }
        })
      );
      setRecoloredImages(recolored);

      setResult(demoResult);
      setStep(6);
    } catch (err) {
      console.error('Theme generation error:', err);
      setError('Failed to generate theme. Please try again.');
    } finally {
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
        handleDesignGenerate();
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
                          : `Detected: ${selectedSector || inferredSector.sector.split(',')[0]?.trim()} (${inferredSector.confidence} confidence)`
                        }
                      </p>
                      <p className="text-text-muted mt-1 text-xs line-clamp-2">{inferredSector.reasoning}</p>
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

              {/* Blurred pro findings teaser — looks like more cards behind glass */}
              <div className="relative mb-6 overflow-hidden rounded-xl">
                {/* Fake stacked finding cards */}
                <div className="space-y-2 opacity-40">
                  <div className="p-4 bg-surface rounded-lg border border-surface-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-16 h-3 bg-surface-border rounded-full" />
                      <div className="w-2 h-2 rounded-full bg-surface-border" />
                      <div className="w-10 h-3 bg-surface-border rounded-full" />
                    </div>
                    <div className="w-3/4 h-4 bg-surface-border rounded mb-1.5" />
                    <div className="w-full h-3 bg-surface-border rounded" />
                  </div>
                  <div className="p-4 bg-surface rounded-lg border border-surface-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-14 h-3 bg-surface-border rounded-full" />
                      <div className="w-2 h-2 rounded-full bg-surface-border" />
                      <div className="w-12 h-3 bg-surface-border rounded-full" />
                    </div>
                    <div className="w-2/3 h-4 bg-surface-border rounded mb-1.5" />
                    <div className="w-5/6 h-3 bg-surface-border rounded" />
                  </div>
                  <div className="p-4 bg-surface rounded-lg border border-surface-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-20 h-3 bg-surface-border rounded-full" />
                      <div className="w-2 h-2 rounded-full bg-surface-border" />
                      <div className="w-8 h-3 bg-surface-border rounded-full" />
                    </div>
                    <div className="w-4/5 h-4 bg-surface-border rounded" />
                  </div>
                </div>
                {/* Glass overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-card/30 via-card/70 to-card flex flex-col items-center justify-end pb-4">
                  <p className="text-sm font-semibold text-text-primary mb-1">
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
    // Visual mode: pick a vibe (visual thumbnails) + optional color & logo
    if (updateMode === 'visual') {
      const VIBES = [
        {
          id: 'light-minimal',
          label: 'Light & Minimal',
          desc: 'Soft cream background, clean typography, subtle slate accents',
          bg: '#f8f9fa', accent: '#64748b', text: '#1e293b',
        },
        {
          id: 'dark-bold',
          label: 'Dark & Bold',
          desc: 'Dark navy background, bright text, vivid blue accents',
          bg: '#0f172a', accent: '#3b82f6', text: '#f1f5f9',
        },
        {
          id: 'colorful-warm',
          label: 'Colorful & Warm',
          desc: 'Dark warm background, golden text, vibrant orange pops',
          bg: '#1c1917', accent: '#ea580c', text: '#fef3c7',
        },
        {
          id: 'structured-corporate',
          label: 'Structured & Corporate',
          desc: 'Deep navy background, crisp white text, professional blue',
          bg: '#0c1222', accent: '#1d4ed8', text: '#e2e8f0',
        },
      ];

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

      const selectedVibe = VIBES.find(v => v.id === themeQuestionnaire.brandPersonality) || null;

      return (
        <div className="min-h-screen flex flex-col items-center bg-background p-6 py-12 overflow-y-auto">
          <div className="w-full max-w-lg bg-card p-8 rounded-3xl shadow-xl border border-surface-border my-auto">
            {renderProgressBar()}
            <h2 className="text-2xl font-bold text-center mb-2">Pick a vibe</h2>
            <p className="text-text-muted text-center mb-8">
              Choose a direction, then customize with your brand color and logo.
            </p>

            <div className="space-y-6">
              {/* Visual style thumbnails — 2x2 grid with mini slide previews */}
              <div className="grid grid-cols-2 gap-3">
                {VIBES.map(vibe => {
                  const isSelected = themeQuestionnaire.brandPersonality === vibe.id;
                  return (
                    <button
                      key={vibe.id}
                      onClick={() => setThemeQuestionnaire(q => ({
                        ...q,
                        brandPersonality: vibe.id,
                      }))}
                      className={`rounded-xl border-2 text-left transition-all overflow-hidden ${
                        isSelected
                          ? 'border-accent ring-1 ring-accent/30'
                          : 'border-surface-border hover:border-accent/30'
                      }`}
                    >
                      {/* Mini slide thumbnail */}
                      <div
                        className="relative w-full"
                        style={{
                          aspectRatio: '16 / 9',
                          background: vibe.bg,
                        }}
                      >
                        {/* Accent sidebar */}
                        <div className="absolute left-0 top-0 bottom-0" style={{ width: '6%', background: vibe.accent }} />
                        {/* Title bar */}
                        <div className="absolute" style={{ top: '18%', left: '14%', right: '10%' }}>
                          <div style={{ width: '70%', height: 'clamp(4px, 1.2vw, 7px)', background: vibe.text, borderRadius: 2, opacity: 0.85 }} />
                          <div style={{ width: '40%', height: 'clamp(3px, 0.8vw, 5px)', background: vibe.accent, borderRadius: 2, marginTop: 'clamp(3px, 0.6vw, 5px)', opacity: 0.7 }} />
                        </div>
                        {/* Bullet lines */}
                        <div className="absolute" style={{ top: '50%', left: '14%', right: '10%' }}>
                          {[0.9, 0.75, 0.6].map((w, i) => (
                            <div key={i} style={{
                              width: `${w * 100}%`, height: 'clamp(2px, 0.5vw, 3px)',
                              background: vibe.text, borderRadius: 1, opacity: 0.3,
                              marginBottom: 'clamp(3px, 0.5vw, 4px)',
                            }} />
                          ))}
                        </div>
                        {/* Selected check */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      {/* Label */}
                      <div className="p-3">
                        <span className={`font-semibold text-sm block ${
                          isSelected ? 'text-accent' : 'text-text-primary'
                        }`}>{vibe.label}</span>
                        <p className="text-xs text-text-muted mt-0.5 leading-snug">{vibe.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Brand color (optional) */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">
                  Brand color <span className="font-normal text-text-muted">(optional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={themeQuestionnaire.primaryColor || selectedVibe?.accent || '#2563eb'}
                    onChange={(e) => setThemeQuestionnaire(q => ({ ...q, primaryColor: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-surface-border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={themeQuestionnaire.primaryColor || ''}
                    onChange={(e) => setThemeQuestionnaire(q => ({ ...q, primaryColor: e.target.value }))}
                    placeholder={selectedVibe?.accent || '#2563eb'}
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

              {/* Brand logo (optional) */}
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
                  onClick={handleDesignGenerate}
                  disabled={isGeneratingTheme || !themeQuestionnaire.brandPersonality}
                  className="flex-1 bg-accent text-white py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/30"
                >
                  {isGeneratingTheme ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Generating theme...
                    </>
                  ) : (
                    <>
                      Redesign <Paintbrush className="w-4 h-4" />
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
    // Visual/design mode: show recolored slide image
    // Canvas pixel remapping transforms bg/text colors while preserving images & diagrams
    if (updateMode === 'visual' && pageImages.length > 0) {
      const pageNum = slide.before.sourcePageNumber;
      const recoloredImage = pageNum ? recoloredImages[pageNum] : null;
      const originalImage = pageNum && pageNum > 0 && pageNum <= pageImages.length
        ? pageImages[pageNum - 1]
        : null;
      const displayImage = recoloredImage || originalImage;

      if (displayImage) {
        return (
          <div className="absolute inset-0">
            {/* Recolored slide image — full bleed, all content preserved */}
            <img
              src={displayImage}
              alt={slide.after.title || 'Modernized slide'}
              className="w-full h-full object-contain"
              style={{ background: generatedTheme?.backgroundColor || '#ffffff' }}
            />
            {/* Brand logo overlay */}
            {brandLogo && (
              <img
                src={brandLogo}
                alt="Brand logo"
                className="absolute pointer-events-none"
                style={{
                  bottom: '4%', right: '3%',
                  width: '8%', height: 'auto',
                  objectFit: 'contain', opacity: 0.85,
                }}
              />
            )}
          </div>
        );
      }
    }

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

  if (step === 6 && result) {
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
      setRecoloredImages({});
      setBrandLogo(null);
      setThemeQuestionnaire({});
      setIsGeneratingTheme(false);
    };

    return (
      <div className="min-h-screen bg-background text-text-primary overflow-y-auto">
        {/* Atmospheric top gradient */}
        <div className="fixed top-0 left-0 right-0 h-64 pointer-events-none" style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${result.slides[0]?.visualStyle.accentColor || '#c8956c'}15, transparent)`,
        }} />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
          {/* Header */}
          <div className="flex justify-between items-start mb-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">
                {updateMode === 'visual' ? 'Slide Modernization' : 'Course Transformation'}
              </p>
              <h2 className="text-4xl md:text-5xl font-heading font-bold text-text-primary leading-tight mb-3">
                {result.slides.length} slides redesigned
              </h2>
              <p className="text-text-muted text-sm">
                {result.metadata.sector} &middot; {result.metadata.location} &middot; {
                  result.metadata.updateMode === 'regulatory' ? 'Regulatory Update' :
                  result.metadata.updateMode === 'visual' ? 'Visual Refresh' : 'Full Modernization'
                }
              </p>
              {updateMode !== 'visual' && result.metadata.searchQueries.length > 0 && (
                <p className="text-text-muted text-xs mt-2 flex items-center gap-1">
                  <Search className="w-3 h-3" />
                  Verified via: {result.metadata.searchQueries.slice(0, 2).join(', ')}
                </p>
              )}
              {updateMode === 'visual' && generatedTheme && (
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex gap-1">
                    <div className="w-4 h-4 rounded-full" style={{ background: generatedTheme.primaryColor }} />
                    <div className="w-4 h-4 rounded-full" style={{ background: generatedTheme.secondaryColor }} />
                  </div>
                  <p className="text-text-muted text-xs">
                    {generatedTheme.fontSuggestion} &middot; {generatedTheme.designReasoning}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={resetAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-text-muted transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> {updateMode === 'visual' ? 'New design' : 'New analysis'}
            </button>
          </div>

          {/* Slides */}
          <div className="space-y-20">
            {result.slides.map((slide, idx) => (
              <div key={slide.id} className="relative">
                {/* Slide number */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{
                    background: `${slide.visualStyle.accentColor}20`,
                    color: slide.visualStyle.accentColor,
                  }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 h-px" style={{ background: `${slide.visualStyle.accentColor}15` }} />
                </div>

                {/* Before/After pair — equal-width side-by-side 16:9 slides */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-center">
                  {/* Before — 16:9 original slide thumbnail */}
                  <SlideFrame label="Original">
                    <OriginalSlide slide={slide} slideIndex={idx} />
                  </SlideFrame>

                  {/* Transform arrow */}
                  <div className="hidden md:flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                      background: `${slide.visualStyle.accentColor}15`,
                      border: `1px solid ${slide.visualStyle.accentColor}25`,
                    }}>
                      <ArrowRight className="w-4 h-4" style={{ color: slide.visualStyle.accentColor }} />
                    </div>
                  </div>
                  <div className="flex md:hidden items-center justify-center py-2">
                    <ArrowRight className="w-5 h-5 rotate-90 text-text-muted opacity-30" />
                  </div>

                  {/* After — 16:9 modernized slide */}
                  <SlideFrame label="Modernized" labelColor={slide.visualStyle.accentColor}>
                    <ModernizedSlide slide={slide} />
                  </SlideFrame>
                </div>
              </div>
            ))}
          </div>

          {/* Citations — hidden for visual-only mode (no content changes = no sources) */}
          {result.citations.length > 0 && updateMode !== 'visual' && (
            <div className="mt-20 pt-10" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted mb-6 flex items-center gap-2">
                <ExternalLink className="w-3 h-3" /> Verified Sources
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.citations.map((citation) => (
                  <a
                    key={citation.id}
                    href={citation.url !== '#' && citation.url.startsWith('https://') ? citation.url : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 p-4 rounded-xl transition-all"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 bg-accent text-white">
                      {citation.id}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                        {citation.title}
                      </p>
                      {citation.snippet && (
                        <p className="text-text-muted text-xs mt-1 line-clamp-1">{citation.snippet}</p>
                      )}
                    </div>
                    {citation.url !== '#' && citation.url.startsWith('https://') && (
                      <ExternalLink className="w-3 h-3 text-text-muted group-hover:text-accent shrink-0 mt-1" />
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-20 mb-12 text-center">
            <div className="inline-block px-12 py-10 rounded-2xl relative overflow-hidden" style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at center, rgba(200,149,108,0.06), transparent 70%)',
              }} />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">Full Platform</p>
                <h3 className="text-2xl font-heading font-bold text-text-primary mb-2">
                  Ready for the complete transformation?
                </h3>
                <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
                  Analyze entire libraries. Generate quizzes. Export to SCORM/xAPI.
                </p>
                <button className="px-8 py-3 rounded-full font-bold text-sm text-white transition-all transform hover:scale-105" style={{
                  background: 'linear-gradient(135deg, #c8956c, #a87550)',
                  boxShadow: '0 8px 30px rgba(200,149,108,0.25)',
                }}>
                  Unlock Full Access
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback / Loading
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );
};

export default DemoFlow;
