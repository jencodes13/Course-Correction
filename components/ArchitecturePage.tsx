import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  ScanSearch,
  ShieldCheck,
  Palette,
  BrainCircuit,
  BookOpen,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  Bot,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ArchitecturePageProps {
  onBack: () => void;
}

// Agent definitions
const agents = [
  {
    name: 'Fact Checker',
    color: '#3b82f6',
    icon: ShieldCheck,
    model: 'gemini-3-flash-preview',
    grounding: 'Google Search',
    description: 'Verifies every claim, regulation, and statistic against current sources using real-time web search.',
    capabilities: [
      'Search Grounding for live data',
      'Citation generation with URLs',
      'Confidence scoring per finding',
      'Jurisdiction-aware compliance checks',
    ],
    sampleInput: '"OSHA requires annual forklift training"',
    sampleOutput: 'Verified: 29 CFR 1910.178(l) requires evaluation every 3 years, not annually. Updated Jan 2024.',
  },
  {
    name: 'Slide Designer',
    color: '#c8956c',
    icon: Palette,
    model: 'gemini-3-flash-preview',
    grounding: 'None (two-pass)',
    description: 'Transforms dense text into modern, scannable slide layouts using a generate-then-review pipeline.',
    capabilities: [
      'Two-pass: generate + self-review',
      'Layout selection (hero, split, stats)',
      'Before/after slide pairs',
      'Icon and color suggestions',
    ],
    sampleInput: 'Wall of text about fire evacuation procedures',
    sampleOutput: 'Split layout: icon checklist left, hero image prompt right. 6 scannable bullets.',
  },
  {
    name: 'Quiz Builder',
    color: '#8b5cf6',
    icon: BrainCircuit,
    model: 'gemini-3-flash-preview',
    grounding: 'None',
    description: 'Generates certification-style assessment questions directly from course material.',
    capabilities: [
      'Multiple choice + scenario-based',
      'Distractor analysis',
      'Bloom\'s taxonomy alignment',
      'Difficulty calibration',
    ],
    sampleInput: 'Module on bloodborne pathogen exposure control',
    sampleOutput: 'Q: After a needlestick injury, the FIRST action is: A) Report to supervisor B) Wash with soap and water...',
  },
  {
    name: 'Course Summary',
    color: '#10b981',
    icon: BookOpen,
    model: 'gemini-3-pro-preview',
    grounding: 'None',
    description: 'Extracts learning objectives, key topics, and provides a structural overview of the entire course.',
    capabilities: [
      'Learning objective extraction',
      'Topic and subtopic mapping',
      'Difficulty assessment',
      'Gap analysis',
    ],
    sampleInput: '47-page PDF on construction safety',
    sampleOutput: '12 learning objectives, 8 modules, Intermediate level. Gap: No section on heat illness prevention.',
  },
];



// Intersection Observer hook for scroll animations
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// Animated section wrapper
const AnimatedSection: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className = '', delay = 0 }) => {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(32px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}


const ArchitecturePage: React.FC<ArchitecturePageProps> = ({ onBack }) => {
  const [activeAgent, setActiveAgent] = useState<number | null>(null);
  const [flowStep, setFlowStep] = useState(0);
  const { theme, toggleTheme } = useTheme();

  // Animate the flow diagram
  useEffect(() => {
    const timer = setInterval(() => {
      setFlowStep((prev) => (prev + 1) % 7);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background text-text-primary overflow-y-auto">
      {/* Floating nav — matches landing page */}
      <div className="fixed top-5 left-0 right-0 z-50 flex justify-between items-center px-8">
        {/* Left pill: Back + Logo + Theme toggle */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card/80 backdrop-blur-xl border border-surface-border/60 shadow-lg">
          <button onClick={onBack} className="text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-surface-border/60" />
          <button onClick={onBack} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/public/logo-cropped.png" alt="Course Correction" width={30} height={30} style={{ objectFit: 'contain' }} />
            <span className="text-sm font-bold text-text-primary tracking-tight">Course Correction</span>
          </button>
          <div className="w-px h-4 bg-surface-border/60" />
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ═══ HERO ═══ */}
      <section style={{ position: 'relative', paddingTop: 120, paddingBottom: 80, textAlign: 'center' }}>
        <div style={{ position: 'relative', maxWidth: 960, margin: '0 auto', padding: '0 24px', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 999,
            background: 'rgba(200,149,108,0.1)', border: '1px solid rgba(200,149,108,0.2)',
            color: '#c8956c', fontSize: 13, fontWeight: 600, marginBottom: 24,
          }}>
            <Bot className="w-4 h-4" />
            Multi-Agent AI Architecture
          </div>
          <h1 style={{
            fontFamily: 'Poppins, sans-serif', fontSize: 'clamp(40px, 5vw, 56px)',
            fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 24,
            whiteSpace: 'nowrap',
          }}>
            How{' '}
            <span style={{
              background: 'linear-gradient(135deg, #FF6B5B 0%, #4A3AFF 50%, #00C9A7 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              CourseCorrect
            </span>{' '}
            Works
          </h1>
          <p style={{
            color: 'rgba(245,240,224,0.6)', fontSize: 18, lineHeight: 1.7,
            maxWidth: 680, margin: '0 auto',
          }}>
            Four specialized AI agents work in parallel to analyze, verify, redesign, and assess your courses -- powered by Google Gemini 3.
          </p>
        </div>
      </section>

      {/* ═══ PIPELINE ═══ */}
      <section style={{ padding: '0 24px 100px', maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <AnimatedSection>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#c8956c', marginBottom: 12 }}>
              The Pipeline
            </p>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 36, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.01em' }}>
              Upload once. Four agents{' '}
              <span style={{ background: 'linear-gradient(135deg, #FF6B5B, #4A3AFF, #00C9A7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                in parallel.
              </span>
            </h2>
            <p style={{ color: 'rgba(245,240,224,0.5)', maxWidth: 480, margin: '0 auto', fontSize: 15 }}>
              Comprehensive results in seconds, not hours.
            </p>
          </div>

          {/* Pipeline visualization */}
          <div style={{ position: 'relative', marginTop: 48 }}>
            {/* Row 1: Upload → Deep Scan */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0, marginBottom: 32 }}>
              <PipelineNode
                icon={FileText}
                label="Upload"
                sublabel="PDF, PPT, DOC"
                color="#c8956c"
                active={flowStep === 0}
                passed={flowStep > 0}
                large
              />
              <PipelineConnectorH active={flowStep >= 1} />
              <PipelineNode
                icon={ScanSearch}
                label="Deep Scan"
                sublabel="Gemini 3 Pro"
                color="#c8956c"
                active={flowStep === 1}
                passed={flowStep > 1}
                large
              />
            </div>

            {/* Branching lines from Deep Scan to agents */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <div style={{
                width: 2, height: 28,
                background: flowStep >= 2
                  ? 'linear-gradient(180deg, #c8956c, rgba(200,149,108,0.5))'
                  : 'rgba(255,248,230,0.12)',
                transition: 'background 0.5s',
                borderRadius: 1,
                boxShadow: flowStep >= 2 ? '0 0 6px rgba(200,149,108,0.3)' : 'none',
              }} />
            </div>

            {/* Horizontal spread line */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <div style={{
                width: '82%', maxWidth: 660, height: 2,
                background: flowStep >= 2
                  ? 'linear-gradient(90deg, #3b82f6, #c8956c 35%, #8b5cf6 65%, #10b981)'
                  : 'rgba(255,248,230,0.1)',
                transition: 'background 0.5s',
                borderRadius: 1,
                boxShadow: flowStep >= 2 ? '0 0 8px rgba(200,149,108,0.2)' : 'none',
              }} />
            </div>

            {/* Vertical drops to agents */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 740, margin: '0 auto' }}>
              {agents.map((agent, i) => (
                <div key={agent.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 2, height: 20,
                    background: flowStep >= i + 2
                      ? agent.color
                      : 'rgba(255,248,230,0.1)',
                    transition: 'background 0.5s',
                    borderRadius: 1,
                    marginBottom: 8,
                    boxShadow: flowStep === i + 2 ? `0 0 8px ${agent.color}50` : 'none',
                  }} />
                  <PipelineAgentCard
                    icon={agent.icon}
                    label={agent.name}
                    color={agent.color}
                    active={flowStep === i + 2}
                    passed={flowStep > i + 2}
                  />
                </div>
              ))}
            </div>

            {/* Converge lines from agents */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 740, margin: '0 auto' }}>
              {agents.map((agent, i) => (
                <div key={agent.name + '-line-bottom'} style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    width: 2, height: 20,
                    background: flowStep >= 6
                      ? agent.color
                      : 'rgba(255,248,230,0.1)',
                    transition: 'background 0.5s',
                    borderRadius: 1,
                    marginTop: 8,
                    boxShadow: flowStep >= 6 ? `0 0 6px ${agent.color}40` : 'none',
                  }} />
                </div>
              ))}
            </div>

            {/* Bottom converge line */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 0, marginBottom: 8 }}>
              <div style={{
                width: '82%', maxWidth: 660, height: 2,
                background: flowStep >= 6
                  ? 'linear-gradient(90deg, #3b82f6, #c8956c 35%, #8b5cf6 65%, #10b981)'
                  : 'rgba(255,248,230,0.1)',
                transition: 'background 0.5s',
                borderRadius: 1,
                boxShadow: flowStep >= 6 ? '0 0 8px rgba(200,149,108,0.2)' : 'none',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <div style={{
                width: 2, height: 28,
                background: flowStep >= 6
                  ? 'linear-gradient(180deg, rgba(200,149,108,0.5), #c8956c)'
                  : 'rgba(255,248,230,0.12)',
                transition: 'background 0.5s',
                borderRadius: 1,
                boxShadow: flowStep >= 6 ? '0 0 6px rgba(200,149,108,0.3)' : 'none',
              }} />
            </div>

            {/* Row 3: Full Course Module */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PipelineNode
                icon={Sparkles}
                label="Full Course Module"
                sublabel="Slides + PDF + Quiz"
                color="#c8956c"
                active={flowStep === 6}
                passed={false}
                large
              />
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* ═══ AGENT DETAIL CARDS ═══ */}
      <section style={{ padding: '0 24px 100px', maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <AnimatedSection>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#00C9A7', marginBottom: 12 }}>
              Agent Orchestra
            </p>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 12 }}>
              Meet the{' '}
              <span style={{ background: 'linear-gradient(135deg, #00C9A7, #4A3AFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Agents
              </span>
            </h2>
            <p style={{ color: 'rgba(245,240,224,0.5)', maxWidth: 480, margin: '0 auto', fontSize: 15 }}>
              Each agent is a specialist. Together, they deliver comprehensive course modernization.
            </p>
          </div>
        </AnimatedSection>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
          {agents.map((agent, i) => {
            const isExpanded = activeAgent === i;
            return (
              <AnimatedSection key={agent.name} delay={i * 100}>
                <div
                  style={{
                    position: 'relative',
                    background: 'rgba(255,248,230,0.04)',
                    border: `1px solid ${isExpanded ? `${agent.color}40` : 'rgba(255,248,230,0.1)'}`,
                    borderRadius: 16, overflow: 'hidden',
                    transition: 'all 0.3s',
                    cursor: 'pointer',
                    boxShadow: isExpanded ? `0 0 40px ${agent.color}08` : 'none',
                    backdropFilter: 'blur(10px)',
                  }}
                  onClick={() => setActiveAgent(isExpanded ? null : i)}
                >
                  {/* Accent top bar */}
                  <div style={{ height: 3, background: `linear-gradient(90deg, ${agent.color}, ${agent.color}40)` }} />

                  <div style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                      <div style={{
                        flexShrink: 0, width: 56, height: 56, borderRadius: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${agent.color}10`, border: `1px solid ${agent.color}20`,
                      }}>
                        <agent.icon className="w-7 h-7" style={{ color: agent.color }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 20, color: '#f5f0e0', marginBottom: 4 }}>
                          {agent.name}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(245,240,224,0.4)' }}>
                          <span style={{ fontFamily: 'monospace' }}>{agent.model.replace('gemini-', '').replace('-preview', '')}</span>
                          {agent.grounding !== 'None' && agent.grounding !== 'None (two-pass)' && (
                            <>
                              <span style={{ color: 'rgba(255,248,230,0.12)' }}>|</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Search className="w-3 h-3" />
                                {agent.grounding}
                              </span>
                            </>
                          )}
                          {agent.grounding === 'None (two-pass)' && (
                            <>
                              <span style={{ color: 'rgba(255,248,230,0.12)' }}>|</span>
                              <span>Two-pass pipeline</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, marginTop: 4 }}>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" style={{ color: 'rgba(245,240,224,0.4)' }} />
                        ) : (
                          <ChevronDown className="w-5 h-5" style={{ color: 'rgba(245,240,224,0.4)' }} />
                        )}
                      </div>
                    </div>

                    <p style={{ color: 'rgba(245,240,224,0.6)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{agent.description}</p>

                    {/* Capabilities */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                      {agent.capabilities.map((cap) => (
                        <span key={cap} style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 8,
                          background: `${agent.color}08`, border: `1px solid ${agent.color}18`,
                          color: agent.color,
                        }}>
                          {cap}
                        </span>
                      ))}
                    </div>

                    {/* Expanded: Sample I/O */}
                    <div style={{
                      overflow: 'hidden', transition: 'max-height 0.3s ease, opacity 0.3s ease',
                      maxHeight: isExpanded ? 300 : 0, opacity: isExpanded ? 1 : 0,
                    }}>
                      <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,248,230,0.06)' }}>
                        <div style={{ display: 'grid', gap: 12 }}>
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(245,240,224,0.4)' }}>
                              Sample Input
                            </span>
                            <div style={{
                              marginTop: 6, padding: 12, borderRadius: 8,
                              background: 'rgba(255,248,230,0.04)',
                              fontSize: 12, fontFamily: 'monospace', color: 'rgba(245,240,224,0.6)', lineHeight: 1.5,
                            }}>
                              {agent.sampleInput}
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: agent.color }}>
                              Agent Output
                            </span>
                            <div style={{
                              marginTop: 6, padding: 12, borderRadius: 8,
                              background: `${agent.color}06`, border: `1px solid ${agent.color}12`,
                              fontSize: 12, color: '#f5f0e0', lineHeight: 1.5,
                            }}>
                              {agent.sampleOutput}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </section>



      {/* ═══ CTA ═══ */}
      <section style={{ padding: '0 24px 80px', position: 'relative', zIndex: 1 }}>
        <AnimatedSection>
          <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              position: 'relative', borderRadius: 20, padding: '48px 40px', overflow: 'hidden',
              background: 'rgba(255,248,230,0.03)',
              border: '1px solid rgba(255,248,230,0.08)',
              backdropFilter: 'blur(10px)',
            }}>
              {/* Background glow */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at center, rgba(200,149,108,0.08), transparent 70%)',
              }} />
              <div style={{ position: 'relative' }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#c8956c', marginBottom: 12 }}>
                  Get Started
                </p>
                <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 28, fontWeight: 800, marginBottom: 12, lineHeight: 1.2 }}>
                  Ready to modernize<br/>your courses?
                </h3>
                <p style={{ color: 'rgba(245,240,224,0.5)', fontSize: 15, marginBottom: 28 }}>
                  Try the free demo -- upload a course and see the agents in action.
                </p>
                <button
                  onClick={onBack}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '14px 28px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #FF6B5B, #4A3AFF)',
                    color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 15,
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 8px 30px rgba(255,107,91,0.2)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(255,107,91,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(255,107,91,0.2)'; }}
                >
                  Upload a Course
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Footer */}
      <div style={{ padding: '20px 0 40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, fontSize: 11, color: 'rgba(245,240,224,0.25)' }}>
          <span>Course Correction</span>
          <span>Google Gemini 3 Hackathon</span>
          <span>Powered by Gemini</span>
        </div>
      </div>
    </div>
  );
};

// ═══ Pipeline Sub-components ═══

interface PipelineNodeProps {
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  sublabel: string;
  color: string;
  active: boolean;
  passed?: boolean;
  large?: boolean;
}

function PipelineNode({ icon: Icon, label, sublabel, color, active, passed, large }: PipelineNodeProps) {
  const isLit = active || passed;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      transition: 'all 0.5s',
      opacity: active ? 1 : (passed ? 0.85 : 0.65),
      transform: active ? 'scale(1.08)' : 'scale(1)',
    }}>
      <div style={{
        position: 'relative',
        width: large ? 72 : 56, height: large ? 72 : 56,
        borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? `${color}20` : (passed ? `${color}0c` : 'rgba(255,248,230,0.05)'),
        border: `1px solid ${active ? `${color}50` : (passed ? `${color}25` : 'rgba(255,248,230,0.12)')}`,
        boxShadow: active ? `0 0 30px ${color}25, 0 0 60px ${color}10` : (passed ? `0 0 12px ${color}08` : 'none'),
        transition: 'all 0.5s',
        backdropFilter: 'blur(10px)',
      }}>
        <Icon
          className={large ? 'w-8 h-8' : 'w-6 h-6'}
          style={{ color: isLit ? color : 'rgba(245,240,224,0.5)', transition: 'color 0.5s' }}
        />
        {active && (
          <div style={{
            position: 'absolute', inset: -4, borderRadius: 20,
            border: `2px solid ${color}40`,
            animation: 'pulse 2s infinite',
          }} />
        )}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'Poppins, sans-serif', fontWeight: 600,
          fontSize: large ? 14 : 12,
          color: active ? color : (passed ? `${color}cc` : 'rgba(245,240,224,0.6)'),
          transition: 'color 0.5s',
        }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(245,240,224,0.4)', marginTop: 2 }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineAgentCard({ icon: Icon, label, color, active, passed }: {
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  color: string;
  active: boolean;
  passed?: boolean;
}) {
  const isLit = active || passed;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: '16px 8px',
      borderRadius: 14,
      background: active ? `${color}10` : (passed ? `${color}06` : 'rgba(255,248,230,0.03)'),
      border: `1px solid ${active ? `${color}45` : (passed ? `${color}20` : 'rgba(255,248,230,0.1)')}`,
      transition: 'all 0.5s',
      backdropFilter: 'blur(8px)',
      boxShadow: active ? `0 0 28px ${color}18, inset 0 0 20px ${color}06` : (passed ? `0 0 10px ${color}08` : 'none'),
      opacity: active ? 1 : (passed ? 0.85 : 0.7),
      transform: active ? 'scale(1.06)' : 'scale(1)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? `${color}18` : (passed ? `${color}0a` : 'rgba(255,248,230,0.05)'),
        border: `1px solid ${active ? `${color}40` : (passed ? `${color}18` : 'rgba(255,248,230,0.1)')}`,
        transition: 'all 0.5s',
      }}>
        <Icon className="w-5 h-5" style={{ color: isLit ? color : 'rgba(245,240,224,0.5)', transition: 'color 0.5s' }} />
      </div>
      <span style={{
        fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 12,
        color: active ? color : (passed ? `${color}bb` : 'rgba(245,240,224,0.5)'),
        transition: 'color 0.5s', textAlign: 'center',
      }}>
        {label}
      </span>
    </div>
  );
}

function PipelineConnectorH({ active }: { active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px' }}>
      <div style={{
        width: 52, height: 2, borderRadius: 1,
        background: active
          ? 'linear-gradient(90deg, #c8956c, rgba(200,149,108,0.5))'
          : 'rgba(255,248,230,0.12)',
        transition: 'background 0.5s',
        boxShadow: active ? '0 0 10px rgba(200,149,108,0.4)' : 'none',
      }} />
      <ArrowRight
        className="w-4 h-4"
        style={{
          color: active ? '#c8956c' : 'rgba(255,248,230,0.2)',
          transition: 'color 0.5s', marginLeft: -2,
        }}
      />
    </div>
  );
}

export default ArchitecturePage;
