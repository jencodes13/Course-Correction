import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Download, Zap, FileWarning } from 'lucide-react';
import { useWorkflow } from '../contexts/WorkflowContext';

const ExportView: React.FC = () => {
  const { projectName } = useWorkflow();
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="max-w-3xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Success Header */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-success/20">
            <CheckCircle className="w-10 h-10 text-success" />
        </div>
        <h2 className="text-3xl font-bold text-text-primary mb-2">Ready for Deployment</h2>
        <p className="text-text-muted text-lg">
            "{projectName}" has been processed and is ready for export.
        </p>
      </div>

      {/* Disclaimer Section */}
      <div className="bg-card border border-surface-border rounded-2xl p-8 mb-10 shadow-sm relative overflow-hidden">
        {/* Decorative background icon */}
        <FileWarning className="absolute -top-4 -right-4 w-24 h-24 text-text-muted/10 rotate-12 pointer-events-none" />

        <div className="flex items-start gap-3 mb-4 relative z-10">
            <div className="p-2 bg-accent/10 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-base font-bold text-text-primary uppercase tracking-wide pt-1">
                Compliance & Liability Waiver
            </h3>
        </div>

        <div className="text-xs text-text-muted space-y-4 leading-relaxed border-l-4 border-accent/30 pl-4 mb-8 relative z-10">
            <p>
                While Course Correction utilizes advanced AI and real-time search to aim for the most up-to-date regulatory information, specific codes (e.g., NEC, OSHA, Building Codes) and compliance requirements vary significantly by local jurisdiction and are subject to frequent change.
            </p>
            <p className="font-bold text-text-primary">
                Course Correction is an assistive tool for Subject Matter Experts. We are not liable for any out-of-date code violations, outdated information, or compliance failures resulting from the use of these materials.
            </p>
            <p>
                By downloading, you agree that you aim to provide the most real-time information, but you, the user, assume full and sole responsibility for ensuring all facts, citations, and regulatory interpretations are correct and compliant with your specific local Authority Having Jurisdiction (AHJ) before disseminating this course.
            </p>
        </div>

        <label className="flex items-start gap-4 cursor-pointer group relative z-10 bg-surface p-4 rounded-xl border border-surface-border hover:border-accent/30 transition-colors shadow-sm">
            <div className="relative flex items-center pt-1">
                <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="w-5 h-5 border-2 border-surface-border rounded text-accent focus:ring-accent transition-all cursor-pointer"
                />
            </div>
            <span className="text-sm text-text-muted font-medium select-none group-hover:text-text-primary">
                I acknowledge that I have verified the accuracy of this content with a qualified professional and accept full responsibility for its deployment.
            </span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-center gap-4">
         <button
            disabled={!agreed}
            onClick={() => alert("Downloading SCORM package...")}
            className={`px-8 py-4 border border-surface-border text-text-muted font-bold rounded-xl flex items-center justify-center gap-3 transition-all ${!agreed ? 'opacity-50 cursor-not-allowed bg-surface' : 'hover:bg-surface bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5'}`}
         >
            <Download className="w-5 h-5" />
            Download SCORM 1.2
         </button>
         <button
            disabled={!agreed}
            onClick={() => alert("Exporting to xAPI...")}
            className={`px-8 py-4 text-background font-bold rounded-xl flex items-center justify-center gap-3 transition-all ${!agreed ? 'opacity-50 cursor-not-allowed bg-text-muted' : 'bg-accent hover:bg-accent/90 shadow-lg shadow-accent/30 hover:-translate-y-0.5'}`}
         >
            <Zap className="w-5 h-5" />
            Export to xAPI
         </button>
      </div>
    </div>
  );
};

export default ExportView;
