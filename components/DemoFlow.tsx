import React, { useState } from 'react';
import { Upload, MapPin, Palette, ArrowRight, Loader2, CheckCircle, FileText } from 'lucide-react';
import { generateDemoSlides } from '../services/geminiService';
import { DemoSlide } from '../types';

interface DemoFlowProps {
  onBack: () => void;
}

const DemoFlow: React.FC<DemoFlowProps> = ({ onBack }) => {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Data State
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<{name: string, data: string} | null>(null);
  const [location, setLocation] = useState('');
  const [style, setStyle] = useState('Modern Professional');
  const [slides, setSlides] = useState<DemoSlide[]>([]);

  // Step 1: Content
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
          const reader = new FileReader();
          reader.onload = (res) => {
              setFile({ name: f.name, data: res.target?.result as string });
              if (!topic) setTopic(f.name.split('.')[0]); // Auto-fill topic
          };
          reader.readAsDataURL(f);
      }
  };

  // Step 2: Location
  const handleGeoLocation = () => {
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
              (pos) => {
                  setLocation(`Lat: ${pos.coords.latitude.toFixed(2)}, Long: ${pos.coords.longitude.toFixed(2)} (Local)`);
              },
              (err) => {
                  console.error(err);
                  // Fail silently or just focus the input
                  const input = document.getElementById('location-input');
                  if (input) input.focus();
              }
          );
      }
  };

  // Generate
  const handleGenerate = async () => {
      setIsGenerating(true);
      const results = await generateDemoSlides(topic, location, style, file?.data);
      setSlides(results);
      setIsGenerating(false);
      setStep(4); // Results step
  };

  const renderProgressBar = () => (
      <div className="flex justify-between mb-8 max-w-xs mx-auto">
          {[1, 2, 3].map(s => (
              <div key={s} className={`h-2 flex-1 mx-1 rounded-full transition-all ${step >= s ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          ))}
      </div>
  );

  // --- RENDER STEPS ---

  if (step === 1) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
              <div className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-xl">
                  {renderProgressBar()}
                  <h2 className="text-2xl font-bold text-center mb-2">What are we teaching?</h2>
                  <p className="text-slate-500 text-center mb-8">Upload a doc or just tell us the topic.</p>

                  <div className="space-y-6">
                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative">
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} accept=".pdf,.png,.jpg" />
                          {file ? (
                              <div className="flex flex-col items-center text-indigo-600">
                                  <FileText className="w-8 h-8 mb-2" />
                                  <span className="font-semibold">{file.name}</span>
                                  <span className="text-xs text-slate-400">Click to change</span>
                              </div>
                          ) : (
                            <div className="flex flex-col items-center text-slate-400">
                                <Upload className="w-8 h-8 mb-2" />
                                <span className="font-medium">Upload PDF or Image (Optional)</span>
                            </div>
                          )}
                      </div>

                      <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Topic / Subject</label>
                          <input 
                            type="text" 
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. Residential Plumbing Safety"
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                      </div>

                      <button 
                        onClick={() => setStep(2)}
                        disabled={!topic && !file}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                        Next <ArrowRight className="w-4 h-4" />
                      </button>
                  </div>
                  <button onClick={onBack} className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
          </div>
      );
  }

  if (step === 2) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-xl">
                {renderProgressBar()}
                <h2 className="text-2xl font-bold text-center mb-2">Where is this for?</h2>
                <p className="text-slate-500 text-center mb-8">We use Google Maps data to ensure local accuracy.</p>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Target Location</label>
                        <div className="flex gap-2">
                            <input 
                                id="location-input"
                                type="text" 
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="e.g. Austin, TX or London, UK"
                                className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button 
                                onClick={handleGeoLocation}
                                className="bg-indigo-50 text-indigo-600 p-3 rounded-xl hover:bg-indigo-100 transition-colors"
                                title="Detect Current Location (Optional)"
                            >
                                <MapPin className="w-6 h-6" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Enter manually or click pin to detect.</p>
                    </div>

                    <button 
                      onClick={() => setStep(3)}
                      className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      Next <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
                <button onClick={() => setStep(1)} className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600">Back</button>
            </div>
        </div>
    );
  }

  if (step === 3) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-xl">
                {renderProgressBar()}
                <h2 className="text-2xl font-bold text-center mb-2">Choose a Style</h2>
                <p className="text-slate-500 text-center mb-8">Set the vibe for your generated slides.</p>

                <div className="grid grid-cols-1 gap-4 mb-8">
                    {['Modern Professional', 'Playful & Gamified', 'Minimalist Tech', 'Academic & Formal'].map((s) => (
                        <button 
                            key={s}
                            onClick={() => setStyle(s)}
                            className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                                style === s ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 text-slate-600'
                            }`}
                        >
                            <Palette className={`w-5 h-5 ${style === s ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span className="font-semibold">{s}</span>
                        </button>
                    ))}
                </div>

                <button 
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" /> Generating Magic...
                        </>
                    ) : (
                        <>
                            Generate Demo Slides <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
                <button onClick={() => setStep(2)} className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600">Back</button>
            </div>
        </div>
    );
  }

  // Step 4: Results
  return (
      <div className="min-h-screen bg-slate-900 text-white p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-10 pt-4">
                  <div>
                      <h2 className="text-3xl font-bold">Your Course Preview</h2>
                      <p className="text-slate-400">Generated using Gemini 3 Flash Preview & Maps Grounding.</p>
                  </div>
                  <button onClick={onBack} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      Start Over
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {slides.map((slide, idx) => (
                      <div key={idx} className="bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[500px]">
                          {/* Visual Prompt Placeholder (In real app, we'd render the image using Gemini Image Gen here) */}
                          <div className="h-48 bg-slate-200 relative group overflow-hidden">
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400 p-6 text-center text-xs">
                                  Visual Prompt: "{slide.visualPrompt}"
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-6">
                                  <span className="text-white font-bold text-lg drop-shadow-md">Slide {idx + 1}</span>
                              </div>
                          </div>
                          
                          <div className="p-8 flex-1 flex flex-col">
                              <h3 className="text-xl font-bold mb-4 leading-tight" style={{ color: slide.colorTheme || '#1e293b' }}>
                                  {slide.title}
                              </h3>
                              <ul className="space-y-3 flex-1">
                                  {slide.bullets.map((b, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                          {b}
                                      </li>
                                  ))}
                              </ul>
                          </div>
                      </div>
                  ))}
              </div>

              <div className="mt-16 text-center max-w-2xl mx-auto pb-12">
                  <h3 className="text-2xl font-bold mb-4">Ready for the full transformation?</h3>
                  <p className="text-slate-400 mb-8">
                      This was just a taste. CourseCorrect can analyze hundreds of documents, cross-reference 
                      thousands of regulations, and generate fully interactive SCORM packages.
                  </p>
                  <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg shadow-indigo-500/25 transition-all transform hover:scale-105">
                      Unlock Full Access - $49/mo
                  </button>
              </div>
          </div>
      </div>
  );
};

export default DemoFlow;