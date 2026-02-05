import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Activity, Power } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage } from "@google/genai";
import { connectLiveParams } from '../services/geminiService';

interface LiveAssistantProps {
  onClose: () => void;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Ready to Connect");
  const [volume, setVolume] = useState(0);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Client Ref
  const sessionRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        if (isConnected) stopSession();
    };
  }, [isConnected]);

  const startSession = async () => {
    try {
        setStatus("Requesting Microphone...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        setStatus("Connecting to Gemini...");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        
        // 1. Setup Audio Input
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        
        // 2. Setup Output
        const outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const outputNode = outputContext.createGain();
        outputNode.connect(outputContext.destination);

        // 3. Connect to Live API
        const sessionPromise = ai.live.connect({
            ...connectLiveParams,
            callbacks: {
                onopen: () => {
                    setStatus("Listening...");
                    setIsConnected(true);
                    
                    // Start Streaming Input
                    if (!audioContextRef.current || !streamRef.current) return;
                    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
                    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                    
                    processor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        // Visualize volume
                        let sum = 0;
                        for(let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                        setVolume(Math.sqrt(sum / inputData.length) * 100);

                        // Encode and Send
                        const b64 = base64EncodeAudio(inputData);
                        sessionPromise.then(session => {
                            session.sendRealtimeInput({
                                media: {
                                    mimeType: "audio/pcm;rate=16000",
                                    data: b64
                                }
                            });
                        });
                    };

                    source.connect(processor);
                    processor.connect(audioContextRef.current.destination);
                    
                    inputSourceRef.current = source;
                    processorRef.current = processor;
                },
                onmessage: async (msg: LiveServerMessage) => {
                    // Play Audio Response
                    const data = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (data) {
                        setStatus("Speaking...");
                        const audioBuffer = await decodeAudio(data, outputContext);
                        const source = outputContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputNode);
                        source.start();
                        source.onended = () => setStatus("Listening...");
                    }
                },
                onclose: () => {
                    setStatus("Disconnected");
                    setIsConnected(false);
                },
                onerror: (err) => {
                    console.error(err);
                    setStatus("Error connecting");
                    setIsConnected(false);
                }
            }
        });
        
        // Store session for cleanup
        sessionRef.current = sessionPromise;

    } catch (e) {
        console.error("Live API Error", e);
        setStatus("Microphone Access Denied");
        setIsConnected(false);
    }
  };

  const stopSession = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (inputSourceRef.current) inputSourceRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    setIsConnected(false);
    setStatus("Ready to Connect");
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
        <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-6 w-80 border border-slate-700">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <Activity className={`w-5 h-5 ${isConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="font-bold text-lg">AI Consultant</span>
                </div>
                <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex flex-col items-center justify-center py-6 relative min-h-[180px]">
                
                {!isConnected ? (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                            <MicOff className="w-6 h-6 text-slate-500" />
                        </div>
                        <p className="text-sm text-slate-400 mb-6 px-2">
                            Connect to start a real-time voice conversation with your course assistant.
                        </p>
                        <button 
                            onClick={startSession}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 mx-auto transition-all shadow-lg shadow-emerald-900/20"
                        >
                            <Power className="w-4 h-4" />
                            Start Session
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Visualizer Ring */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-24 h-24 rounded-full border-2 border-slate-700 transition-transform duration-75" style={{ transform: `scale(${1 + volume/50})`, opacity: 0.5 }}></div>
                            <div className="w-32 h-32 rounded-full border border-slate-800 transition-transform duration-75" style={{ transform: `scale(${1 + volume/30})`, opacity: 0.3 }}></div>
                        </div>

                        <div 
                            className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 z-10 cursor-pointer hover:scale-105 transition-transform"
                            onClick={stopSession}
                            title="Click to disconnect"
                        >
                            <Mic className="w-8 h-8 text-white" />
                        </div>
                        
                        <p className="mt-6 font-medium text-emerald-400 tracking-wide animate-pulse">
                            {status}
                        </p>
                        <p className="text-slate-400 text-xs mt-2 text-center px-4">
                            Listening... (Tap mic to stop)
                        </p>
                    </>
                )}

            </div>
        </div>
    </div>
  );
};

// --- AUDIO HELPERS ---

function base64EncodeAudio(float32Array: Float32Array): string {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Clamp and scale
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function decodeAudio(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
    
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    return buffer;
}

export default LiveAssistant;