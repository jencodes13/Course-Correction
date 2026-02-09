import React, { useEffect, useRef } from 'react';
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
import CourseDashboard from './components/CourseDashboard';
import UsageWidget from './components/UsageWidget';
import UsageDashboard from './components/UsageDashboard';
import { AppStep } from './types';
import { analyzeCourseContent } from './services/geminiService';
import { ChevronRight, Home } from 'lucide-react';
import { WorkflowProvider, useWorkflow } from './contexts/WorkflowContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthGate from './components/AuthGate';

const AppInner: React.FC = () => {
  const {
    currentStep,
    goToStep,
    projectName,
    setProjectName,
    rawContent,
    setRawContent,
    files,
    setFiles,
    projectConfig,
    setProjectConfig,
    analysis,
    setAnalysis,
    isProcessing,
    setIsProcessing,
    isLiveActive,
    setIsLiveActive,
    isUsageDashboardOpen,
    setIsUsageDashboardOpen,
    resetProject,
    user,
  } = useWorkflow();

  // OAuth redirect: if user is logged in and on LANDING, redirect to DASHBOARD
  const hasRedirected = useRef(false);
  useEffect(() => {
    if (user && currentStep === AppStep.LANDING && !hasRedirected.current) {
      hasRedirected.current = true;
      goToStep(AppStep.DASHBOARD);
    }
  }, [user, currentStep, goToStep]);

  // Step 2: User configures goals, then we run analysis
  const handleConfiguration = async (config: Parameters<typeof analyzeCourseContent>[2] & { goal: string; targetAudience: string; standardsContext: string; location: string }) => {
    setProjectConfig(config);
    setIsProcessing(true);
    // Uses gemini-3-pro-preview for multimodal analysis
    const result = await analyzeCourseContent(rawContent, files, config);
    setAnalysis(result);
    setIsProcessing(false);
    goToStep(AppStep.DIAGNOSIS);
  };

  const renderContent = () => {
    switch (currentStep) {
      case AppStep.DEMO:
        return <DemoFlow onBack={() => goToStep(AppStep.LANDING)} />;
      case AppStep.DASHBOARD:
        return <CourseDashboard />;
      case AppStep.INGESTION:
        return <IngestionZone />;

      case AppStep.CONFIGURATION:
        return <ConfigurationZone onConfigure={handleConfiguration} isProcessing={isProcessing} />;

      case AppStep.DIAGNOSIS:
        return analysis ? (
          <DiagnosisDashboard />
        ) : (
          <div className="p-12 text-center text-slate-400">Analysis data missing. Please restart project.</div>
        );
      case AppStep.REGULATORY:
        return <RegulatoryView />;
      case AppStep.VISUAL:
        return <VisualView />;
      case AppStep.EXPORT:
        return <ExportView />;
      default:
        return <div>Unknown Step</div>;
    }
  };

  // Helper for Breadcrumbs
  const getBreadcrumb = () => {
    if (currentStep === AppStep.DASHBOARD) return 'My Courses';
    if (currentStep === AppStep.INGESTION) return 'New Project';
    if (currentStep === AppStep.CONFIGURATION) return 'Configuration';
    if (currentStep === AppStep.DIAGNOSIS) return 'Overview';
    if (currentStep === AppStep.REGULATORY) return 'Regulatory Update';
    if (currentStep === AppStep.VISUAL) return 'Visual Update';
    return 'Export';
  }

  // If on landing page, show full screen landing
  if (currentStep === AppStep.LANDING) {
    return (
      <>
        <LandingPage onStart={() => goToStep(AppStep.DEMO)} onSignIn={() => goToStep(AppStep.DASHBOARD)} />
        <UsageWidget onClick={() => setIsUsageDashboardOpen(true)} />
        {isUsageDashboardOpen && (
          <UsageDashboard onClose={() => setIsUsageDashboardOpen(false)} />
        )}
      </>
    );
  }

  // If on Demo Flow, show full screen demo (no sidebar)
  if (currentStep === AppStep.DEMO) {
      return (
        <>
          {renderContent()}
          <UsageWidget onClick={() => setIsUsageDashboardOpen(true)} />
          {isUsageDashboardOpen && (
            <UsageDashboard onClose={() => setIsUsageDashboardOpen(false)} />
          )}
        </>
      );
  }

  return (
    <AuthGate onBack={() => goToStep(AppStep.LANDING)}>
      <div className="flex min-h-screen bg-background font-sans">
        <Sidebar />

        {isLiveActive && (
            <LiveAssistant onClose={() => setIsLiveActive(false)} />
        )}

        <main className="ml-64 flex-1 h-screen overflow-y-auto relative flex flex-col">
          {/* Modern Header */}
          <header className="h-20 bg-card/80 backdrop-blur-md border-b border-surface-border sticky top-0 z-10 flex items-center justify-between px-8">
              <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
                  <div className="flex items-center gap-2 hover:text-accent transition-colors cursor-pointer" onClick={() => goToStep(AppStep.DASHBOARD)}>
                      <Home className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                  <span className={!projectName ? "text-accent font-semibold" : "text-text-primary"}>
                      {projectName || "Untitled"}
                  </span>
                  {projectName && (
                      <>
                          <ChevronRight className="w-4 h-4 text-text-muted" />
                          <span className="text-accent font-semibold bg-accent/10 px-2 py-1 rounded-md">
                              {getBreadcrumb()}
                          </span>
                      </>
                  )}
              </div>

              <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-success/10 text-success text-xs font-bold rounded-full border border-success/20 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      System Operational
                  </div>
                  <div className="w-8 h-8 rounded-full bg-card border-2 border-surface-border shadow-sm overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Felix`} alt="User" />
                  </div>
              </div>
          </header>

          <div className="flex-1 py-8 px-8">
              {renderContent()}
          </div>
        </main>

        {/* Usage Widget & Dashboard - available on all app views */}
        <UsageWidget onClick={() => setIsUsageDashboardOpen(true)} />
        {isUsageDashboardOpen && (
          <UsageDashboard onClose={() => setIsUsageDashboardOpen(false)} />
        )}
      </div>
    </AuthGate>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <WorkflowProvider>
        <AppInner />
      </WorkflowProvider>
    </ThemeProvider>
  );
};

export default App;
