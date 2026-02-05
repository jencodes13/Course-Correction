import React from 'react';
import { LayoutDashboard, FileText, Zap, Paintbrush, UploadCloud, Settings, LogOut, Sliders, Mic } from 'lucide-react';
import { AppStep } from '../types';

interface SidebarProps {
  currentStep: AppStep;
  onNavigate: (step: AppStep) => void;
  projectName?: string;
  onSignOut: () => void;
  onOpenLive: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentStep, onNavigate, projectName, onSignOut, onOpenLive }) => {
  const menuItems = [
    { id: AppStep.INGESTION, label: 'Project Files', icon: UploadCloud },
    { id: AppStep.CONFIGURATION, label: 'Configuration', icon: Sliders },
    { id: AppStep.DIAGNOSIS, label: 'Diagnosis', icon: LayoutDashboard },
    { id: AppStep.REGULATORY, label: 'Regulatory Hound', icon: FileText },
    { id: AppStep.VISUAL, label: 'Visual Alchemist', icon: Paintbrush },
    { id: AppStep.EXPORT, label: 'Export Package', icon: Zap },
  ];

  return (
    <div className="w-64 bg-slate-950 text-slate-400 flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800 flex-shrink-0 z-20">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/20">
             <Zap className="text-white w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-tight block leading-none">CourseCorrect</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Enterprise Edition</span>
          </div>
        </div>
      </div>

      {projectName && (
        <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-800/50">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Active Project</p>
            <p className="text-sm font-medium text-slate-200 truncate" title={projectName}>{projectName}</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = currentStep === item.id;
          const isDisabled = !projectName && item.id !== AppStep.INGESTION;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onNavigate(item.id)}
              disabled={isDisabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                isActive 
                  ? 'bg-indigo-600/10 text-indigo-400' 
                  : isDisabled 
                    ? 'opacity-40 cursor-not-allowed' 
                    : 'hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-500 rounded-r-full" />
              )}
              <item.icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              <span className={`text-sm font-medium ${isActive ? 'text-indigo-100' : ''}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-1">
        <button 
            onClick={onOpenLive}
            className="flex items-center gap-3 px-3 py-3 text-sm text-white font-bold bg-emerald-600 hover:bg-emerald-500 w-full rounded-lg transition-all shadow-lg shadow-emerald-900/20 mb-2"
        >
          <Mic className="w-4 h-4" />
          <span>Voice Consultant</span>
        </button>
        <button 
          onClick={onSignOut}
          className="flex items-center gap-3 px-3 py-2 text-sm text-slate-500 hover:text-rose-400 w-full hover:bg-slate-900 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;