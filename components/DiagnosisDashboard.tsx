import React from 'react';
import { AppStep } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, TrendingUp, BookOpen, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useWorkflow } from '../contexts/WorkflowContext';

const DiagnosisDashboard: React.FC = () => {
  const { analysis, goToStep } = useWorkflow();

  if (!analysis) return null;

  const data = [
    { name: 'Freshness', score: analysis.freshnessScore, color: analysis.freshnessScore > 70 ? '#6abf8a' : '#c27056' },
    { name: 'Engagement', score: analysis.engagementScore, color: analysis.engagementScore > 70 ? '#6abf8a' : '#c8956c' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Diagnosis Results</h2>
          <p className="text-text-muted">AI analysis complete. Review the health scores below.</p>
        </div>
        <div className="text-sm text-text-muted font-medium">
             Analysis ID: #CC-{Math.floor(Math.random() * 10000)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Score Chart */}
        <div className="bg-card p-8 rounded-2xl shadow-sm border border-surface-border col-span-1 flex flex-col">
          <h3 className="text-lg font-bold text-text-primary mb-6">Course Health</h3>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,248,230,0.08)" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fill: 'rgba(245,240,224,0.5)', fontSize: 13, fontWeight: 500}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', background: '#1a1914', color: '#f5f0e0'}} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={40}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 p-4 bg-surface border border-surface-border rounded-xl text-sm text-text-muted leading-relaxed">
            "{analysis.summary}"
          </div>
        </div>

        {/* Detailed Issues */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Freshness Issues */}
          <div className="bg-card p-6 rounded-2xl shadow-sm border border-surface-border hover:border-warning/30 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-warning" />
                Regulatory Status
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${analysis.freshnessScore < 60 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                {analysis.freshnessScore}/100
              </span>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {analysis.freshnessIssues.map((issue, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-text-primary bg-warning/5 p-3 rounded-lg border border-warning/10">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-warning mt-1.5" />
                  {issue}
                </li>
              ))}
            </ul>
            <button
              onClick={() => goToStep(AppStep.REGULATORY)}
              className="w-full py-3 bg-card border-2 border-surface-border hover:border-warning hover:text-warning text-text-muted rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group"
            >
              Open Regulatory Hound
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Engagement Issues */}
          <div className="bg-card p-6 rounded-2xl shadow-sm border border-surface-border hover:border-accent/30 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Engagement Status
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${analysis.engagementScore < 60 ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'}`}>
                {analysis.engagementScore}/100
              </span>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {analysis.engagementIssues.map((issue, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-text-primary bg-accent/5 p-3 rounded-lg border border-accent/10">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-accent mt-1.5" />
                  {issue}
                </li>
              ))}
            </ul>
             <button
              onClick={() => goToStep(AppStep.VISUAL)}
              className="w-full py-3 bg-card border-2 border-surface-border hover:border-accent hover:text-accent text-text-muted rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group"
            >
              Open Visual Alchemist
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosisDashboard;
