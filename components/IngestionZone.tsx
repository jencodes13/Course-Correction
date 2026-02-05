import React, { useState } from 'react';
import { Upload, FileType, CheckCircle, ArrowRight, FolderPlus, Image as ImageIcon, Video } from 'lucide-react';
import { IngestedFile } from '../types';

interface IngestionZoneProps {
  onProjectCreate: (name: string, rawText: string, files: IngestedFile[]) => void;
}

const DEFAULT_TEXT = `MODULE 4: ELECTRICAL SAFETY STANDARDS (2018 Revision)...`;

const IngestionZone: React.FC<IngestionZoneProps> = ({ onProjectCreate }) => {
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

  return (
    <div className="max-w-3xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Start New Project</h2>
        <p className="text-slate-500 text-lg">
          Upload PDFs, images, or videos. We analyze it all.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Project Name</label>
            <div className="relative">
                <FolderPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                    type="text" 
                    value={projectName} 
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Site Safety Video Analysis"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-900 placeholder-slate-400 transition-all"
                />
            </div>
        </div>

        <div className="p-8">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Source Materials</label>
            <label 
                className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ease-in-out cursor-pointer group block ${
                dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input type="file" multiple className="hidden" onChange={handleFileInput} accept="image/*,video/mp4,application/pdf" />
                <div className="flex flex-col items-center justify-center gap-3">
                <div className={`p-3 rounded-full transition-colors ${dragActive ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-slate-400 group-hover:text-slate-600 shadow-sm'}`}>
                    <Upload className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-400 mt-1">Supports MP4, JPG, PNG, PDF</p>
                </div>
                </div>
            </label>

            {files.length > 0 && (
                <div className="mt-4 space-y-2">
                    {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700">
                            {f.type.includes('image') ? <ImageIcon className="w-4 h-4 text-pink-500" /> : 
                             f.type.includes('video') ? <Video className="w-4 h-4 text-blue-500" /> :
                             <FileType className="w-4 h-4 text-indigo-500" />}
                            <span className="flex-1 truncate">{f.name}</span>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100">
             <div className="mb-4">
                <button onClick={() => setTextInput(DEFAULT_TEXT)} className="text-xs text-indigo-600 font-medium underline">
                    Add sample text context
                </button>
             </div>

            <div className="flex justify-end">
                <button
                    onClick={() => onProjectCreate(projectName || "Untitled Project", textInput, files)}
                    disabled={!projectName.trim()}
                    className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/20 transition-all transform ${
                        !projectName.trim() 
                        ? 'bg-slate-300 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'
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