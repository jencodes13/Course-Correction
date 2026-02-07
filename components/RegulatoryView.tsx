import React, { useState, useEffect } from 'react';
import { performRegulatoryUpdate } from '../services/geminiService';
import { RegulatoryUpdate } from '../types';
import { Check, X, RefreshCw, FileText, Search, ShieldCheck, MapPin } from 'lucide-react';
import { useWorkflow } from '../contexts/WorkflowContext';

const RegulatoryView: React.FC = () => {
  const { rawContent, projectConfig } = useWorkflow();
  const location = projectConfig?.location || "";

  const [updates, setUpdates] = useState<RegulatoryUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState("General Safety");
  const [acceptedUpdates, setAcceptedUpdates] = useState<Set<string>>(new Set());

  const runAnalysis = async () => {
    setLoading(true);
    const results = await performRegulatoryUpdate(rawContent, domain, location);
    setUpdates(results);
    setLoading(false);
  };

  useEffect(() => {
    runAnalysis();
  }, []);

  const toggleAccept = (id: string) => {
    const newSet = new Set(acceptedUpdates);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setAcceptedUpdates(newSet);
  };

  return (
    <div className="max-w-6xl mx-auto p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-accent" />
            Regulatory Hound
          </h2>
          <p className="text-text-muted mt-1 flex items-center gap-2">
            Verifying against live sources.
            {location && <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full flex items-center gap-1"><MapPin className="w-3 h-3"/> {location}</span>}
          </p>
        </div>
        <div className="flex gap-3">
           <input
             type="text"
             value={domain}
             onChange={(e) => setDomain(e.target.value)}
             className="bg-background border border-surface-border rounded-lg px-4 py-2 text-sm w-64 focus:ring-2 focus:ring-accent outline-none text-text-primary placeholder-text-muted"
             placeholder="Context (e.g. OSHA 2024)"
           />
           <button
             onClick={runAnalysis}
             disabled={loading}
             className="bg-accent hover:bg-accent/90 text-background px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
           >
             {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
             Re-Scan
           </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-surface-border rounded-2xl bg-surface">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-6" />
          <h3 className="text-xl font-medium text-text-primary">Checking Live Regulations...</h3>
          <p className="text-text-muted mt-2">Connecting to Google Search & Maps Grounding</p>
        </div>
      ) : updates.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center p-12 bg-card rounded-2xl shadow-sm text-center border border-surface-border">
            <p className="text-text-muted">No critical regulatory issues found for this context.</p>
         </div>
      ) : (
        <div className="grid gap-6">
          {updates.map((update, idx) => (
            <div
              key={update.id || idx}
              className={`bg-card rounded-xl shadow-sm border transition-all duration-300 overflow-hidden ${
                acceptedUpdates.has(update.id) ? 'border-success ring-1 ring-success' : 'border-surface-border'
              }`}
            >
              <div className="bg-warning/5 border-b border-warning/10 flex items-center justify-between px-6 py-3">
                 <div className="flex items-center gap-2 text-warning text-xs font-bold uppercase tracking-wider">
                    <span className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                    Regulatory Mismatch
                 </div>
                 <div className="text-xs text-text-muted font-medium truncate max-w-xs" title={update.citation}>
                    Source: {update.citation}
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="p-6 bg-warning/5 border-r border-surface-border">
                  <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Original Text
                  </h4>
                  <p className="text-text-primary text-sm leading-relaxed line-through decoration-warning/50 decoration-2">
                    {update.originalText}
                  </p>
                  <div className="mt-4 text-xs text-warning bg-warning/10 p-2 rounded">
                    <strong>Why:</strong> {update.reason}
                  </div>
                </div>

                <div className="p-6 bg-success/5 relative">
                   <h4 className="text-xs font-semibold text-success uppercase mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Proposed Update
                  </h4>
                  <p className="text-text-primary text-sm leading-relaxed font-medium">
                    {update.updatedText}
                  </p>

                  <div className="mt-6 flex justify-end">
                    {acceptedUpdates.has(update.id) ? (
                        <button
                        onClick={() => toggleAccept(update.id)}
                        className="flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-lg text-sm font-bold hover:bg-success/20 transition-colors"
                        >
                        <Check className="w-4 h-4" /> Approved
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button className="flex items-center gap-2 bg-card border border-surface-border text-text-muted px-4 py-2 rounded-lg text-sm hover:bg-surface transition-colors">
                                <X className="w-4 h-4" /> Ignore
                            </button>
                            <button
                                onClick={() => toggleAccept(update.id)}
                                className="flex items-center gap-2 bg-accent text-background px-4 py-2 rounded-lg text-sm font-bold hover:bg-accent/90 transition-colors shadow-sm"
                            >
                                <Check className="w-4 h-4" /> Accept
                            </button>
                        </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegulatoryView;
