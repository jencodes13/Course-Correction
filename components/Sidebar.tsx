import React from 'react';
import { LayoutDashboard, FileText, Zap, Paintbrush, UploadCloud, Settings, LogOut, Sliders, Mic, FolderOpen } from 'lucide-react';
import { AppStep } from '../types';
import { useWorkflow } from '../contexts/WorkflowContext';
import { signOut } from '../services/supabaseClient';

const Sidebar: React.FC = () => {
  const { currentStep, goToStep, projectName, resetProject, setUser, setIsLiveActive, user } = useWorkflow();

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
    { id: AppStep.DIAGNOSIS, label: 'Diagnosis', icon: LayoutDashboard },
    { id: AppStep.REGULATORY, label: 'Regulatory Hound', icon: FileText },
    { id: AppStep.VISUAL, label: 'Visual Alchemist', icon: Paintbrush },
    { id: AppStep.EXPORT, label: 'Export Package', icon: Zap },
  ];

  return (
    <div className="w-64 bg-card text-text-muted flex flex-col h-screen fixed left-0 top-0 border-r border-surface-border flex-shrink-0 z-20">
      <div className="p-6 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src="/logo-cropped.png" alt="Course Correction" width={36} height={36} style={{ objectFit: 'contain' }} />
          </div>
          <div>
            <span className="text-lg font-bold text-text-primary tracking-tight block leading-none">Course Correction</span>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Enterprise Edition</span>
          </div>
        </div>
      </div>

      {projectName && (
        <div className="px-6 py-4 bg-surface border-b border-surface-border">
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Active Project</p>
            <p className="text-sm font-medium text-text-primary truncate" title={projectName}>{projectName}</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = currentStep === item.id;
          const isDisabled = !projectName && item.id !== AppStep.INGESTION && item.id !== AppStep.DASHBOARD;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && goToStep(item.id)}
              disabled={isDisabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : isDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-surface hover:text-text-primary'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full" />
              )}
              <item.icon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-primary'}`} />
              <span className={`text-sm font-medium ${isActive ? 'text-text-primary' : ''}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-surface-border space-y-1">
        <button
            onClick={() => setIsLiveActive(true)}
            className="flex items-center gap-3 px-3 py-3 text-sm text-background font-bold bg-success hover:bg-success/90 w-full rounded-lg transition-all shadow-lg shadow-success/20 mb-2"
        >
          <Mic className="w-4 h-4" />
          <span>Voice Consultant</span>
        </button>
        {user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-text-muted truncate" title={user.email}>{user.email}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 text-sm text-text-muted hover:text-warning w-full hover:bg-surface rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
