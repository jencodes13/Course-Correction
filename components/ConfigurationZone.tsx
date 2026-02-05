import React, { useState } from 'react';
import { ProjectConfig } from '../types';
import { ShieldAlert, Sparkles, Layers, Target, Book, ArrowRight, MapPin } from 'lucide-react';

interface ConfigurationZoneProps {
  onConfigure: (config: ProjectConfig) => void;
  isProcessing: boolean;
}

const ConfigurationZone: React.FC<ConfigurationZoneProps> = ({ onConfigure, isProcessing }) => {
  const [goal, setGoal] = useState<ProjectConfig['goal']>('full');
  const [targetAudience, setTargetAudience] = useState('');
  const [standardsContext, setStandardsContext] = useState('');
  const [location, setLocation] = useState('');

  const handleStartAnalysis = () => {
    onConfigure({
      goal,
      targetAudience: targetAudience || "General Employees",
      standardsContext: standardsContext || "General Industry Standards",
      location: location || ""
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Tailor Your Update</h2>
        <p className="text-slate-500 text-lg">
          Configure the AI context for search and regulations.
        </p>
      </div>

      <div className="space-y-6">
        {/* Goal Selection */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-500" />
            Primary Goal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setGoal('regulatory')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                goal === 'regulatory' 
                  ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' 
                  : 'border-slate-100 hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${goal === 'regulatory' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="font-semibold text-slate-900">Regulatory Only</div>
              <div className="text-xs text-slate-500 mt-1">Fix facts, update codes.</div>
            </button>

            <button
              onClick={() => setGoal('visual')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                goal === 'visual' 
                  ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500' 
                  : 'border-slate-100 hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${goal === 'visual' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="font-semibold text-slate-900">Visual Boost</div>
              <div className="text-xs text-slate-500 mt-1">Improve engagement.</div>
            </button>

            <button
              onClick={() => setGoal('full')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                goal === 'full' 
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' 
                  : 'border-slate-100 hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${goal === 'full' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Layers className="w-4 h-4" />
              </div>
              <div className="font-semibold text-slate-900">Full Overhaul</div>
              <div className="text-xs text-slate-500 mt-1">Both regs and design.</div>
            </button>
          </div>
        </div>

        {/* Context Inputs */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Target Audience</label>
              <div className="relative">
                <Book className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Electricians" 
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
           </div>
           
           <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Standards Context</label>
              <div className="relative">
                <ShieldAlert className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  value={standardsContext}
                  onChange={(e) => setStandardsContext(e.target.value)}
                  placeholder="e.g. NEC 2023" 
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
           </div>

           <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Location (For Maps Grounding)</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Austin, Texas (Finds local AHJ codes)" 
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                  We use Google Maps data to identify the specific local authority having jurisdiction for your area.
              </p>
           </div>
        </div>

        <div className="flex justify-end pt-4">
           <button
            onClick={handleStartAnalysis}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all transform hover:scale-105 ${
                isProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 hover:shadow-xl'
            }`}
           >
             {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing Files...
                </>
             ) : (
                <>
                  Launch Analysis
                  <ArrowRight className="w-4 h-4" />
                </>
             )}
           </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationZone;