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
  Check
} from 'lucide-react';
import {
  inferSectorFromContent,
  generateDemoSlidesEnhanced,
  scanCourseFindings
} from '../services/geminiService';
import { processFileForUpload } from '../services/supabaseClient';
import { useGoogleDrivePicker } from '../hooks/useGoogleDrivePicker';
import GoogleDriveButton from './GoogleDriveButton';
import {
  UpdateMode,
  InferredSector,
  DemoResult,
  IngestedFile,
  FileUploadProgress,
  CourseFinding,
  FindingsScanResult
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
  { id: 'modern', label: 'Modern Professional', description: 'Clean lines, bold typography' },
  { id: 'playful', label: 'Playful & Gamified', description: 'Engaging, interactive feel' },
  { id: 'minimal', label: 'Minimalist Tech', description: 'Simple, focused, elegant' },
  { id: 'academic', label: 'Academic & Formal', description: 'Traditional, authoritative' }
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

  // Progressive analysis phases
  const [analysisPhase, setAnalysisPhase] = useState(0);
  // Phase 0: idle, 1: reading files, 2: identifying sector, 3: mapping topics, 4: done

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

  // Google Drive Picker
  const handleDriveFiles = useCallback(async (driveFiles: File[]) => {
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    for (const file of driveFiles) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds 50MB limit.`);
        continue;
      }
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
  }, [topic]);

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

    for (const file of Array.from(uploadedFiles)) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds 50MB limit.`);
        continue;
      }

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

    // Phase 1 → 2 transition: brief pause to show file detection
    await new Promise(r => setTimeout(r, 800));
    setAnalysisPhase(2); // Identifying sector

    try {
      const result = await inferSectorFromContent(topic, files);

      // Phase 3: mapping topics (brief reveal pause)
      setAnalysisPhase(3);
      await new Promise(r => setTimeout(r, 600));

      setInferredSector(result);
      setSelectedSector(result.sector);

      // Phase 4: done
      setAnalysisPhase(4);
      await new Promise(r => setTimeout(r, 400));
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
    setFindingsPhase(1); // Reading course materials

    await new Promise(r => setTimeout(r, 800));
    setFindingsPhase(2); // Researching current standards

    try {
      const scanResult = await scanCourseFindings(
        topic,
        selectedSector,
        location || 'United States',
        updateMode,
        files
      );

      setFindingsPhase(3); // Identifying update opportunities
      await new Promise(r => setTimeout(r, 600));

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

      setFindingsPhase(4); // Done
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.error('Findings scan error:', err);
      setError('Could not scan course. You can retry or skip to generate directly.');
      setFindingsPhase(0);
    } finally {
      setIsScanningFindings(false);
    }
  }, [topic, selectedSector, location, updateMode, files]);

  // Trigger findings scan when entering step 4
  useEffect(() => {
    if (step === 4 && !findingsScanResult && !isScanningFindings) {
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
    } catch (err) {
      console.error('Generation error:', err);
      setError('Failed to generate slides. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Navigation helpers
  const canProceed = (): boolean => {
    switch (step) {
      case 1: return updateMode !== null;
      case 2: return topic.trim().length > 0 || files.length > 0;
      case 3: return selectedSector.length > 0;
      case 4: return findingsPhase === 4 && (findingsReviewComplete || findings.length === 0);
      case 5: return true; // Style selection
      default: return false;
    }
  };

  const nextStep = () => {
    if (!canProceed()) return;

    if (step === 4) {
      // After findings review: skip style for regulatory-only, go to style for visual/full
      if (updateMode === 'regulatory') {
        handleGenerate();
      } else {
        setStep(5);
      }
    } else if (step === 5) {
      handleGenerate();
    } else {
      setStep(s => s + 1);
    }
  };

  const prevStep = () => {
    if (step === 1) {
      onBack();
    } else {
      if (step === 3) {
        // Reset analysis state when going back from step 3
        setAnalysisPhase(0);
        setInferredSector(null);
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
  const totalSteps = updateMode === 'regulatory' ? 4 : 5;
  const currentProgress = Math.min(step, totalSteps);

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
            Add documents or describe your topic. We'll analyze them next.
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
                className="flex-1 bg-accent text-background py-4 rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                Analyze <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- STEP 3: Confirm Sector & Location ---
  if (step === 3) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg bg-card p-8 rounded-3xl shadow-xl border border-surface-border">
          {renderProgressBar()}
          <h2 className="text-2xl font-bold text-center mb-2">
            {isInferring ? 'Analyzing your content' : 'Confirm details'}
          </h2>
          <p className="text-text-muted text-center mb-8">
            {isInferring ? 'Identifying industry and relevant regulations...' : 'We\'ve analyzed your content. Verify we got it right.'}
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

              {/* Phase 2: Sector identification */}
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
                <Brain className="w-5 h-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {analysisPhase > 2 ? 'Industry identified' : 'Identifying industry...'}
                  </p>
                  {analysisPhase > 2 && inferredSector && (
                    <p className="text-xs text-success mt-0.5 animate-in fade-in duration-300">
                      {inferredSector.sector} ({inferredSector.confidence} confidence)
                    </p>
                  )}
                </div>
              </div>

              {/* Phase 3: Topic mapping */}
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
                <Tag className="w-5 h-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {analysisPhase > 3 ? 'Key topics mapped' : 'Mapping key topics...'}
                  </p>
                  {analysisPhase > 3 && inferredSector?.detectedTopics && inferredSector.detectedTopics.length > 0 && (
                    <p className="text-xs text-text-muted mt-0.5 animate-in fade-in duration-300">
                      {inferredSector.detectedTopics.slice(0, 5).join(' · ')}
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
                          : `Detected: ${inferredSector.sector} (${inferredSector.confidence} confidence)`
                        }
                      </p>
                      <p className="text-text-muted mt-1">{inferredSector.reasoning}</p>
                      {inferredSector.detectedTopics && inferredSector.detectedTopics.length > 0 && (
                        <p className="text-text-muted mt-1 text-xs">
                          Topics found: {inferredSector.detectedTopics.join(', ')}
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

                {inferredSector?.alternatives && inferredSector.alternatives.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs text-text-muted">Also consider:</span>
                    {inferredSector.alternatives.map(alt => (
                      <button
                        key={alt}
                        onClick={() => setSelectedSector(alt)}
                        className="text-xs px-2 py-1 rounded-full bg-surface text-text-muted hover:bg-surface transition-colors"
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
            // Scanning animation
            <>
              <h2 className="text-2xl font-bold text-center mb-2">Scanning your course</h2>
              <p className="text-text-muted text-center mb-8">
                Finding opportunities to improve your materials...
              </p>
              <div className="space-y-4 py-4">
                <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                  findingsPhase >= 1 ? 'bg-surface border-surface-border opacity-100' : 'opacity-0'
                }`}>
                  {findingsPhase > 1 ? (
                    <Check className="w-5 h-5 text-success shrink-0" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                  )}
                  <FileText className="w-5 h-5 text-accent shrink-0" />
                  <p className="text-sm font-medium text-text-primary">Reading course materials...</p>
                </div>

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
                  <Search className="w-5 h-5 text-accent shrink-0" />
                  <p className="text-sm font-medium text-text-primary">Researching current standards...</p>
                </div>

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
                  <Sparkles className="w-5 h-5 text-accent shrink-0" />
                  <p className="text-sm font-medium text-text-primary">Identifying update opportunities...</p>
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
                  <Check className="w-4 h-4" /> Include
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
                  <p className="text-sm font-semibold text-text-primary mb-1">46+ more findings available</p>
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

          ) : findingsPhase === 4 && !hasFindings ? (
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

  // --- STEP 5: Style Selection (Visual/Full only) ---
  if (step === 5) {
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

  // --- STEP 6: Results - Before/After Split View ---
  if (step === 6 && result) {
    return (
      <div className="min-h-screen bg-background text-text-primary p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-start mb-10 pt-4">
            <div>
              <h2 className="text-3xl font-bold">Your Course Transformation</h2>
              <p className="text-text-muted mt-1">
                {result.metadata.sector} • {result.metadata.location} • {
                  result.metadata.updateMode === 'regulatory' ? 'Regulatory Update' :
                  result.metadata.updateMode === 'visual' ? 'Visual Update' : 'Full Refresh'
                }
              </p>
              {result.metadata.searchQueries.length > 0 && (
                <p className="text-text-muted text-sm mt-2">
                  <Search className="w-3 h-3 inline mr-1" />
                  Searched: {result.metadata.searchQueries.slice(0, 2).join(', ')}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
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
                  setFindings([]);
                  setFindingsScanResult(null);
                  setFindingsPhase(0);
                  setApprovedFindingIds(new Set());
                  setUserContext('');
                  setDesignQuestions({});
                  setCurrentFindingIndex(0);
                  setFindingsReviewComplete(false);
                }}
                className="bg-surface hover:bg-card text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Start Over
              </button>
            </div>
          </div>

          {/* Slides Grid */}
          <div className="space-y-8">
            {result.slides.map((slide, idx) => (
              <div
                key={slide.id}
                className="bg-card rounded-2xl overflow-hidden shadow-2xl border border-surface-border"
              >
                {/* Slide Header */}
                <div
                  className="px-6 py-4 flex items-center justify-between"
                  style={{ backgroundColor: slide.visualStyle.accentColor }}
                >
                  <span className="text-white font-bold">Slide {idx + 1}</span>
                  <span className="text-white/70 text-sm">{slide.changesSummary}</span>
                </div>

                {/* Before / After Split */}
                <div className="grid grid-cols-1 md:grid-cols-2">
                  {/* BEFORE */}
                  <div className="p-8 bg-surface border-r border-surface-border">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-3 py-1 bg-surface-border text-text-primary rounded-full text-xs font-bold uppercase">
                        Before
                      </span>
                      <span className="text-text-muted text-xs">Original Content</span>
                    </div>
                    <h3 className="text-lg font-bold text-text-primary mb-4 opacity-70">
                      {slide.before.title}
                    </h3>
                    <ul className="space-y-3">
                      {slide.before.bullets.map((bullet, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-text-muted"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-text-muted mt-2 shrink-0" />
                          <span className="line-through opacity-60">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* AFTER */}
                  <div className="p-8 bg-card">
                    <div className="flex items-center gap-2 mb-4">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold uppercase text-white"
                        style={{ backgroundColor: slide.visualStyle.accentColor }}
                      >
                        After
                      </span>
                      <span className="text-text-muted text-xs">Updated Content</span>
                    </div>
                    <h3
                      className="text-lg font-bold mb-4"
                      style={{ color: slide.visualStyle.accentColor }}
                    >
                      {slide.after.title}
                    </h3>
                    <ul className="space-y-3">
                      {slide.after.bullets.map((bullet, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-text-primary"
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                            style={{ backgroundColor: slide.visualStyle.accentColor }}
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Citations Panel */}
          {result.citations.length > 0 && (
            <div className="mt-12 bg-card rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-accent" />
                Sources & Citations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.citations.map((citation) => (
                  <a
                    key={citation.id}
                    href={citation.url !== '#' && citation.url.startsWith('https://') ? citation.url : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-start gap-3 p-4 bg-surface rounded-xl transition-colors group ${
                      citation.url !== '#' && citation.url.startsWith('https://') ? 'hover:bg-card cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span className="flex items-center justify-center w-6 h-6 bg-accent text-white rounded-full text-xs font-bold shrink-0">
                      {citation.id}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white group-hover:text-accent transition-colors truncate">
                        {citation.title}
                      </p>
                      {citation.snippet && (
                        <p className="text-text-muted text-sm mt-1 line-clamp-2">
                          {citation.snippet}
                        </p>
                      )}
                      <p className="text-text-muted text-xs mt-1">
                        Accessed {citation.accessedDate}
                      </p>
                    </div>
                    {citation.url !== '#' && citation.url.startsWith('https://') && (
                      <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-accent shrink-0" />
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-16 text-center max-w-2xl mx-auto pb-12">
            <h3 className="text-2xl font-bold mb-4">Ready for the full transformation?</h3>
            <p className="text-text-muted mb-8">
              This was just a preview. CourseCorrect can analyze entire course libraries,
              generate interactive quizzes, and export to SCORM/xAPI packages.
            </p>
            <button className="bg-accent hover:bg-accent/90 text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg shadow-accent/25 transition-all transform hover:scale-105">
              Unlock Full Access — $49/mo
            </button>
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
