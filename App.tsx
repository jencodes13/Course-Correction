import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import IngestionZone from './components/IngestionZone';
import ConfigurationZone from './components/ConfigurationZone';
import DiagnosisDashboard from './components/DiagnosisDashboard';
import RegulatoryView from './components/RegulatoryView';
import VisualView from './components/VisualView';
import LandingPage from './components/LandingPage';
import LiveAssistant from './components/LiveAssistant';
import DemoFlow from './components/DemoFlow';
import ExportView from './components/ExportView';
import { AppStep, AnalysisMetrics, ProjectConfig, IngestedFile } from './types';
import { analyzeCourseContent } from './services/geminiService';
import { CheckCircle, ChevronRight, Home } from 'lucide-react';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.LANDING);
  const [projectName, setProjectName] = useState<string>('');
  const [rawContent, setRawContent] = useState<string>('');
  const [files, setFiles] = useState<IngestedFile[]>([]);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisMetrics | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);

  // Step 1: User creates project and drops files
  const handleProjectCreate = (name: string, text: string, uploadedFiles: IngestedFile[]) => {
    setProjectName(name);
    setRawContent(text);
    setFiles(uploadedFiles);
    setCurrentStep(AppStep.CONFIGURATION);
  };

  // Step 2: User configures goals, then we run analysis
  const handleConfiguration = async (config: ProjectConfig) => {
    setProjectConfig(config);
    setIsProcessing(true);
    // Uses gemini-3-pro-preview for multimodal analysis
    const result = await analyzeCourseContent(rawContent, files, config);
    setAnalysis(result);
    setIsProcessing(false);
    setCurrentStep(AppStep.DIAGNOSIS);
  };

  // Sign Out / Reset
  const handleSignOut = () => {
    setProjectName('');
    setRawContent('');
    setFiles([]);
    setProjectConfig(null);
    setAnalysis(null);
    setCurrentStep(AppStep.LANDING);
  };

  const renderContent = () => {
    switch (currentStep) {
      case AppStep.DEMO:
        return <DemoFlow onBack={() => setCurrentStep(AppStep.LANDING)} />;
      case AppStep.INGESTION:
        return <IngestionZone onProjectCreate={handleProjectCreate} />;
      
      case AppStep.CONFIGURATION:
        return <ConfigurationZone onConfigure={handleConfiguration} isProcessing={isProcessing} />;
        
      case AppStep.DIAGNOSIS:
        return analysis ? (
          <DiagnosisDashboard 
            analysis={analysis} 
            onNavigate={setCurrentStep} 
          />
        ) : (
          <div className="p-12 text-center text-slate-400">Analysis data missing. Please restart project.</div>
        );
      case AppStep.REGULATORY:
        return <RegulatoryView rawContent={rawContent} location={projectConfig?.location || ""} />;
      case AppStep.VISUAL:
        return <VisualView rawContent={rawContent} />;
      case AppStep.EXPORT:
        return <ExportView projectName={projectName} />;
      default:
        return <div>Unknown Step</div>;
    }
  };

  // Helper for Breadcrumbs
  const getBreadcrumb = () => {
    if (currentStep === AppStep.INGESTION) return 'New Project';
    if (currentStep === AppStep.CONFIGURATION) return 'Configuration';
    if (currentStep === AppStep.DIAGNOSIS) return 'Overview';
    if (currentStep === AppStep.REGULATORY) return 'Regulatory Update';
    if (currentStep === AppStep.VISUAL) return 'Visual Update';
    return 'Export';
  }

  // If on landing page, show full screen landing
  if (currentStep === AppStep.LANDING) {
    return <LandingPage onStart={() => setCurrentStep(AppStep.DEMO)} />;
  }

  // If on Demo Flow, show full screen demo (no sidebar)
  if (currentStep === AppStep.DEMO) {
      return renderContent();
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar 
        currentStep={currentStep} 
        onNavigate={setCurrentStep} 
        projectName={projectName} 
        onSignOut={handleSignOut}
        onOpenLive={() => setIsLiveActive(true)}
      />
      
      {isLiveActive && (
          <LiveAssistant onClose={() => setIsLiveActive(false)} />
      )}

      <main className="ml-64 flex-1 h-screen overflow-y-auto relative flex flex-col">
        {/* Modern Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 flex items-center justify-between px-8">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <div className="flex items-center gap-2 hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => setCurrentStep(AppStep.INGESTION)}>
                    <Home className="w-4 h-4" />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
                <span className={!projectName ? "text-indigo-600 font-semibold" : ""}>
                    {projectName || "Untitled"}
                </span>
                {projectName && (
                    <>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                        <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-md">
                            {getBreadcrumb()}
                        </span>
                    </>
                )}
            </div>

            <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    System Operational
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Felix`} alt="User" />
                </div>
            </div>
        </header>
        
        <div className="flex-1 py-8 px-8">
            {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;