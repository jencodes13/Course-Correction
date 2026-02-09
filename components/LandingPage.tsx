import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRight, Shield, Palette, FileText, BarChart3, Award, Search } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
  onSignIn?: () => void;
}

// ─── Design Tokens ───
const T = {
  bg: '#0c0b09',
  bgWarm: '#13120e',
  bgCard: '#1a1914',
  surface: 'rgba(255,248,230,0.04)',
  surfaceHover: 'rgba(255,248,230,0.07)',
  border: 'rgba(255,248,230,0.08)',
  borderHover: 'rgba(255,248,230,0.14)',
  text: '#f5f0e0',
  textMuted: 'rgba(245,240,224,0.5)',
  textDim: 'rgba(245,240,224,0.3)',
  accent: '#c8956c',
  accentMuted: 'rgba(200,149,108,0.15)',
  accentGlow: 'rgba(200,149,108,0.08)',
  green: '#6abf8a',
  greenMuted: 'rgba(106,191,138,0.12)',
  greenBorder: 'rgba(106,191,138,0.25)',
  red: '#c27056',
  redMuted: 'rgba(194,112,86,0.12)',
  serif: "'Inter', Helvetica, Arial, sans-serif",
  sans: "'Inter', Helvetica, Arial, sans-serif",
  mono: "'Inter', Helvetica, Arial, sans-serif",
};

// ─── Old Document Side ───
function OldDocument() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#eee8da',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Courier New', monospace",
    }}>
      {/* Paper grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none' as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E")`,
      }} />

      <div style={{
        width: 360, padding: '40px 34px',
        background: '#faf6ee', border: '1px solid #cec7b4',
        boxShadow: '6px 6px 0px #d4cfc0, 0 20px 40px rgba(0,0,0,0.08)',
        position: 'relative', transform: 'rotate(-1.2deg)',
      }}>
        {/* Coffee stain */}
        <div style={{
          position: 'absolute', top: 14, right: 20, width: 52, height: 52,
          borderRadius: '50%', border: '2.5px solid rgba(139,109,71,0.12)',
          background: 'radial-gradient(circle, rgba(139,109,71,0.05) 0%, transparent 70%)',
        }} />

        <div style={{
          fontSize: 10, color: '#9a9080', textTransform: 'uppercase' as const,
          letterSpacing: 3, marginBottom: 8, fontFamily: T.mono,
        }}>REV 3.2 — SEPT 2019</div>

        <h3 style={{
          fontFamily: "'Times New Roman', 'Georgia', serif",
          fontSize: 21, color: '#3d3529', marginBottom: 18,
          lineHeight: 1.25, fontWeight: 700,
        }}>Fall Protection &<br/>Safety Procedures</h3>

        <div style={{ borderTop: '1px solid #d4cfc2', marginBottom: 18 }} />

        {/* Faded text blocks */}
        {[
          { w: '100%', o: 0.42 }, { w: '90%', o: 0.36 },
          { w: '96%', o: 0.30 }, { w: '65%', o: 0.24 },
          { w: '100%', o: 0.22, mt: 14 }, { w: '88%', o: 0.18 },
          { w: '55%', o: 0.15 },
        ].map((l, i) => (
          <div key={i} style={{
            height: 7, width: l.w, borderRadius: 1.5, marginBottom: 5.5,
            marginTop: l.mt || 0,
            background: `rgba(61,53,41,${l.o})`,
          }} />
        ))}

        <div style={{ marginTop: 20, borderTop: '1px solid #d4cfc2', paddingTop: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#b8462a', fontSize: 10.5, fontWeight: 700,
            letterSpacing: 0.5,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b8462a" strokeWidth="2.5">
              <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            NON-COMPLIANT — Missing 2024 guardrail specs
          </div>
        </div>

        {/* Sticky note */}
        <div style={{
          position: 'absolute', bottom: -20, right: -16,
          background: '#fff8a0', padding: '9px 13px',
          transform: 'rotate(3.5deg)',
          boxShadow: '2px 3px 8px rgba(0,0,0,0.1)',
          fontSize: 11, color: '#6b6400',
          fontFamily: "'Comic Sans MS', cursive", lineHeight: 1.35,
        }}>
          needs updating!!<br/>— Karen
        </div>
      </div>
    </div>
  );
}

// ─── New Content Side ───
function NewContent() {
  const [activeTab, setActiveTab] = useState<string>('slides');

  const tabs = [
    { id: 'slides', label: 'Slides', icon: FileText },
    { id: 'quiz', label: 'Quiz', icon: BarChart3 },
    { id: 'cert', label: 'Certificate', icon: Award },
  ];

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `linear-gradient(160deg, ${T.bg} 0%, #151410 50%, ${T.bgWarm} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: T.sans, overflow: 'hidden',
    }}>
      {/* Warm ambient glows */}
      <div style={{
        position: 'absolute', top: '15%', right: '15%', width: 320, height: 320,
        borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' as const,
        background: `radial-gradient(circle, ${T.accentGlow} 0%, transparent 70%)`,
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', left: '25%', width: 260, height: 260,
        borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none' as const,
        background: `radial-gradient(circle, ${T.greenMuted} 0%, transparent 70%)`,
      }} />

      <div style={{ width: 370, position: 'relative', zIndex: 1 }}>
        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 3, marginBottom: 14,
          background: T.surface, borderRadius: 10, padding: 3,
          border: `1px solid ${T.border}`,
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: '9px 6px', borderRadius: 8,
                border: 'none', cursor: 'pointer',
                fontSize: 11.5, fontWeight: active ? 600 : 500,
                fontFamily: T.sans,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'all 0.2s ease',
                background: active ? T.accentMuted : 'transparent',
                color: active ? T.accent : T.textDim,
              }}>
                <Icon size={13} strokeWidth={active ? 2.2 : 1.8} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Slides Tab ── */}
        {activeTab === 'slides' && (
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 14, padding: 18, backdropFilter: 'blur(20px)',
          }}>
            <div style={{
              background: `linear-gradient(135deg, ${T.accent}, #a07850)`,
              borderRadius: 11, padding: '22px 20px', marginBottom: 14,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -24, right: -24, width: 100, height: 100,
                borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
              }} />
              <div style={{
                position: 'absolute', bottom: -30, left: -10, width: 70, height: 70,
                borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
              }} />
              <div style={{
                fontSize: 9.5, color: 'rgba(255,255,255,0.55)',
                textTransform: 'uppercase' as const, letterSpacing: 2.5, marginBottom: 8,
                fontFamily: T.sans, fontWeight: 600,
              }}>
                Module 1 of 5
              </div>
              <div style={{
                fontFamily: T.serif, fontSize: 20, fontWeight: 400,
                color: '#fff', lineHeight: 1.25, fontStyle: 'italic',
              }}>
                Fall Protection:<br/>Updated Standards
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 3 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{
                    height: 2.5, flex: 1, borderRadius: 3,
                    background: i === 1 ? '#fff' : 'rgba(255,255,255,0.2)',
                  }} />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 7 }}>
              {[
                { label: 'Guardrails', sub: '1926.502' },
                { label: 'Harnesses', sub: '1926.502(d)' },
                { label: 'Inspections', sub: 'Annual' },
              ].map((item, i) => (
                <div key={i} style={{
                  flex: 1, background: T.surface,
                  border: `1px solid ${T.border}`, borderRadius: 9,
                  padding: '11px 8px', textAlign: 'center' as const,
                }}>
                  <div style={{
                    fontSize: 12, color: T.text, fontWeight: 600, marginBottom: 2,
                    fontFamily: T.sans,
                  }}>{item.label}</div>
                  <div style={{
                    fontSize: 9, color: T.textDim, fontFamily: T.mono,
                    letterSpacing: 0.3,
                  }}>{item.sub}</div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', background: T.greenMuted,
              border: `1px solid ${T.greenBorder}`, borderRadius: 8,
            }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={T.green} strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
              <span style={{ fontSize: 10.5, color: T.green, fontWeight: 600, fontFamily: T.sans }}>
                Verified against 2024 OSHA 1926 Subpart M
              </span>
            </div>
          </div>
        )}

        {/* ── Quiz Tab ── */}
        {activeTab === 'quiz' && (
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 14, padding: 18, backdropFilter: 'blur(20px)',
          }}>
            <div style={{
              fontSize: 9.5, color: T.textDim, textTransform: 'uppercase' as const,
              letterSpacing: 2.5, marginBottom: 6, fontWeight: 600, fontFamily: T.sans,
            }}>Knowledge Check</div>
            <div style={{
              fontFamily: T.serif, fontSize: 16, color: T.text,
              fontWeight: 400, marginBottom: 16, lineHeight: 1.45, fontStyle: 'italic',
            }}>
              At what height does OSHA require fall protection in construction?
            </div>

            {[
              { label: 'A', text: '4 feet above lower level' },
              { label: 'B', text: '6 feet above lower level', correct: true },
              { label: 'C', text: '10 feet above lower level' },
              { label: 'D', text: '15 feet above lower level' },
            ].map((opt, i) => (
              <div key={i} style={{
                padding: '11px 13px', marginBottom: 6, borderRadius: 9,
                border: `1px solid ${opt.correct ? T.greenBorder : T.border}`,
                background: opt.correct ? T.greenMuted : 'rgba(255,255,255,0.015)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: opt.correct ? 'rgba(106,191,138,0.2)' : T.surface,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10.5, fontWeight: 700, fontFamily: T.sans,
                  color: opt.correct ? T.green : T.textDim,
                }}>
                  {opt.correct ? '\u2713' : opt.label}
                </div>
                <span style={{
                  fontSize: 12.5, fontFamily: T.sans,
                  color: opt.correct ? '#a8e6c3' : T.textMuted,
                  fontWeight: opt.correct ? 600 : 400,
                }}>{opt.text}</span>
              </div>
            ))}

            <div style={{
              marginTop: 8, padding: '9px 12px',
              background: T.accentMuted, border: `1px solid rgba(200,149,108,0.2)`,
              borderRadius: 8, fontSize: 10.5, fontFamily: T.sans,
              color: T.accent, lineHeight: 1.5, fontWeight: 500,
            }}>
              Auto-generated from your updated fall protection materials
            </div>
          </div>
        )}

        {/* ── Certificate Tab ── */}
        {activeTab === 'cert' && (
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 14, padding: 18, backdropFilter: 'blur(20px)',
          }}>
            <div style={{
              border: `1px solid ${T.border}`, borderRadius: 12,
              padding: '30px 22px', textAlign: 'center' as const,
              background: 'linear-gradient(180deg, rgba(255,248,230,0.025) 0%, transparent 100%)',
              position: 'relative',
            }}>
              {/* Corner accents */}
              {[
                { top: 10, left: 10 }, { top: 10, right: 10 },
                { bottom: 10, left: 10 }, { bottom: 10, right: 10 },
              ].map((pos, i) => (
                <div key={i} style={{
                  position: 'absolute' as const, ...pos, width: 18, height: 18,
                  borderTop: pos.top !== undefined ? `1.5px solid rgba(200,149,108,0.3)` : 'none',
                  borderBottom: pos.bottom !== undefined ? `1.5px solid rgba(200,149,108,0.3)` : 'none',
                  borderLeft: pos.left !== undefined ? `1.5px solid rgba(200,149,108,0.3)` : 'none',
                  borderRight: pos.right !== undefined ? `1.5px solid rgba(200,149,108,0.3)` : 'none',
                }} />
              ))}

              <div style={{
                fontSize: 8.5, textTransform: 'uppercase' as const,
                letterSpacing: 4.5, color: 'rgba(200,149,108,0.55)', marginBottom: 12,
                fontFamily: T.sans, fontWeight: 700,
              }}>Certificate of Completion</div>
              <div style={{
                fontFamily: T.serif, fontSize: 24, color: T.accent,
                marginBottom: 6, fontStyle: 'italic',
              }}>Fall Protection</div>
              <div style={{
                fontSize: 11.5, color: T.textDim, marginBottom: 18, fontFamily: T.sans,
              }}>Successfully Completed All 5 Modules</div>
              <div style={{
                width: 40, height: 1, margin: '0 auto 18px',
                background: 'rgba(200,149,108,0.3)',
              }} />
              <div style={{
                fontSize: 14, color: T.text, fontWeight: 600, marginBottom: 3,
                fontFamily: T.sans,
              }}>Sarah Johnson</div>
              <div style={{
                fontSize: 10.5, color: T.textDim, fontFamily: T.mono,
              }}>February 3, 2026</div>

              <div style={{
                marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', background: T.accentMuted,
                borderRadius: 20, fontSize: 9.5, fontWeight: 600,
                color: 'rgba(200,149,108,0.7)', fontFamily: T.sans,
              }}>
                <Shield size={11} strokeWidth={2.2} />
                Verified &amp; SCORM Trackable
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Feature Card ───
function FeatureCard({ icon: Icon, title, desc, delay }: {
  icon: React.FC<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  title: string; desc: string; delay: number;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.disconnect(); }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <div ref={ref} style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: '28px 24px',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: T.accentMuted, border: `1px solid rgba(200,149,108,0.12)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        <Icon size={18} strokeWidth={1.8} style={{ color: T.accent }} />
      </div>
      <div style={{
        fontFamily: T.sans, fontSize: 15, fontWeight: 700,
        color: T.text, marginBottom: 8, letterSpacing: -0.2,
      }}>{title}</div>
      <div style={{
        fontFamily: T.sans, fontSize: 13, color: T.textMuted,
        lineHeight: 1.6, fontWeight: 400,
      }}>{desc}</div>
    </div>
  );
}

// ─── Main Landing Page ───
const LandingPage: React.FC<LandingPageProps> = ({ onStart, onSignIn }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseFading, setPhraseFading] = useState(false);
  const PHRASES = ['are outdated.', 'need a refresh.', 'aren\u2019t cutting it.'];

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Rotating headline phrases
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseFading(true);
      setTimeout(() => {
        setPhraseIndex(prev => (prev + 1) % PHRASES.length);
        setPhraseFading(false);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
    if (!hasInteracted) setHasInteracted(true);
  }, [hasInteracted]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      updateSlider('touches' in e ? e.touches[0].clientX : e.clientX);
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, updateSlider]);

  // Idle oscillation
  useEffect(() => {
    if (hasInteracted) return;
    let frame: number; let t = 0;
    const animate = () => {
      t += 0.01;
      setSliderPos(50 + Math.sin(t) * 5);
      frame = requestAnimationFrame(animate);
    };
    const timeout = setTimeout(() => { frame = requestAnimationFrame(animate); }, 2000);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [hasInteracted]);

  const features = [
    { icon: Search, title: 'Regulatory Scanning', desc: 'Reads every fact, citation, and regulation in your course and cross-checks against live government sources.' },
    { icon: Shield, title: 'Compliance Verification', desc: 'Identifies outdated OSHA, HIPAA, FDA, and DOT references with specific code citations and proposed rewrites.' },
    { icon: Palette, title: 'Visual Modernization', desc: 'Transforms dense PDFs and text-heavy slides into interactive modules, scenario drills, and visual guides.' },
    { icon: Award, title: 'Export Anywhere', desc: 'Package updated courses as SCORM 1.2 or xAPI for direct upload to your LMS — Cornerstone, Workday, Canvas.' },
  ];

  const industries = ['Construction', 'Healthcare', 'Manufacturing', 'Food Service', 'Transportation', 'Energy'];

  return (
    <div style={{
      minHeight: '100vh', background: T.bg, fontFamily: T.sans,
      color: T.text, overflowX: 'hidden',
    }}>
      {/* ── Grain overlay ── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none' as const, zIndex: 9999,
        opacity: 0.035, mixBlendMode: 'overlay' as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
      }} />

      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 32px',
        background: 'linear-gradient(180deg, rgba(12,11,9,0.9) 0%, rgba(12,11,9,0) 100%)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Logo mark */}
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: `linear-gradient(135deg, ${T.accent}, #a07850)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 2px 12px ${T.accentGlow}`,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span style={{
            fontFamily: T.sans, fontWeight: 700, fontSize: 15,
            color: T.text, letterSpacing: -0.5,
          }}>CourseCorrect</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onSignIn && (
            <button onClick={onSignIn} style={{
              padding: '9px 18px', borderRadius: 8,
              border: 'none', background: 'transparent',
              color: T.textMuted, fontSize: 13, fontWeight: 600,
              fontFamily: T.sans, cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: -0.2,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = T.accent;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = T.textMuted;
            }}>
              Sign In
            </button>
          )}
          <button onClick={onStart} style={{
            padding: '9px 22px', borderRadius: 8,
            border: `1px solid ${T.border}`, background: T.surface,
            color: T.text, fontSize: 13, fontWeight: 600,
            fontFamily: T.sans, cursor: 'pointer',
            transition: 'all 0.2s ease', backdropFilter: 'blur(10px)',
            letterSpacing: -0.2,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = T.surfaceHover;
            e.currentTarget.style.borderColor = T.borderHover;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = T.surface;
            e.currentTarget.style.borderColor = T.border;
          }}>
            Try the demo
          </button>
        </div>
      </nav>

      {/* ═══════════ HERO SECTION ═══════════ */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '100px 24px 60px', gap: 48, position: 'relative',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 800, height: 500, borderRadius: '50%', filter: 'blur(120px)',
          background: `radial-gradient(circle, rgba(200,149,108,0.06) 0%, transparent 70%)`,
          pointerEvents: 'none' as const,
        }} />

        {/* Badge */}
        <div style={{
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          transitionDelay: '0.1s',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '7px 16px', background: T.accentMuted,
          border: `1px solid rgba(200,149,108,0.15)`,
          borderRadius: 24, fontSize: 12, fontWeight: 600,
          color: T.accent, letterSpacing: 0.3,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: T.green,
            boxShadow: `0 0 8px ${T.green}`,
            animation: 'cc-pulse 2s ease-in-out infinite',
          }} />
          Built for the Gemini 3 Hackathon
        </div>

        {/* Headline */}
        <div style={{
          textAlign: 'center', maxWidth: 680, position: 'relative', zIndex: 2,
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          transitionDelay: '0.25s',
        }}>
          <h1 style={{
            fontFamily: T.serif, fontSize: 56, color: T.text,
            lineHeight: 1.1, marginBottom: 20, fontWeight: 400,
            letterSpacing: -1,
          }}>
            Your training materials<br/>
            <span style={{
              fontStyle: 'italic',
              background: `linear-gradient(135deg, ${T.accent}, #e8c4a0)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              display: 'inline-block',
              opacity: phraseFading ? 0 : 1,
              transform: phraseFading ? 'translateY(8px)' : 'translateY(0)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}>{PHRASES[phraseIndex]}</span>
          </h1>
          <p style={{
            fontSize: 17, color: T.textMuted, lineHeight: 1.7,
            fontWeight: 400, maxWidth: 500, margin: '0 auto',
            letterSpacing: -0.1,
          }}>
            CourseCorrect scans your safety courses for outdated regulations and stale designs, then rebuilds them into modern, interactive training — verified against live sources.
          </p>
        </div>

        {/* ── SPLIT VIEWER ── */}
        <div style={{
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          transitionDelay: '0.45s',
          width: '100%', maxWidth: 860, position: 'relative',
        }}>
          <div
            ref={containerRef}
            style={{
              position: 'relative', width: '100%', height: 480,
              borderRadius: 16, overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'default',
              boxShadow: `0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px ${T.border}`,
              userSelect: 'none',
            }}
            onClick={e => { if (!isDragging) updateSlider(e.clientX); }}
          >
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <OldDocument />
            </div>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 2,
              clipPath: `inset(0 0 0 ${sliderPos}%)`,
            }}>
              <NewContent />
            </div>

            {/* Labels */}
            <div style={{
              position: 'absolute', top: 16, left: 16, zIndex: 3,
              padding: '5px 12px', background: 'rgba(61,53,41,0.9)',
              borderRadius: 6, fontSize: 10, fontWeight: 700,
              color: '#d4cfc2', letterSpacing: 1.5,
              textTransform: 'uppercase' as const, fontFamily: T.sans,
              opacity: sliderPos > 15 ? 1 : 0, transition: 'opacity 0.3s',
            }}>Before</div>
            <div style={{
              position: 'absolute', top: 16, right: 16, zIndex: 3,
              padding: '5px 12px', background: T.accentMuted,
              backdropFilter: 'blur(10px)', borderRadius: 6,
              fontSize: 10, fontWeight: 700, fontFamily: T.sans,
              color: T.accent, letterSpacing: 1.5,
              textTransform: 'uppercase' as const,
              opacity: sliderPos < 85 ? 1 : 0, transition: 'opacity 0.3s',
            }}>After</div>

            {/* Slider handle */}
            <div
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${sliderPos}%`, transform: 'translateX(-50%)',
                zIndex: 10, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', cursor: 'grab',
              }}
              onMouseDown={e => { e.preventDefault(); setIsDragging(true); }}
              onTouchStart={() => setIsDragging(true)}
            >
              <div style={{
                position: 'absolute', top: 0, bottom: 0, width: 2,
                background: `linear-gradient(180deg, transparent, rgba(200,149,108,0.6), rgba(200,149,108,0.8), rgba(200,149,108,0.6), transparent)`,
              }} />
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `linear-gradient(135deg, ${T.accent}, #a07850)`,
                border: '3px solid rgba(255,248,230,0.85)',
                boxShadow: `0 4px 24px rgba(200,149,108,0.4), 0 0 0 5px rgba(200,149,108,0.1)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', zIndex: 11,
                transition: 'transform 0.15s ease',
                transform: isDragging ? 'scale(1.12)' : 'scale(1)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M8 6l-4 6 4 6" /><path d="M16 6l4 6-4 6" />
                </svg>
              </div>
              {!hasInteracted && (
                <div style={{
                  position: 'absolute', bottom: 32, whiteSpace: 'nowrap',
                  fontSize: 11, color: 'rgba(245,240,224,0.5)', fontWeight: 600,
                  fontFamily: T.sans, animation: 'cc-fade 2.5s ease-in-out infinite',
                  background: 'rgba(12,11,9,0.7)', padding: '5px 14px',
                  borderRadius: 20, backdropFilter: 'blur(8px)',
                  letterSpacing: 0.3,
                }}>
                  Drag to compare
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{
          display: 'flex', gap: 16, alignItems: 'center',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          transitionDelay: '0.65s',
        }}>
          <button onClick={onStart} style={{
            padding: '14px 30px', borderRadius: 10,
            border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${T.accent}, #a07850)`,
            color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: T.sans, letterSpacing: -0.2,
            boxShadow: `0 4px 24px rgba(200,149,108,0.3)`,
            transition: 'all 0.2s ease',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(200,149,108,0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(200,149,108,0.3)';
          }}>
            Upload a course
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
          <span style={{ fontSize: 13, color: T.textDim, fontWeight: 500 }}>
            No sign-up required
          </span>
        </div>
      </section>

      {/* ═══════════ INDUSTRY STRIP ═══════════ */}
      <section style={{
        borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
        padding: '28px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 40, flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 11, color: T.textDim, fontWeight: 600,
          textTransform: 'uppercase' as const, letterSpacing: 2,
        }}>Built for regulated industries</span>
        {industries.map(ind => (
          <span key={ind} style={{
            fontSize: 13, color: T.textMuted, fontWeight: 500,
            letterSpacing: -0.1,
          }}>{ind}</span>
        ))}
      </section>

      {/* ═══════════ FEATURES GRID ═══════════ */}
      <section style={{
        maxWidth: 920, margin: '0 auto', padding: '100px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            fontSize: 11, color: T.accent, fontWeight: 700,
            textTransform: 'uppercase' as const, letterSpacing: 3,
            marginBottom: 12,
          }}>How it works</div>
          <h2 style={{
            fontFamily: T.serif, fontSize: 38, color: T.text,
            lineHeight: 1.15, fontWeight: 400, fontStyle: 'italic',
          }}>
            Two engines. One platform.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}>
          {features.map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} desc={f.desc} delay={i * 100} />
          ))}
        </div>
      </section>

      {/* ═══════════ BOTTOM CTA ═══════════ */}
      <section style={{
        borderTop: `1px solid ${T.border}`,
        padding: '80px 24px',
        textAlign: 'center',
      }}>
        <h3 style={{
          fontFamily: T.serif, fontSize: 32, color: T.text,
          fontWeight: 400, fontStyle: 'italic', marginBottom: 12,
        }}>
          Stop shipping outdated training.
        </h3>
        <p style={{
          fontSize: 15, color: T.textMuted, marginBottom: 32,
          maxWidth: 400, margin: '0 auto 32px',
        }}>
          Upload a course and see what CourseCorrect finds — in under a minute.
        </p>
        <button onClick={onStart} style={{
          padding: '14px 30px', borderRadius: 10,
          border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${T.accent}, #a07850)`,
          color: '#fff', fontSize: 15, fontWeight: 700,
          fontFamily: T.sans, letterSpacing: -0.2,
          boxShadow: `0 4px 24px rgba(200,149,108,0.3)`,
          transition: 'all 0.2s ease',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(200,149,108,0.4)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(200,149,108,0.3)';
        }}>
          Transform Your Content
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>
      </section>

      {/* Footer line */}
      <div style={{
        padding: '24px 32px', borderTop: `1px solid ${T.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: T.textDim }}>
          CourseCorrect — Google Gemini 3 Hackathon
        </span>
        <span style={{ fontSize: 11, color: T.textDim }}>
          Powered by Gemini
        </span>
      </div>

      <style>{`
        @keyframes cc-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes cc-fade {
          0%, 100% { opacity: 0; }
          30%, 70% { opacity: 1; }
        }
        * { box-sizing: border-box; margin: 0; }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(200,149,108,0.3); color: #f5f0e0; }
      `}</style>
    </div>
  );
};

export default LandingPage;
