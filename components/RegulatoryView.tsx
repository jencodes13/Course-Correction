import React, { useState, useEffect } from 'react';
import { performRegulatoryUpdate } from '../services/geminiService';
import { RegulatoryUpdate } from '../types';
import { Check, X, RefreshCw, FileText, Search, ShieldCheck, MapPin } from 'lucide-react';

interface RegulatoryViewProps {
  rawContent: string;
  location: string;
}

const RegulatoryView: React.FC<RegulatoryViewProps> = ({ rawContent, location }) => {
  const [updates, setUpdates] = useState<RegulatoryUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState("General Safety");
  const [acceptedUpdates, setAcceptedUpdates] = useState<Set<string>>(new Set());

  const runAnalysis = async () => {
    setLoading(true);
    // Passing location for Maps/Search grounding
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
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            Regulatory Hound
          </h2>
          <p className="text-slate-600 mt-1 flex items-center gap-2">
            Verifying against live sources. 
            {location && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1"><MapPin className="w-3 h-3"/> {location}</span>}
          </p>
        </div>
        <div className="flex gap-3">
           <input 
             type="text" 
             value={domain}
             onChange={(e) => setDomain(e.target.value)}
             className="border border-slate-300 rounded-lg px-4 py-2 text-sm w-64 focus:ring-2 focus:ring-blue-500 outline-none"
             placeholder="Context (e.g. OSHA 2024)"
           />
           <button 
             onClick={runAnalysis}
             disabled={loading}
             className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
           >
             {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
             Re-Scan
           </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6" />
          <h3 className="text-xl font-medium text-slate-700">Checking Live Regulations...</h3>
          <p className="text-slate-500 mt-2">Connecting to Google Search & Maps Grounding</p>
        </div>
      ) : updates.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm text-center">
            <p className="text-slate-500">No critical regulatory issues found for this context.</p>
         </div>
      ) : (
        <div className="grid gap-6">
          {updates.map((update, idx) => (
            <div 
              key={update.id || idx} 
              className={`bg-white rounded-xl shadow-sm border transition-all duration-300 overflow-hidden ${
                acceptedUpdates.has(update.id) ? 'border-green-500 ring-1 ring-green-500' : 'border-slate-200'
              }`}
            >
              <div className="p-1 bg-gradient-to-r from-red-50 to-white border-b border-red-100 flex items-center justify-between px-6 py-3">
                 <div className="flex items-center gap-2 text-red-700 text-xs font-bold uppercase tracking-wider">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Regulatory Mismatch
                 </div>
                 <div className="text-xs text-slate-500 font-medium truncate max-w-xs" title={update.citation}>
                    Source: {update.citation}
                 </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="p-6 bg-red-50/30 border-r border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Original Text
                  </h4>
                  <p className="text-slate-700 text-sm leading-relaxed line-through decoration-red-300 decoration-2">
                    {update.originalText}
                  </p>
                  <div className="mt-4 text-xs text-red-600 bg-red-100 p-2 rounded">
                    <strong>Why:</strong> {update.reason}
                  </div>
                </div>

                <div className="p-6 bg-green-50/30 relative">
                   <h4 className="text-xs font-semibold text-green-700 uppercase mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Proposed Update
                  </h4>
                  <p className="text-slate-800 text-sm leading-relaxed font-medium">
                    {update.updatedText}
                  </p>
                  
                  <div className="mt-6 flex justify-end">
                    {acceptedUpdates.has(update.id) ? (
                        <button 
                        onClick={() => toggleAccept(update.id)}
                        className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-200 transition-colors"
                        >
                        <Check className="w-4 h-4" /> Approved
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                                <X className="w-4 h-4" /> Ignore
                            </button>
                            <button 
                                onClick={() => toggleAccept(update.id)}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
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