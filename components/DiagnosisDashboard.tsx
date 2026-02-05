import React from 'react';
import { AnalysisMetrics, AppStep } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, TrendingUp, BookOpen, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface DiagnosisDashboardProps {
  analysis: AnalysisMetrics;
  onNavigate: (step: AppStep) => void;
}

const DiagnosisDashboard: React.FC<DiagnosisDashboardProps> = ({ analysis, onNavigate }) => {
  const data = [
    { name: 'Freshness', score: analysis.freshnessScore, color: analysis.freshnessScore > 70 ? '#10b981' : '#f43f5e' },
    { name: 'Engagement', score: analysis.engagementScore, color: analysis.engagementScore > 70 ? '#10b981' : '#f59e0b' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Diagnosis Results</h2>
          <p className="text-slate-500">AI analysis complete. Review the health scores below.</p>
        </div>
        <div className="text-sm text-slate-400 font-medium">
             Analysis ID: #CC-{Math.floor(Math.random() * 10000)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Score Chart */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 col-span-1 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Course Health</h3>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fill: '#64748b', fontSize: 13, fontWeight: 500}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={40}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-600 leading-relaxed">
            "{analysis.summary}"
          </div>
        </div>

        {/* Detailed Issues */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Freshness Issues */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-rose-500" />
                Regulatory Status
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${analysis.freshnessScore < 60 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {analysis.freshnessScore}/100
              </span>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {analysis.freshnessIssues.map((issue, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-slate-700 bg-rose-50/50 p-3 rounded-lg border border-rose-100/50">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5" />
                  {issue}
                </li>
              ))}
            </ul>
            <button 
              onClick={() => onNavigate(AppStep.REGULATORY)}
              className="w-full py-3 bg-white border-2 border-slate-200 hover:border-rose-500 hover:text-rose-600 text-slate-600 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group"
            >
              Open Regulatory Hound
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Engagement Issues */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Engagement Status
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${analysis.engagementScore < 60 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {analysis.engagementScore}/100
              </span>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {analysis.engagementIssues.map((issue, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-slate-700 bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5" />
                  {issue}
                </li>
              ))}
            </ul>
             <button 
              onClick={() => onNavigate(AppStep.VISUAL)}
              className="w-full py-3 bg-white border-2 border-slate-200 hover:border-amber-500 hover:text-amber-600 text-slate-600 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group"
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
