import React, { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';
import {
  inferSectorFromContent,
  generateDemoSlidesEnhanced
} from '../services/geminiService';
import {
  UpdateMode,
  InferredSector,
  DemoResult,
  IngestedFile
} from '../types';
import LocationInput from './LocationInput';

interface DemoFlowProps {
  onBack: () => void;
}

// Predefined sectors for the dropdown
const SECTORS = [
  'Healthcare',
  'Construction',
  'Manufacturing',
  'Food Service',
  'Transportation',
  'Aviation',
  'Finance',
  'Energy',
  'Legal',
  'Retail',
  'Technology',
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

  // Step 4: Style
  const [style, setStyle] = useState('modern');

  // Step 5: Results
  const [result, setResult] = useState<DemoResult | null>(null);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    Array.from(uploadedFiles).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (res: ProgressEvent<FileReader>) => {
        const newFile: IngestedFile = {
          name: file.name,
          type: file.type,
          data: res.target?.result as string
        };
        setFiles(prev => [...prev, newFile]);

        // Auto-fill topic from first file name if empty
        if (!topic) {
          setTopic(file.name.split('.')[0].replace(/[-_]/g, ' '));
        }
      };
      reader.readAsDataURL(file);
    });
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

  const inferSector = async () => {
    setIsInferring(true);
    setError(null);

    try {
      const result = await inferSectorFromContent(topic, files);
      setInferredSector(result);
      setSelectedSector(result.sector);
    } catch (err) {
      console.error('Sector inference error:', err);
      setError('Could not analyze content. Please select a sector manually.');
    } finally {
      setIsInferring(false);
    }
  };

  // Generate slides
  const handleGenerate = async () => {
    if (!updateMode || !selectedSector) return;

    setIsProcessing(true);
    setError(null);

    try {
      const demoResult = await generateDemoSlidesEnhanced(
        topic,
        selectedSector,
        location || 'United States',
        updateMode,
        style,
        files
      );
      setResult(demoResult);
      setStep(5);
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
      case 4: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (!canProceed()) return;

    // Skip style step if regulatory-only
    if (step === 3 && updateMode === 'regulatory') {
      handleGenerate();
    } else if (step === 4) {
      handleGenerate();
    } else {
      setStep(s => s + 1);
    }
  };

  const prevStep = () => {
    if (step === 1) {
      onBack();
    } else {
      setStep(s => s - 1);
    }
  };

  // Progress indicator
  const totalSteps = updateMode === 'regulatory' ? 3 : 4;
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
                      <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">
                        {file.name}
                      </span>
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
          <h2 className="text-2xl font-bold text-center mb-2">Confirm details</h2>
          <p className="text-text-muted text-center mb-8">
            We've analyzed your content. Verify we got it right.
          </p>

          {isInferring ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-4" />
              <p className="text-text-muted">Analyzing your content...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sector Selection */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">
                  Industry Sector
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
                          ? 'Multiple topics detected — please confirm the primary focus'
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
                    <option value="">Select a sector...</option>
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
                  ) : updateMode === 'regulatory' ? (
                    <>
                      Generate <Sparkles className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Next <ArrowRight className="w-4 h-4" />
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

  // --- STEP 4: Style Selection (Visual/Full only) ---
  if (step === 4) {
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

  // --- STEP 5: Results - Before/After Split View ---
  if (step === 5 && result) {
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
                    href={citation.url !== '#' ? citation.url : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-start gap-3 p-4 bg-surface rounded-xl transition-colors group ${
                      citation.url !== '#' ? 'hover:bg-card cursor-pointer' : 'cursor-default'
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
                    {citation.url !== '#' && (
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
