import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  AppStep,
  ProjectConfig,
  AnalysisMetrics,
  IngestedFile,
  RegulatoryUpdate,
  VisualTransformation,
} from '../types';

export interface User {
  id: string;
  email: string;
}

interface WorkflowState {
  currentStep: AppStep;
  projectName: string;
  rawContent: string;
  files: IngestedFile[];
  projectConfig: ProjectConfig | null;
  analysis: AnalysisMetrics | null;
  regulatoryUpdates: RegulatoryUpdate[];
  visualTransformations: VisualTransformation[];
  isProcessing: boolean;
  isLiveActive: boolean;
  isUsageDashboardOpen: boolean;
  user: User | null;
  currentProjectId: string | null;
}

interface WorkflowActions {
  goToStep: (step: AppStep) => void;
  setProjectName: (name: string) => void;
  setRawContent: (content: string) => void;
  setFiles: (files: IngestedFile[]) => void;
  addFiles: (newFiles: IngestedFile[]) => void;
  setProjectConfig: (config: ProjectConfig | null) => void;
  setAnalysis: (analysis: AnalysisMetrics | null) => void;
  setRegulatoryUpdates: (updates: RegulatoryUpdate[]) => void;
  setVisualTransformations: (transforms: VisualTransformation[]) => void;
  setIsProcessing: (val: boolean) => void;
  setIsLiveActive: (val: boolean) => void;
  setIsUsageDashboardOpen: (val: boolean) => void;
  setUser: (user: User | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  resetProject: () => void;
  clearProjectData: () => void;
}

type WorkflowContextType = WorkflowState & WorkflowActions;

const WorkflowContext = createContext<WorkflowContextType | null>(null);

export const WorkflowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.LANDING);
  const [projectName, setProjectName] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [files, setFiles] = useState<IngestedFile[]>([]);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisMetrics | null>(null);
  const [regulatoryUpdates, setRegulatoryUpdates] = useState<RegulatoryUpdate[]>([]);
  const [visualTransformations, setVisualTransformations] = useState<VisualTransformation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isUsageDashboardOpen, setIsUsageDashboardOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const goToStep = useCallback((step: AppStep) => setCurrentStep(step), []);

  const addFiles = useCallback((newFiles: IngestedFile[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const resetProject = useCallback(() => {
    setProjectName('');
    setRawContent('');
    setFiles([]);
    setProjectConfig(null);
    setAnalysis(null);
    setRegulatoryUpdates([]);
    setVisualTransformations([]);
    setCurrentProjectId(null);
    setCurrentStep(AppStep.LANDING);
  }, []);

  const clearProjectData = useCallback(() => {
    setProjectName('');
    setRawContent('');
    setFiles([]);
    setProjectConfig(null);
    setAnalysis(null);
    setRegulatoryUpdates([]);
    setVisualTransformations([]);
    setCurrentProjectId(null);
  }, []);

  const value: WorkflowContextType = {
    currentStep,
    projectName,
    rawContent,
    files,
    projectConfig,
    analysis,
    regulatoryUpdates,
    visualTransformations,
    isProcessing,
    isLiveActive,
    isUsageDashboardOpen,
    user,
    currentProjectId,
    goToStep,
    setProjectName,
    setRawContent,
    setFiles,
    addFiles,
    setProjectConfig,
    setAnalysis,
    setRegulatoryUpdates,
    setVisualTransformations,
    setIsProcessing,
    setIsLiveActive,
    setIsUsageDashboardOpen,
    setUser,
    setCurrentProjectId,
    resetProject,
    clearProjectData,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = (): WorkflowContextType => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
};
