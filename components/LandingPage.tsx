import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRight, ChevronDown, Sun, Moon, Shield, Palette, Upload, Search, Sparkles, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface LandingPageProps {
  onStart: () => void;
  onSignIn?: () => void;
}

// ─── Logo SVG ───
function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF6B5B" />
          <stop offset="50%" stopColor="#4A3AFF" />
          <stop offset="100%" stopColor="#00C9A7" />
        </linearGradient>
      </defs>
      <path
        d="M 8 34 C 6 24, 12 10, 22 12 C 32 14, 34 26, 26 30 C 18 34, 12 26, 16 18 C 19 12, 26 8, 33 6"
        stroke="url(#logo-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 30 3.5 L 34 6 L 30.5 8.5"
        stroke="#00C9A7"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ─── Slide Dots Navigation ───
function SlideDots({ total, current, onNavigate }: { total: number; current: number; onNavigate: (i: number) => void }) {
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onNavigate(i)}
          className={`w-2 h-2 rounded-full transition-all duration-300 ${
            i === current
              ? 'bg-accent scale-125 shadow-lg shadow-accent/30'
              : 'bg-text-muted/30 hover:bg-text-muted/60'
          }`}
          aria-label={`Go to slide ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ─── Old Document (Before Side) ───
function OldDocument() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#eee8da', fontFamily: "'Courier New', monospace" }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E")` }} />
      <div style={{ width: 340, padding: '36px 30px', background: '#faf6ee', border: '1px solid #cec7b4', boxShadow: '6px 6px 0px #d4cfc0, 0 20px 40px rgba(0,0,0,0.08)', position: 'relative', transform: 'rotate(-1.2deg)' }}>
        <div style={{ position: 'absolute', top: 14, right: 20, width: 48, height: 48, borderRadius: '50%', border: '2.5px solid rgba(139,109,71,0.12)', background: 'radial-gradient(circle, rgba(139,109,71,0.05) 0%, transparent 70%)' }} />
        <div style={{ fontSize: 10, color: '#9a9080', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8 }}>REV 3.2 — SEPT 2019</div>
        <h3 style={{ fontFamily: "'Times New Roman', serif", fontSize: 20, color: '#3d3529', marginBottom: 16, lineHeight: 1.25, fontWeight: 700 }}>Fall Protection &<br/>Safety Procedures</h3>
        <div style={{ borderTop: '1px solid #d4cfc2', marginBottom: 16 }} />
        {[{ w: '100%', o: 0.42 }, { w: '90%', o: 0.36 }, { w: '96%', o: 0.30 }, { w: '65%', o: 0.24 }, { w: '100%', o: 0.22 }, { w: '88%', o: 0.18 }, { w: '55%', o: 0.15 }].map((l, i) => (
          <div key={i} style={{ height: 7, width: l.w, borderRadius: 1.5, marginBottom: 5.5, background: `rgba(61,53,41,${l.o})` }} />
        ))}
        <div style={{ marginTop: 18, borderTop: '1px solid #d4cfc2', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b8462a', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b8462a" strokeWidth="2.5"><path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            NON-COMPLIANT — Missing 2024 guardrail specs
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: -18, right: -14, background: '#fff8a0', padding: '8px 12px', transform: 'rotate(3.5deg)', boxShadow: '2px 3px 8px rgba(0,0,0,0.1)', fontSize: 11, color: '#6b6400', fontFamily: "'Comic Sans MS', cursive", lineHeight: 1.35 }}>
          needs updating!!<br/>— Karen
        </div>
      </div>
    </div>
  );
}

// ─── New Content (After Side) ───
function NewContent() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #0c0b09 0%, #151410 50%, #13120e 100%)' }}>
      <div style={{ position: 'absolute', top: '15%', right: '15%', width: 300, height: 300, borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(255,107,91,0.08) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: '10%', left: '25%', width: 240, height: 240, borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(0,201,167,0.08) 0%, transparent 70%)' }} />
      <div style={{ width: 350, position: 'relative', zIndex: 1 }}>
        <div style={{ background: 'rgba(255,248,230,0.04)', border: '1px solid rgba(255,248,230,0.08)', borderRadius: 14, padding: 18, backdropFilter: 'blur(20px)' }}>
          <div style={{ background: 'linear-gradient(135deg, #FF6B5B, #4A3AFF)', borderRadius: 11, padding: '20px 18px', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -24, right: -24, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 8, fontWeight: 600 }}>Module 1 of 5</div>
            <div style={{ fontSize: 19, fontWeight: 600, color: '#fff', lineHeight: 1.25 }}>Fall Protection:<br/>Updated Standards</div>
            <div style={{ marginTop: 14, display: 'flex', gap: 3 }}>
              {[1, 2, 3, 4, 5].map(i => (<div key={i} style={{ height: 2.5, flex: 1, borderRadius: 3, background: i === 1 ? '#fff' : 'rgba(255,255,255,0.2)' }} />))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            {[{ label: 'Guardrails', sub: '1926.502' }, { label: 'Harnesses', sub: '1926.502(d)' }, { label: 'Inspections', sub: 'Annual' }].map((item, i) => (
              <div key={i} style={{ flex: 1, background: 'rgba(255,248,230,0.04)', border: '1px solid rgba(255,248,230,0.08)', borderRadius: 9, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#f5f0e0', fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 9, color: 'rgba(245,240,224,0.3)', letterSpacing: 0.3 }}>{item.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.25)', borderRadius: 8 }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#00C9A7" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
            <span style={{ fontSize: 10.5, color: '#00C9A7', fontWeight: 600 }}>Verified against 2024 OSHA 1926 Subpart M</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Landing Page ───
const LandingPage: React.FC<LandingPageProps> = ({ onStart, onSignIn }) => {
  const { theme, toggleTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseFading, setPhraseFading] = useState(false);
  const TOTAL_SLIDES = 5;
  const PHRASES = ['are outdated.', 'need a refresh.', 'aren\u2019t cutting it.'];

  useEffect(() => { setTimeout(() => setLoaded(true), 100); }, []);

  // Rotating headline
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseFading(true);
      setTimeout(() => { setPhraseIndex(prev => (prev + 1) % PHRASES.length); setPhraseFading(false); }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Track current slide via IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sections = container.querySelectorAll('section');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = Array.from(sections).indexOf(entry.target as HTMLElement);
          if (idx >= 0) setCurrentSlide(idx);
        }
      });
    }, { root: container, threshold: 0.6 });
    sections.forEach(s => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); navigateSlide(currentSlide + 1); }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); navigateSlide(currentSlide - 1); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentSlide]);

  const navigateSlide = useCallback((idx: number) => {
    const container = containerRef.current;
    if (!container) return;
    const clamped = Math.max(0, Math.min(TOTAL_SLIDES - 1, idx));
    const sections = container.querySelectorAll('section');
    sections[clamped]?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Slider logic
  const sliderRef = useRef<HTMLDivElement>(null);
  const updateSlider = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
    if (!hasInteracted) setHasInteracted(true);
  }, [hasInteracted]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => { if (!isDragging) return; e.preventDefault(); updateSlider('touches' in e ? e.touches[0].clientX : e.clientX); };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleUp); };
  }, [isDragging, updateSlider]);

  // Idle oscillation for slider
  useEffect(() => {
    if (hasInteracted) return;
    let frame: number; let t = 0;
    const animate = () => { t += 0.01; setSliderPos(50 + Math.sin(t) * 5); frame = requestAnimationFrame(animate); };
    const timeout = setTimeout(() => { frame = requestAnimationFrame(animate); }, 2000);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [hasInteracted]);

  return (
    <div
      ref={containerRef}
      className="h-screen overflow-y-scroll slide-container bg-background"
    >
      {/* ── Fixed Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 py-5 bg-background/80 backdrop-blur-md border-b border-surface-border/50">
        <div className="flex items-center gap-3">
          <LogoMark size={28} />
          <span className="text-base font-bold text-text-primary tracking-tight">Course Correction</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          {onSignIn && (
            <button onClick={onSignIn} className="text-sm font-medium text-text-muted hover:text-accent transition-colors">
              Sign In
            </button>
          )}
          <button onClick={onStart} className="px-5 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm">
            Try the demo
          </button>
        </div>
      </nav>

      {/* ── Slide Dots ── */}
      <SlideDots total={TOTAL_SLIDES} current={currentSlide} onNavigate={navigateSlide} />

      {/* ═══ SLIDE 1: Hero ═══ */}
      <section className="h-screen flex flex-col items-center justify-center px-6 pt-20 pb-10 relative">
        {/* Badge */}
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold border mb-8 transition-all duration-700 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'} bg-success/10 text-success border-success/20`}>
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Built for the Gemini 3 Hackathon
        </div>

        {/* Headline */}
        <div className={`text-center max-w-2xl mb-10 transition-all duration-700 delay-150 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-5xl md:text-6xl font-extrabold text-text-primary leading-[1.08] tracking-tight mb-5">
            Your training materials<br/>
            <span
              className="bg-gradient-to-r from-accent via-[#4A3AFF] to-success bg-clip-text text-transparent transition-all duration-400"
              style={{ opacity: phraseFading ? 0 : 1, transform: phraseFading ? 'translateY(6px)' : 'translateY(0)', display: 'inline-block', transition: 'opacity 0.4s ease, transform 0.4s ease' }}
            >
              {PHRASES[phraseIndex]}
            </span>
          </h1>
          <p className="text-lg text-text-muted max-w-lg mx-auto leading-relaxed">
            Course Correction scans your safety courses for outdated regulations and stale designs, then rebuilds them into modern, interactive training.
          </p>
        </div>

        {/* Before / After Slider */}
        <div className={`w-full max-w-3xl transition-all duration-800 delay-300 ${loaded ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.98]'}`}>
          <div
            ref={sliderRef}
            className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-surface-border cursor-default select-none"
            style={{ height: 420 }}
            onClick={e => { if (!isDragging) updateSlider(e.clientX); }}
          >
            <div className="absolute inset-0 z-[1]"><OldDocument /></div>
            <div className="absolute inset-0 z-[2]" style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}><NewContent /></div>

            {/* Labels */}
            <div className={`absolute top-4 left-4 z-[3] px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-opacity duration-300 ${sliderPos > 15 ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'rgba(61,53,41,0.85)', color: '#d4cfc2' }}>Before</div>
            <div className={`absolute top-4 right-4 z-[3] px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm transition-opacity duration-300 ${sliderPos < 85 ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'rgba(255,107,91,0.15)', color: '#FF6B5B' }}>After</div>

            {/* Handle */}
            <div
              className="absolute top-0 bottom-0 z-10 flex flex-col items-center justify-center cursor-grab"
              style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
              onMouseDown={e => { e.preventDefault(); setIsDragging(true); }}
              onTouchStart={() => setIsDragging(true)}
            >
              <div className="absolute top-0 bottom-0 w-0.5" style={{ background: 'linear-gradient(180deg, transparent, rgba(255,107,91,0.6), rgba(74,58,255,0.8), rgba(0,201,167,0.6), transparent)' }} />
              <div className={`w-10 h-10 rounded-full flex items-center justify-center relative z-10 transition-transform duration-150 border-[3px] border-white shadow-lg ${isDragging ? 'scale-110' : 'scale-100'}`} style={{ background: 'linear-gradient(135deg, #FF6B5B, #4A3AFF)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M8 6l-4 6 4 6" /><path d="M16 6l4 6-4 6" /></svg>
              </div>
              {!hasInteracted && (
                <div className="absolute bottom-8 whitespace-nowrap text-[11px] text-text-muted font-medium bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full animate-pulse">
                  Drag to compare
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className={`flex gap-4 items-center mt-8 transition-all duration-700 delay-500 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <button onClick={onStart} className="px-7 py-3.5 rounded-xl font-bold text-white text-[15px] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #FF6B5B, #4A3AFF)' }}>
            Upload a course
            <ArrowRight className="w-4 h-4" />
          </button>
          <span className="text-sm text-text-muted">No sign-up required</span>
        </div>

        {/* Scroll hint */}
        <button onClick={() => navigateSlide(1)} className="absolute bottom-8 text-text-muted/40 hover:text-text-muted transition-colors animate-bounce">
          <ChevronDown className="w-5 h-5" />
        </button>
      </section>

      {/* ═══ SLIDE 2: The Problem ═══ */}
      <section className="h-screen flex items-center justify-center px-6 relative">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">The Problem</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-text-primary tracking-tight leading-tight">
              Course decay is<br/><span className="bg-gradient-to-r from-accent to-warning bg-clip-text text-transparent">universal.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Regulatory Decay */}
            <div className="bg-card border border-surface-border rounded-2xl p-8 hover:border-accent/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-5">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-3">Regulatory Decay</h3>
              <p className="text-text-muted leading-relaxed text-[15px]">
                Regulations update, compliance requirements evolve, statistics become stale. Your 2022 OSHA training is already citing superseded standards.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {['OSHA', 'HIPAA', 'FDA', 'DOT'].map(tag => (
                  <span key={tag} className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md bg-accent/8 text-accent border border-accent/15">{tag}</span>
                ))}
              </div>
            </div>

            {/* Visual Decay */}
            <div className="bg-card border border-surface-border rounded-2xl p-8 hover:border-success/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mb-5">
                <Palette className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-3">Visual Decay</h3>
              <p className="text-text-muted leading-relaxed text-[15px]">
                Text-heavy PDFs and bullet-point slides from 2019. Your learners deserve interactive modules, not walls of text with clip art.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {['PDFs', 'Slideshows', 'Manuals', 'Videos'].map(tag => (
                  <span key={tag} className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md bg-success/8 text-success border border-success/15">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SLIDE 3: Two Engines ═══ */}
      <section className="h-screen flex items-center justify-center px-6 relative">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#4A3AFF] mb-3">The Solution</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-text-primary tracking-tight leading-tight">
              Two engines.<br/><span className="bg-gradient-to-r from-[#4A3AFF] to-success bg-clip-text text-transparent">One platform.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-card border border-surface-border rounded-2xl p-8 relative overflow-hidden group hover:border-accent/30 transition-colors">
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-accent/5 group-hover:bg-accent/10 transition-colors" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Search className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">Regulatory Hound</h3>
                    <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Engine 1</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    'Reads every fact, citation, and regulation',
                    'Cross-checks against live government sources',
                    'Outputs a redline report with proposed rewrites',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[15px] text-text-muted">
                      <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-card border border-surface-border rounded-2xl p-8 relative overflow-hidden group hover:border-success/30 transition-colors">
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-success/5 group-hover:bg-success/10 transition-colors" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">Visual Alchemist</h3>
                    <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Engine 2</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    'Analyzes text-heavy slides and documents',
                    'Converts to interactive modules and timelines',
                    'Generates modern visuals with AI imagery',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[15px] text-text-muted">
                      <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SLIDE 4: How It Works ═══ */}
      <section className="h-screen flex items-center justify-center px-6 relative">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-success mb-3">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-text-primary tracking-tight leading-tight">
              Three steps.<br/><span className="bg-gradient-to-r from-success to-[#4A3AFF] bg-clip-text text-transparent">Under a minute.</span>
            </h2>
          </div>

          <div className="flex flex-col md:flex-row items-stretch gap-6">
            {[
              { step: '01', icon: Upload, title: 'Upload', desc: 'Drop in your PDF, PPT, or DOC. We handle the rest.', color: 'accent' },
              { step: '02', icon: Search, title: 'Analyze', desc: 'AI scans for outdated regulations, stale facts, and design issues.', color: '[#4A3AFF]' },
              { step: '03', icon: Sparkles, title: 'Transform', desc: 'Get modernized slides with verified citations and fresh visuals.', color: 'success' },
            ].map(({ step, icon: Icon, title, desc, color }) => (
              <div key={step} className="flex-1 bg-card border border-surface-border rounded-2xl p-7 text-center hover:border-surface-border transition-all group">
                <div className={`text-[11px] font-bold uppercase tracking-[0.2em] text-${color} mb-4`}>{step}</div>
                <div className={`w-14 h-14 rounded-2xl bg-${color}/10 flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-6 h-6 text-${color}`} />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Industries strip */}
          <div className="mt-12 flex items-center justify-center gap-6 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-semibold">Built for</span>
            {['Construction', 'Healthcare', 'Manufacturing', 'Food Service', 'Transportation'].map(ind => (
              <span key={ind} className="text-sm text-text-muted/70">{ind}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SLIDE 5: CTA ═══ */}
      <section className="h-screen flex items-center justify-center px-6 relative">
        <div className="text-center max-w-xl">
          <LogoMark size={48} />
          <h2 className="text-4xl md:text-5xl font-extrabold text-text-primary tracking-tight leading-tight mt-8 mb-4">
            Stop shipping<br/>outdated training.
          </h2>
          <p className="text-lg text-text-muted mb-10 leading-relaxed">
            Upload a course and see what Course Correction finds — in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <button onClick={onStart} className="px-8 py-4 rounded-xl font-bold text-white text-[15px] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #FF6B5B, #4A3AFF)' }}>
              Upload a Course
              <ArrowRight className="w-4 h-4" />
            </button>
            {onSignIn && (
              <button onClick={onSignIn} className="px-8 py-4 rounded-xl font-bold text-sm text-text-muted border border-surface-border hover:border-accent/30 hover:text-accent transition-all">
                Sign In
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="mt-20 flex justify-center items-center gap-6 text-[11px] text-text-muted/50">
            <span>Course Correction</span>
            <span>Google Gemini 3 Hackathon</span>
            <span>Powered by Gemini</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
