import React, { useState } from 'react';
import { Upload, FileType, CheckCircle, ArrowRight, FolderPlus, Image as ImageIcon, Video } from 'lucide-react';
import { IngestedFile, AppStep } from '../types';
import { useWorkflow } from '../contexts/WorkflowContext';

const DEFAULT_TEXT = `MODULE 4: ELECTRICAL SAFETY STANDARDS (2018 Revision)...`;

const IngestionZone: React.FC = () => {
  const { setProjectName: setGlobalProjectName, setRawContent, setFiles: setGlobalFiles, goToStep } = useWorkflow();

  const [dragActive, setDragActive] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [textInput, setTextInput] = useState(DEFAULT_TEXT);
  const [files, setFiles] = useState<IngestedFile[]>([]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target?.result as string;
        setFiles(prev => [...prev, {
            name: file.name,
            type: file.type,
            data: result
        }]);
        if (!projectName) setProjectName(file.name.split('.')[0]);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
        Array.from(e.dataTransfer.files).forEach(processFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          Array.from(e.target.files).forEach(processFile);
      }
  };

  const handleProjectCreate = () => {
    setGlobalProjectName(projectName || "Untitled Project");
    setRawContent(textInput);
    setGlobalFiles(files);
    goToStep(AppStep.CONFIGURATION);
  };

  return (
    <div className="max-w-3xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-text-primary mb-3 tracking-tight">Start New Project</h2>
        <p className="text-text-muted text-lg">
          Upload PDFs, images, or videos. We analyze it all.
        </p>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-surface-border overflow-hidden">
        <div className="p-8 border-b border-surface-border">
            <label className="block text-sm font-semibold text-text-primary mb-2">Project Name</label>
            <div className="relative">
                <FolderPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
                <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Site Safety Video Analysis"
                    className="w-full pl-10 pr-4 py-3 bg-background border border-surface-border rounded-xl focus:ring-2 focus:ring-accent focus:border-accent outline-none text-text-primary placeholder-text-muted transition-all"
                />
            </div>
        </div>

        <div className="p-8">
            <label className="block text-sm font-semibold text-text-primary mb-2">Source Materials</label>
            <label
                className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ease-in-out cursor-pointer group block ${
                dragActive ? 'border-accent bg-accent/5' : 'border-surface-border bg-surface hover:border-text-muted'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input type="file" multiple className="hidden" onChange={handleFileInput} accept="image/*,video/mp4,application/pdf" />
                <div className="flex flex-col items-center justify-center gap-3">
                <div className={`p-3 rounded-full transition-colors ${dragActive ? 'bg-accent/20 text-accent' : 'bg-card text-text-muted group-hover:text-text-primary shadow-sm'}`}>
                    <Upload className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm font-medium text-text-primary">Click to upload or drag and drop</p>
                    <p className="text-xs text-text-muted mt-1">Supports MP4, JPG, PNG, PDF</p>
                </div>
                </div>
            </label>

            {files.length > 0 && (
                <div className="mt-4 space-y-2">
                    {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-surface border border-surface-border rounded-lg text-sm text-text-primary">
                            {f.type.includes('image') ? <ImageIcon className="w-4 h-4 text-accent" /> :
                             f.type.includes('video') ? <Video className="w-4 h-4 text-accent" /> :
                             <FileType className="w-4 h-4 text-accent" />}
                            <span className="flex-1 truncate">{f.name}</span>
                            <CheckCircle className="w-4 h-4 text-success" />
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="p-8 bg-surface border-t border-surface-border">
             <div className="mb-4">
                <button onClick={() => setTextInput(DEFAULT_TEXT)} className="text-xs text-accent font-medium underline">
                    Add sample text context
                </button>
             </div>

            <div className="flex justify-end">
                <button
                    onClick={handleProjectCreate}
                    disabled={!projectName.trim()}
                    className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-background shadow-lg shadow-accent/20 transition-all transform ${
                        !projectName.trim()
                        ? 'bg-text-muted cursor-not-allowed'
                        : 'bg-accent hover:bg-accent/90 hover:-translate-y-0.5'
                    }`}
                >
                    Next: Configure
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default IngestionZone;
