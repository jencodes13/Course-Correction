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
        <h2 className="text-3xl font-bold text-text-primary mb-3 tracking-tight">Tailor Your Update</h2>
        <p className="text-text-muted text-lg">
          Configure the AI context for search and regulations.
        </p>
      </div>

      <div className="space-y-6">
        {/* Goal Selection */}
        <div className="bg-card p-6 rounded-2xl border border-surface-border shadow-sm">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            Primary Goal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setGoal('regulatory')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                goal === 'regulatory'
                  ? 'border-accent bg-accent/10 ring-1 ring-accent'
                  : 'border-surface-border hover:border-text-muted'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${goal === 'regulatory' ? 'bg-accent text-background' : 'bg-surface text-text-muted'}`}>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="font-semibold text-text-primary">Regulatory Only</div>
              <div className="text-xs text-text-muted mt-1">Fix facts, update codes.</div>
            </button>

            <button
              onClick={() => setGoal('visual')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                goal === 'visual'
                  ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                  : 'border-surface-border hover:border-text-muted'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${goal === 'visual' ? 'bg-amber-500 text-background' : 'bg-surface text-text-muted'}`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="font-semibold text-text-primary">Visual Boost</div>
              <div className="text-xs text-text-muted mt-1">Improve engagement.</div>
            </button>

            <button
              onClick={() => setGoal('full')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                goal === 'full'
                  ? 'border-success bg-success/10 ring-1 ring-success'
                  : 'border-surface-border hover:border-text-muted'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${goal === 'full' ? 'bg-success text-background' : 'bg-surface text-text-muted'}`}>
                <Layers className="w-4 h-4" />
              </div>
              <div className="font-semibold text-text-primary">Full Overhaul</div>
              <div className="text-xs text-text-muted mt-1">Both regs and design.</div>
            </button>
          </div>
        </div>

        {/* Context Inputs */}
        <div className="bg-card p-6 rounded-2xl border border-surface-border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Target Audience</label>
              <div className="relative">
                <Book className="absolute left-3 top-3 text-text-muted w-4 h-4" />
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Electricians"
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-surface-border rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm text-text-primary placeholder-text-muted"
                />
              </div>
           </div>

           <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Standards Context</label>
              <div className="relative">
                <ShieldAlert className="absolute left-3 top-3 text-text-muted w-4 h-4" />
                <input
                  type="text"
                  value={standardsContext}
                  onChange={(e) => setStandardsContext(e.target.value)}
                  placeholder="e.g. NEC 2023"
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-surface-border rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm text-text-primary placeholder-text-muted"
                />
              </div>
           </div>

           <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-text-primary mb-2">Location (For Maps Grounding)</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-text-muted w-4 h-4" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Austin, Texas (Finds local AHJ codes)"
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-surface-border rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm text-text-primary placeholder-text-muted"
                />
              </div>
              <p className="text-xs text-text-muted mt-2">
                  We use Google Maps data to identify the specific local authority having jurisdiction for your area.
              </p>
           </div>
        </div>

        <div className="flex justify-end pt-4">
           <button
            onClick={handleStartAnalysis}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-background shadow-lg transition-all transform hover:scale-105 ${
                isProcessing ? 'bg-text-muted cursor-not-allowed' : 'bg-accent hover:bg-accent/90 hover:shadow-xl'
            }`}
           >
             {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
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
