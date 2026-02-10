import React from 'react';
import {
  FileText, Zap, UploadCloud, LogOut, Sliders, Mic, FolderOpen, Brain,
  FileCheck, ShieldAlert, BookOpen, Presentation, HelpCircle, Palette,
} from 'lucide-react';
import { AppStep } from '../types';
import { useWorkflow } from '../contexts/WorkflowContext';
import { signOut } from '../services/supabaseClient';

// Result tab definitions keyed by update mode
const REGULATORY_TABS = [
  { id: 'redline', label: 'Redline View', icon: FileText },
  { id: 'report', label: 'Change Report', icon: FileCheck },
  { id: 'fact-check', label: 'Fact Check', icon: ShieldAlert },
];

const VISUAL_TABS = [
  { id: 'slides', label: 'Slide Deck', icon: Presentation },
  { id: 'study-guide', label: 'Study Guide', icon: BookOpen },
  { id: 'quiz', label: 'Quiz Module', icon: HelpCircle },
];

const Sidebar: React.FC = () => {
  const {
    currentStep, goToStep, projectName, resetProject, setUser, user,
    agentResultsReady, agentUpdateMode, activeResultTab, setActiveResultTab,
  } = useWorkflow();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Even if signOut fails, reset local state
    }
    setUser(null);
    resetProject();
  };

  const menuItems = [
    { id: AppStep.DASHBOARD, label: 'My Courses', icon: FolderOpen },
    { id: AppStep.INGESTION, label: 'Project Files', icon: UploadCloud },
    { id: AppStep.CONFIGURATION, label: 'Configuration', icon: Sliders },
    { id: AppStep.AGENT_FLOW, label: 'AI Analysis', icon: Brain },
    { id: AppStep.EXPORT, label: 'Export Package', icon: Zap },
  ];

  // Determine which result tabs to show
  const showResultTabs = agentResultsReady && currentStep === AppStep.AGENT_FLOW;
  const regulatoryTabs = (agentUpdateMode === 'regulatory' || agentUpdateMode === 'full') ? REGULATORY_TABS : [];
  const visualTabs = (agentUpdateMode === 'visual' || agentUpdateMode === 'full') ? VISUAL_TABS : [];

  return (
    <div className="fixed left-3 top-3 bottom-3 w-48 rounded-2xl bg-card/90 backdrop-blur-xl border border-surface-border/60 shadow-2xl z-20 flex flex-col overflow-hidden">
      {/* Logo header */}
      <div className="px-5 pt-5 pb-4">
        <button onClick={() => goToStep(AppStep.LANDING)} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 flex items-center justify-center">
            <img src="/logo-cropped.png" alt="Course Correction" width={28} height={28} style={{ objectFit: 'contain' }} />
          </div>
          <div className="text-left">
            <span className="text-sm font-bold text-text-primary tracking-tight block leading-none">Course Correction</span>
            <span className="text-[9px] uppercase tracking-wider text-accent font-semibold">Beta</span>
          </div>
        </button>
      </div>

      {/* Active project badge */}
      {projectName && (
        <div className="mx-3 mb-3 px-3 py-2.5 bg-surface/60 rounded-xl border border-surface-border/40">
          <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold mb-0.5">Active Project</p>
          <p className="text-xs font-medium text-text-primary truncate" title={projectName}>{projectName}</p>
        </div>
      )}

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 space-y-0.5">
        {menuItems.map((item) => {
          const isActive = currentStep === item.id;
          const isDisabled = !projectName && item.id !== AppStep.INGESTION && item.id !== AppStep.DASHBOARD;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && goToStep(item.id)}
              disabled={isDisabled}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : isDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-surface/60 hover:text-text-primary'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-accent rounded-r-full" />
              )}
              <item.icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-primary'}`} />
              <span className={`text-[13px] font-medium ${isActive ? 'text-text-primary' : ''}`}>{item.label}</span>
            </button>
          );
        })}

        {/* Result / Deliverable tabs */}
        {showResultTabs && (regulatoryTabs.length > 0 || visualTabs.length > 0) && (
          <>
            <div className="pt-3 pb-1.5 px-3">
              <div className="h-px bg-surface-border/40 mb-3" />
              <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">Deliverables</p>
            </div>

            {/* Regulatory section label for full mode */}
            {agentUpdateMode === 'full' && regulatoryTabs.length > 0 && (
              <div className="px-3 pt-1 pb-0.5">
                <p className="text-[9px] uppercase tracking-wider text-text-muted/60 font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-2.5 h-2.5" /> Regulatory
                </p>
              </div>
            )}

            {regulatoryTabs.map((tab) => {
              const isActive = activeResultTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveResultTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'hover:bg-surface/60 hover:text-text-primary text-text-muted'
                  }`}
                >
                  <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-primary'}`} />
                  <span className={`text-[12px] font-medium ${isActive ? 'text-text-primary' : ''}`}>{tab.label}</span>
                </button>
              );
            })}

            {/* Visual section label for full mode */}
            {agentUpdateMode === 'full' && visualTabs.length > 0 && (
              <div className="px-3 pt-2 pb-0.5">
                <p className="text-[9px] uppercase tracking-wider text-text-muted/60 font-semibold flex items-center gap-1.5">
                  <Palette className="w-2.5 h-2.5" /> Design
                </p>
              </div>
            )}

            {visualTabs.map((tab) => {
              const isActive = activeResultTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveResultTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'hover:bg-surface/60 hover:text-text-primary text-text-muted'
                  }`}
                >
                  <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-primary'}`} />
                  <span className={`text-[12px] font-medium ${isActive ? 'text-text-primary' : ''}`}>{tab.label}</span>
                </button>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-0.5">
        <div className="h-px bg-surface-border/40 mb-2" />
        <button
          disabled
          className="flex items-center gap-2.5 px-3 py-2 text-[12px] font-bold bg-surface/40 text-text-muted w-full rounded-xl cursor-not-allowed opacity-50"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Voice Consultant</span>
          <span className="ml-auto text-[8px] uppercase tracking-wider font-semibold">Soon</span>
        </button>
        {user && (
          <div className="px-3 py-1.5">
            <p className="text-[11px] text-text-muted truncate" title={user.email}>{user.email}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-text-muted hover:text-warning w-full hover:bg-surface/40 rounded-xl transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
