import React, { useState, useEffect } from 'react';
import { performVisualTransformation, generateAsset } from '../services/geminiService';
import { VisualTransformation } from '../types';
import { Wand2, Image as ImageIcon, Sparkles, MonitorPlay, Palette, Download, Edit } from 'lucide-react';

interface VisualViewProps {
  rawContent: string;
}

const VisualView: React.FC<VisualViewProps> = ({ rawContent }) => {
  const [transformations, setTransformations] = useState<VisualTransformation[]>([]);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState("Modern Corporate");
  
  // Asset Studio State
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [assetPrompt, setAssetPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    performVisualTransformation(rawContent, theme).then(res => {
        setTransformations(res);
        setLoading(false);
    });
  }, []);

  const handleGenerateAsset = async () => {
    if (!assetPrompt) return;
    setIsGenerating(true);
    // Use gemini-2.5-flash-image
    const b64 = await generateAsset(assetPrompt, generatedImage || undefined);
    if (b64) setGeneratedImage(b64);
    setIsGenerating(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Wand2 className="w-8 h-8 text-amber-500" />
            Visual Alchemist
          </h2>
          <p className="text-slate-600 mt-1">
            Generative Design & Asset Studio (Gemini 2.5 Flash Image)
          </p>
        </div>
        <div className="flex gap-3">
           <select
             value={theme}
             onChange={(e) => setTheme(e.target.value)}
             className="border border-slate-300 rounded-lg px-4 py-2 text-sm w-48 focus:ring-2 focus:ring-amber-500 outline-none"
           >
             <option>Modern Corporate</option>
             <option>Gamified</option>
             <option>Blueprint</option>
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {transformations.map((item, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
              
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <span className="bg-slate-700 text-xs px-2 py-1 rounded uppercase tracking-widest text-slate-300">
                        Section {index + 1}
                    </span>
                    <h3 className="font-semibold text-lg">{item.suggestedType.toUpperCase()}</h3>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2">
                 
                 {/* Logic */}
                 <div className="p-8 border-r border-slate-200 bg-slate-50">
                    <div className="mb-6">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Transformation Logic</h4>
                        <p className="text-sm text-slate-700 leading-relaxed">
                            {item.visualDescription}
                        </p>
                    </div>

                    <div className="mt-8">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Asset Prompt</h4>
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg mb-3">
                            <p className="text-xs text-indigo-700 font-mono">
                                {item.imagePrompt}
                            </p>
                        </div>
                        <button 
                            onClick={() => {
                                setActiveAssetId(item.sectionId);
                                setAssetPrompt(item.imagePrompt);
                                setGeneratedImage(null);
                            }}
                            className="text-xs bg-indigo-600 text-white px-3 py-2 rounded font-bold hover:bg-indigo-700 flex items-center gap-2"
                        >
                            <Palette className="w-3 h-3" />
                            Open Asset Studio
                        </button>
                    </div>
                 </div>

                 {/* Studio / Preview */}
                 <div className="p-8 bg-white flex flex-col items-center justify-center relative min-h-[300px]">
                    {activeAssetId === item.sectionId ? (
                        <div className="w-full h-full flex flex-col">
                            <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" /> Asset Studio
                            </h4>
                            <div className="flex-1 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden relative group">
                                {isGenerating ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-xs text-slate-500 font-medium">Gemini 2.5 Flash Image Working...</span>
                                    </div>
                                ) : generatedImage ? (
                                    <img src={generatedImage} alt="Generated Asset" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-center p-6">
                                        <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                        <p className="text-xs text-slate-500">Ready to generate</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="mt-4 flex gap-2">
                                <input 
                                    type="text" 
                                    value={assetPrompt} 
                                    onChange={(e) => setAssetPrompt(e.target.value)}
                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                                <button 
                                    onClick={handleGenerateAsset}
                                    disabled={isGenerating}
                                    className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold"
                                >
                                    {generatedImage ? 'Edit' : 'Generate'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center opacity-50">
                            <MonitorPlay className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <p className="text-sm text-slate-500">Select "Open Asset Studio" to generate custom visuals for this section.</p>
                        </div>
                    )}
                 </div>

              </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default VisualView;