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
import AgentFlow from './components/AgentFlow';
import ArchitecturePage from './components/ArchitecturePage';
import ExportView from './components/ExportView';
import CourseDashboard from './components/CourseDashboard';
import UsageWidget from './components/UsageWidget';
import UsageDashboard from './components/UsageDashboard';
import { AppStep } from './types';
import { analyzeCourseContent } from './services/geminiService';
import { ChevronRight, Home, Sun, Moon, Lightbulb } from 'lucide-react';
import { useTheme } from './contexts/ThemeContext';
import { WorkflowProvider, useWorkflow } from './contexts/WorkflowContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthGate from './components/AuthGate';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

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
  const { theme, toggleTheme } = useTheme();
  const isAdmin = ADMIN_EMAIL && user?.email === ADMIN_EMAIL;

  // OAuth redirect: if user is logged in and on LANDING, redirect to DASHBOARD
  const hasRedirected = useRef(false);
  useEffect(() => {
    if (user && currentStep === AppStep.LANDING && !hasRedirected.current) {
      hasRedirected.current = true;
      goToStep(AppStep.DASHBOARD);
    }
  }, [user, currentStep, goToStep]);

  // Step 2: User configures goals, save config and move to AI analysis
  const handleConfiguration = (config: Parameters<typeof analyzeCourseContent>[2] & { goal: string; targetAudience: string; standardsContext: string; location: string }) => {
    setProjectConfig(config);
    goToStep(AppStep.AGENT_FLOW);
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

      case AppStep.AGENT_FLOW:
        return (
          <AgentFlow
            files={files}
            topic={projectName}
            updateMode={(projectConfig?.goal as 'regulatory' | 'visual' | 'full') || 'full'}
            location={projectConfig?.location || ''}
            onBack={() => goToStep(AppStep.CONFIGURATION)}
            onComplete={() => goToStep(AppStep.DASHBOARD)}
          />
        );
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
      case AppStep.ARCHITECTURE:
        return <ArchitecturePage onBack={() => goToStep(AppStep.LANDING)} />;
      default:
        return <div>Unknown Step</div>;
    }
  };

  // Helper for Breadcrumbs
  const getBreadcrumb = () => {
    if (currentStep === AppStep.DASHBOARD) return 'My Courses';
    if (currentStep === AppStep.INGESTION) return 'New Project';
    if (currentStep === AppStep.CONFIGURATION) return 'Configuration';
    if (currentStep === AppStep.AGENT_FLOW) return 'AI Analysis';
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
        {/* Floating "How It Works" button */}
        <button
          onClick={() => goToStep(AppStep.ARCHITECTURE)}
          className="fixed bottom-8 left-8 z-[1000] flex items-center gap-2 px-5 py-3 rounded-full bg-card/90 backdrop-blur-xl border border-surface-border/60 shadow-lg text-text-muted hover:text-accent hover:border-accent/30 transition-all duration-200 font-heading font-medium text-sm"
        >
          <Lightbulb className="w-4 h-4" />
          How It Works
        </button>
        {isAdmin && (
          <>
            <UsageWidget onClick={() => setIsUsageDashboardOpen(true)} />
            {isUsageDashboardOpen && (
              <UsageDashboard onClose={() => setIsUsageDashboardOpen(false)} />
            )}
          </>
        )}
      </>
    );
  }

  // If on Architecture page, show full screen (no sidebar)
  if (currentStep === AppStep.ARCHITECTURE) {
    return (
      <>
        <ArchitecturePage onBack={() => goToStep(AppStep.LANDING)} />
        {isAdmin && (
          <>
            <UsageWidget onClick={() => setIsUsageDashboardOpen(true)} />
            {isUsageDashboardOpen && (
              <UsageDashboard onClose={() => setIsUsageDashboardOpen(false)} />
            )}
          </>
        )}
      </>
    );
  }

  // If on Demo Flow, show full screen demo (no sidebar) but keep logo nav
  if (currentStep === AppStep.DEMO) {
      return (
        <>
          {/* Floating logo nav */}
          <div className="fixed top-5 left-8 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-card/80 backdrop-blur-xl border border-surface-border/60 shadow-lg">
            <button onClick={() => goToStep(AppStep.LANDING)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/logo-cropped.png" alt="Course Correction" width={30} height={30} style={{ objectFit: 'contain' }} />
              <span className="text-sm font-bold text-text-primary tracking-tight">Course Correction</span>
            </button>
            <div className="w-px h-4 bg-surface-border/60" />
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>
          </div>
          {renderContent()}
          {isAdmin && (
            <>
              <UsageWidget onClick={() => setIsUsageDashboardOpen(true)} />
              {isUsageDashboardOpen && (
                <UsageDashboard onClose={() => setIsUsageDashboardOpen(false)} />
              )}
            </>
          )}
        </>
      );
  }

  return (
    <AuthGate onBack={() => goToStep(AppStep.LANDING)} onDemo={() => goToStep(AppStep.DEMO)}>
      <div className="flex min-h-screen bg-background font-sans">
        <Sidebar />

        {isLiveActive && (
            <LiveAssistant onClose={() => setIsLiveActive(false)} />
        )}

        <main className="ml-52 flex-1 h-screen overflow-y-auto relative flex flex-col">
          {/* Floating Header */}
          <header className="mx-3 mt-3 px-5 h-12 rounded-2xl bg-card/80 backdrop-blur-xl border border-surface-border/60 shadow-lg sticky top-3 z-10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                  <div className="flex items-center hover:text-accent transition-colors cursor-pointer" onClick={() => goToStep(AppStep.DASHBOARD)}>
                      <Home className="w-3.5 h-3.5" />
                  </div>
                  <ChevronRight className="w-3 h-3 text-text-muted/50" />
                  <span className={!projectName ? "text-accent font-semibold" : "text-text-primary"}>
                      {projectName || "Untitled"}
                  </span>
                  {projectName && (
                      <>
                          <ChevronRight className="w-3 h-3 text-text-muted/50" />
                          <span className="text-accent font-semibold bg-accent/10 px-1.5 py-0.5 rounded-md text-[11px]">
                              {getBreadcrumb()}
                          </span>
                      </>
                  )}
              </div>

              <div className="flex items-center gap-2.5">
                  <div className="px-2.5 py-0.5 bg-success/10 text-success text-[10px] font-bold rounded-full border border-success/20 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Online
                  </div>
                  <div className="w-7 h-7 rounded-full bg-card border-2 border-surface-border shadow-sm overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Felix`} alt="User" />
                  </div>
              </div>
          </header>

          <div className="flex-1 py-6 px-6">
              {renderContent()}
          </div>
        </main>

        {/* Usage Widget & Dashboard - admin only */}
        {isAdmin && (
          <>
            <UsageWidget onClick={() => setIsUsageDashboardOpen(true)} />
            {isUsageDashboardOpen && (
              <UsageDashboard onClose={() => setIsUsageDashboardOpen(false)} />
            )}
          </>
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
