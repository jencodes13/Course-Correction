import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Zap, ArrowRight, Sparkles, Check, AlertTriangle, RotateCcw } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

interface FloatingCard {
  id: string;
  x: number;
  y: number;
  rotation: number;
  title: string;
  beforeText: string;
  afterText: string;
  category: 'regulatory' | 'visual';
  isFixed: boolean;
  ring: number; // 0 = inner (full opacity), 1+ = outer (faded)
}

// 100 use cases focused on safety, compliance, and technical training
// TWO CATEGORIES: Regulatory (compliance updates) and Visual (format transformation)
const USE_CASES: { title: string; beforeText: string; afterText: string; category: 'regulatory' | 'visual' }[] = [
  // ========== REGULATORY - Safety & Compliance (50) ==========
  // OSHA / Workplace Safety
  { title: "Forklift Operator Certification", beforeText: "Outdated load capacity standards", afterText: "Current OSHA requirements applied", category: 'regulatory' },
  { title: "Fall Protection Training", beforeText: "Missing guardrail specifications", afterText: "Updated fall arrest requirements", category: 'regulatory' },
  { title: "Lockout/Tagout Procedures", beforeText: "Generic equipment examples", afterText: "Machine-specific procedures added", category: 'regulatory' },
  { title: "Confined Space Entry", beforeText: "Missing permit requirements", afterText: "Entry permit procedures updated", category: 'regulatory' },
  { title: "Scaffolding Safety", beforeText: "Old inspection checklist", afterText: "Current competent person reqs", category: 'regulatory' },
  { title: "Aerial Lift Operations", beforeText: "Pre-2020 standards", afterText: "Current boom/scissor lift rules", category: 'regulatory' },
  { title: "Crane Operator Training", beforeText: "Outdated signal procedures", afterText: "Updated hand signal standards", category: 'regulatory' },
  { title: "Powered Industrial Trucks", beforeText: "Missing pedestrian rules", afterText: "Pedestrian safety zones added", category: 'regulatory' },
  { title: "Electrical Safety (NFPA 70E)", beforeText: "Old arc flash boundaries", afterText: "2024 arc flash updates applied", category: 'regulatory' },
  { title: "Excavation & Trenching", beforeText: "Outdated soil classifications", afterText: "Current protective systems", category: 'regulatory' },

  // Healthcare
  { title: "HIPAA Privacy Training", beforeText: "Pre-2022 Privacy Rule", afterText: "Information blocking rules added", category: 'regulatory' },
  { title: "Infection Control Procedures", beforeText: "Pre-COVID protocols", afterText: "Current CDC guidelines applied", category: 'regulatory' },
  { title: "Bloodborne Pathogen Training", beforeText: "Outdated exposure procedures", afterText: "Current post-exposure protocols", category: 'regulatory' },
  { title: "Patient Handling & Mobility", beforeText: "Old lift equipment refs", afterText: "Safe patient handling updates", category: 'regulatory' },
  { title: "Medication Administration", beforeText: "Missing barcode scanning", afterText: "BCMA procedures added", category: 'regulatory' },
  { title: "Emergency Code Procedures", beforeText: "Outdated response protocols", afterText: "Current code team procedures", category: 'regulatory' },
  { title: "Hand Hygiene Compliance", beforeText: "Old WHO guidelines", afterText: "Current 5 Moments updated", category: 'regulatory' },
  { title: "Sterile Processing Training", beforeText: "Missing reprocessing reqs", afterText: "Current sterilization standards", category: 'regulatory' },
  { title: "Radiation Safety for Staff", beforeText: "Outdated exposure limits", afterText: "Current ALARA principles", category: 'regulatory' },
  { title: "Patient Rights & EMTALA", beforeText: "Missing recent updates", afterText: "Current patient rights applied", category: 'regulatory' },

  // Food Safety
  { title: "Food Handler Certification", beforeText: "Old temperature danger zone", afterText: "Current FDA food code temps", category: 'regulatory' },
  { title: "Allergen Awareness Training", beforeText: "Missing FALCPA updates", afterText: "Big 9 allergens covered", category: 'regulatory' },
  { title: "HACCP Plan Training", beforeText: "Outdated critical limits", afterText: "Current monitoring procedures", category: 'regulatory' },
  { title: "ServSafe Recertification", beforeText: "Pre-2022 content", afterText: "Latest ServSafe curriculum", category: 'regulatory' },
  { title: "Kitchen Equipment Safety", beforeText: "Missing new equipment", afterText: "Current equipment procedures", category: 'regulatory' },
  { title: "Food Storage Procedures", beforeText: "Old FIFO examples", afterText: "Updated storage requirements", category: 'regulatory' },
  { title: "Pest Control Awareness", beforeText: "Outdated IPM practices", afterText: "Current prevention methods", category: 'regulatory' },
  { title: "Sanitation & Cleaning", beforeText: "Old chemical mixing ratios", afterText: "Current sanitizer concentrations", category: 'regulatory' },

  // Construction / Trades
  { title: "OSHA 10-Hour Construction", beforeText: "Missing silica updates", afterText: "Silica exposure rules added", category: 'regulatory' },
  { title: "OSHA 30-Hour Construction", beforeText: "Outdated case studies", afterText: "Recent incident analysis", category: 'regulatory' },
  { title: "Hazard Communication (GHS)", beforeText: "Old SDS format examples", afterText: "Current GHS label requirements", category: 'regulatory' },
  { title: "Respiratory Protection", beforeText: "Pre-COVID fit testing", afterText: "Current respirator selection", category: 'regulatory' },
  { title: "Hearing Conservation", beforeText: "Outdated exposure limits", afterText: "Current audiometric testing", category: 'regulatory' },
  { title: "Heat Illness Prevention", beforeText: "Missing work/rest cycles", afterText: "Heat index protocols added", category: 'regulatory' },
  { title: "Cold Stress Training", beforeText: "Incomplete frostbite info", afterText: "Current prevention measures", category: 'regulatory' },
  { title: "Asbestos Awareness", beforeText: "Old abatement procedures", afterText: "Current Class I-IV work rules", category: 'regulatory' },
  { title: "Lead Safety in Construction", beforeText: "Missing blood testing reqs", afterText: "Medical surveillance updated", category: 'regulatory' },
  { title: "Silica Dust Exposure", beforeText: "Pre-2018 PEL standards", afterText: "Current exposure limits applied", category: 'regulatory' },

  // Manufacturing
  { title: "Machine Guarding Training", beforeText: "Generic guard examples", afterText: "Equipment-specific guards", category: 'regulatory' },
  { title: "Press & Die Safety", beforeText: "Missing PSR requirements", afterText: "Presence sensing devices added", category: 'regulatory' },
  { title: "Robot Safety Training", beforeText: "Outdated safeguarding", afterText: "Collaborative robot rules added", category: 'regulatory' },
  { title: "Conveyor Safety", beforeText: "Missing emergency stops", afterText: "E-stop requirements updated", category: 'regulatory' },
  { title: "Welding & Hot Work", beforeText: "Old fire watch procedures", afterText: "Current permit requirements", category: 'regulatory' },
  { title: "Compressed Gas Safety", beforeText: "Outdated storage rules", afterText: "Current cylinder handling", category: 'regulatory' },
  { title: "Chemical Handling Training", beforeText: "Missing spill response", afterText: "Spill containment updated", category: 'regulatory' },
  { title: "Ergonomics & MSD Prevention", beforeText: "Office-only focus", afterText: "Manufacturing tasks added", category: 'regulatory' },

  // Transportation / Logistics
  { title: "DOT Hazmat Training", beforeText: "Pre-2020 shipping rules", afterText: "Current marking/labeling reqs", category: 'regulatory' },
  { title: "Driver Safety (FMCSA)", beforeText: "Missing ELD requirements", afterText: "Hours of service updated", category: 'regulatory' },
  { title: "Defensive Driving Course", beforeText: "Outdated accident stats", afterText: "Current distraction data", category: 'regulatory' },
  { title: "Loading Dock Safety", beforeText: "Missing dock lock procedures", afterText: "Trailer restraint rules added", category: 'regulatory' },

  // ========== VISUAL - Format Transformation (50) ==========
  // Safety Training Transformations
  { title: "Fire Extinguisher Training", beforeText: "Text-heavy PDF manual", afterText: "→ Interactive PASS simulator", category: 'visual' },
  { title: "First Aid Certification", beforeText: "60-slide PowerPoint", afterText: "→ Scenario-based practice", category: 'visual' },
  { title: "CPR/AED Training", beforeText: "Lecture video from 2018", afterText: "→ Step-by-step interactive", category: 'visual' },
  { title: "Emergency Evacuation", beforeText: "Static floor plan PDF", afterText: "→ 3D evacuation walkthrough", category: 'visual' },
  { title: "PPE Selection Guide", beforeText: "70-page reference manual", afterText: "→ Visual selection tool", category: 'visual' },
  { title: "Incident Reporting Training", beforeText: "Form-filling instructions", afterText: "→ Guided report builder", category: 'visual' },
  { title: "Near Miss Reporting", beforeText: "Policy document only", afterText: "→ Example-based scenarios", category: 'visual' },
  { title: "Workplace Hazard ID", beforeText: "Checklist document", afterText: "→ Photo-based spot-the-hazard", category: 'visual' },
  { title: "Job Safety Analysis", beforeText: "Blank JSA templates", afterText: "→ Interactive JSA builder", category: 'visual' },
  { title: "Toolbox Talk Materials", beforeText: "Text-only handouts", afterText: "→ Visual discussion guides", category: 'visual' },

  // Healthcare Training Transformations
  { title: "Nurse Onboarding Program", beforeText: "200-page PDF binder", afterText: "→ 12 interactive modules", category: 'visual' },
  { title: "Clinical Documentation", beforeText: "EHR screenshots in PDF", afterText: "→ Practice environment", category: 'visual' },
  { title: "Patient Assessment Skills", beforeText: "Text-based procedures", afterText: "→ Case-based simulations", category: 'visual' },
  { title: "IV Insertion Training", beforeText: "Static procedure guide", afterText: "→ Step-by-step video series", category: 'visual' },
  { title: "Wound Care Procedures", beforeText: "Photo-only reference", afterText: "→ Assessment decision tree", category: 'visual' },
  { title: "Fall Prevention Protocol", beforeText: "Policy document", afterText: "→ Risk assessment tool", category: 'visual' },
  { title: "Patient Transfer Techniques", beforeText: "Text descriptions", afterText: "→ Video demonstrations", category: 'visual' },
  { title: "Code Blue Response", beforeText: "Algorithm flowchart", afterText: "→ Timed response drill", category: 'visual' },

  // Equipment Operation Transformations
  { title: "Forklift Pre-Shift Inspection", beforeText: "Paper checklist only", afterText: "→ Visual inspection app", category: 'visual' },
  { title: "Crane Hand Signals", beforeText: "Static signal chart", afterText: "→ Interactive signal quiz", category: 'visual' },
  { title: "Heavy Equipment Orientation", beforeText: "Operator manual excerpts", afterText: "→ Controls walkthrough", category: 'visual' },
  { title: "CNC Machine Training", beforeText: "Technical documentation", afterText: "→ Simulation-based practice", category: 'visual' },
  { title: "Lab Equipment Operation", beforeText: "Manufacturer manuals", afterText: "→ Video procedure library", category: 'visual' },
  { title: "Quality Inspection Training", beforeText: "Spec sheet reference", afterText: "→ Visual defect examples", category: 'visual' },
  { title: "Calibration Procedures", beforeText: "Text-based SOP", afterText: "→ Step-by-step video guide", category: 'visual' },
  { title: "Maintenance Procedures", beforeText: "Work order instructions", afterText: "→ Visual PM checklists", category: 'visual' },

  // Technical Certification Transformations
  { title: "Electrical Apprentice Training", beforeText: "Code book excerpts", afterText: "→ Circuit-building practice", category: 'visual' },
  { title: "Plumbing Code Training", beforeText: "Code sections PDF", afterText: "→ Visual code examples", category: 'visual' },
  { title: "HVAC System Training", beforeText: "System diagrams only", afterText: "→ Troubleshooting scenarios", category: 'visual' },
  { title: "Welding Certification Prep", beforeText: "Procedure specification", afterText: "→ Technique video library", category: 'visual' },
  { title: "Blueprint Reading", beforeText: "Sample drawings PDF", afterText: "→ Interactive plan review", category: 'visual' },
  { title: "Rigging & Signaling", beforeText: "Load chart tables", afterText: "→ Visual load calculations", category: 'visual' },
  { title: "Scaffold Builder Training", beforeText: "Assembly instructions", afterText: "→ 3D assembly guide", category: 'visual' },
  { title: "PLC Programming Basics", beforeText: "Ladder logic printouts", afterText: "→ Practice programming env", category: 'visual' },

  // Food Service Transformations
  { title: "Kitchen Safety Orientation", beforeText: "Employee handbook section", afterText: "→ Station-by-station tour", category: 'visual' },
  { title: "Food Prep Procedures", beforeText: "Recipe cards only", afterText: "→ Video prep guides", category: 'visual' },
  { title: "Temperature Monitoring", beforeText: "Log sheet instructions", afterText: "→ Digital logging demo", category: 'visual' },
  { title: "Cleaning & Sanitizing", beforeText: "Chemical safety sheets", afterText: "→ Visual dilution guide", category: 'visual' },
  { title: "Cross-Contamination Prevention", beforeText: "Text-based rules", afterText: "→ Color-coded visual system", category: 'visual' },
  { title: "Receiving & Storage", beforeText: "Checklist document", afterText: "→ Inspection photo guide", category: 'visual' },

  // Role-Based Onboarding Transformations
  { title: "Warehouse Associate Onboarding", beforeText: "Paper orientation packet", afterText: "→ Interactive facility tour", category: 'visual' },
  { title: "Production Line Training", beforeText: "Work instruction binder", afterText: "→ Station-based modules", category: 'visual' },
  { title: "Lab Technician Orientation", beforeText: "SOP manual review", afterText: "→ Procedure video series", category: 'visual' },
  { title: "Maintenance Tech Onboarding", beforeText: "Equipment manuals", afterText: "→ Hands-on task modules", category: 'visual' },
  { title: "Driver Orientation Program", beforeText: "Policy handbook", afterText: "→ Route simulation training", category: 'visual' },
  { title: "Security Officer Training", beforeText: "Post orders binder", afterText: "→ Scenario response drills", category: 'visual' },
  { title: "Custodial Staff Training", beforeText: "Task list document", afterText: "→ Visual cleaning guides", category: 'visual' },
  { title: "Receiving Clerk Training", beforeText: "Procedure manual", afterText: "→ System walkthrough", category: 'visual' },
  { title: "Quality Inspector Training", beforeText: "Spec reference sheets", afterText: "→ Defect identification tool", category: 'visual' },
  { title: "Shipping & Packaging", beforeText: "Packing instructions", afterText: "→ Visual packing standards", category: 'visual' },
];

const CATEGORY_STYLES = {
  regulatory: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', label: 'Compliance' },
  visual: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', label: 'Visual' },
};

// Hero exclusion zone (ellipse)
const HERO_RX = 320;
const HERO_RY = 200;

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [cards, setCards] = useState<FloatingCard[]>([]);
  const [fixedCount, setFixedCount] = useState(0);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Get a random unused use case
  const getRandomUseCase = useCallback(() => {
    const available = USE_CASES.map((_, i) => i).filter(i => !usedIndices.has(i));
    if (available.length === 0) {
      // Reset if all used
      setUsedIndices(new Set());
      return USE_CASES[Math.floor(Math.random() * USE_CASES.length)];
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    setUsedIndices(prev => new Set([...prev, idx]));
    return USE_CASES[idx];
  }, [usedIndices]);

  // Generate initial cards
  useEffect(() => {
    const initialCards: FloatingCard[] = [];
    const usedIdx = new Set<number>();

    // Ring 0: 8 cards evenly spaced in inner ring (fully visible)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rx = 380;
      const ry = 260;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;

      let idx = Math.floor(Math.random() * USE_CASES.length);
      while (usedIdx.has(idx)) idx = (idx + 1) % USE_CASES.length;
      usedIdx.add(idx);

      initialCards.push({
        id: `ring0-${i}`,
        x, y,
        rotation: (Math.random() - 0.5) * 4,
        ...USE_CASES[idx],
        isFixed: false,
        ring: 0,
      });
    }

    // Ring 1: 12 cards (slightly faded)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2 + Math.PI / 12;
      const rx = 580;
      const ry = 400;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;

      let idx = Math.floor(Math.random() * USE_CASES.length);
      while (usedIdx.has(idx)) idx = (idx + 1) % USE_CASES.length;
      usedIdx.add(idx);

      initialCards.push({
        id: `ring1-${i}`,
        x, y,
        rotation: (Math.random() - 0.5) * 6,
        ...USE_CASES[idx],
        isFixed: false,
        ring: 1,
      });
    }

    // Ring 2: 16 cards (more faded)
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 - Math.PI / 2;
      const rx = 800;
      const ry = 560;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;

      let idx = Math.floor(Math.random() * USE_CASES.length);
      while (usedIdx.has(idx)) idx = (idx + 1) % USE_CASES.length;
      usedIdx.add(idx);

      initialCards.push({
        id: `ring2-${i}`,
        x, y,
        rotation: (Math.random() - 0.5) * 8,
        ...USE_CASES[idx],
        isFixed: false,
        ring: 2,
      });
    }

    setCards(initialCards);
    setUsedIndices(usedIdx);
    setPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  }, []);

  // Physics momentum
  useEffect(() => {
    const animate = (time: number) => {
      if (!isDragging && (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1)) {
        const delta = lastTimeRef.current ? (time - lastTimeRef.current) / 16 : 1;
        lastTimeRef.current = time;
        setPosition(prev => ({ x: prev.x + velocity.x * delta, y: prev.y + velocity.y * delta }));
        setVelocity(prev => ({ x: prev.x * 0.94, y: prev.y * 0.94 }));
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isDragging, velocity]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setVelocity({ x: 0, y: 0 });
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setVelocity({ x: dx * 0.4, y: dy * 0.4 });
    setLastMousePos({ x: e.clientX, y: e.clientY });
  }, [isDragging, lastMousePos]);

  const handleMouseUp = () => setIsDragging(false);

  const handleCardClick = (cardId: string) => {
    setCards(prev => prev.map(card => {
      if (card.id === cardId && !card.isFixed) {
        setFixedCount(c => c + 1);
        return { ...card, isFixed: true };
      }
      return card;
    }));
  };

  const handleFixAll = () => {
    const ring0Cards = cards.filter(c => c.ring === 0);
    setCards(prev => prev.map(card => card.ring === 0 ? { ...card, isFixed: true } : card));
    setFixedCount(ring0Cards.length);
  };

  const handleReset = () => {
    setCards(prev => prev.map(card => ({ ...card, isFixed: false })));
    setFixedCount(0);
  };

  const handleRecenter = () => {
    setPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setVelocity({ x: 0, y: 0 });
  };

  const ring0Cards = cards.filter(c => c.ring === 0);
  const ring0FixedCount = ring0Cards.filter(c => c.isFixed).length;

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-[#FAFAFA] relative select-none"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Nav */}
      <nav className="fixed top-5 left-5 right-5 z-50 flex justify-between items-center pointer-events-none">
        <div
          className="flex items-center gap-2.5 bg-white rounded-full px-4 py-2.5 shadow-sm border border-gray-200 pointer-events-auto cursor-pointer hover:shadow-md transition-shadow"
          onClick={handleRecenter}
        >
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">CourseCorrect</span>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {fixedCount > 0 && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 bg-white rounded-full px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
          <button
            onClick={onStart}
            className="bg-black text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            Try it free
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Canvas */}
      <div
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="absolute"
          style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        >
          {/* Hero */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none w-[500px] z-20">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-3 leading-tight">
              Your courses are{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
                out of date
              </span>
            </h1>
            <p className="text-gray-400 mb-6">
              Click any card to see the fix
            </p>
            <div className="inline-flex items-center gap-4 bg-white rounded-full px-5 py-2.5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${ring0FixedCount === ring0Cards.length ? 'bg-emerald-500' : 'bg-orange-400'}`} />
                <span className="text-sm font-medium text-gray-700">{ring0FixedCount}/{ring0Cards.length} fixed</span>
              </div>
              {ring0FixedCount < ring0Cards.length && (
                <button
                  onClick={handleFixAll}
                  className="text-sm font-medium text-orange-500 hover:text-orange-600 pointer-events-auto"
                >
                  Fix all →
                </button>
              )}
              {ring0FixedCount === ring0Cards.length && (
                <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> All done!
                </span>
              )}
            </div>
          </div>

          {/* Cards */}
          {cards.map((card) => {
            const style = CATEGORY_STYLES[card.category];
            // Fade based on ring
            const opacity = card.ring === 0 ? 1 : card.ring === 1 ? 0.5 : 0.25;
            const scale = card.ring === 0 ? 1 : card.ring === 1 ? 0.9 : 0.8;

            return (
              <div
                key={card.id}
                onClick={(e) => { e.stopPropagation(); if (card.ring === 0) handleCardClick(card.id); }}
                className={`
                  absolute w-[200px] rounded-xl p-3.5 border-2
                  transition-all duration-300 ease-out
                  ${card.ring === 0 ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
                  ${card.isFixed
                    ? 'bg-emerald-50 border-emerald-400 shadow-lg'
                    : 'bg-white hover:shadow-xl'
                  }
                  ${card.ring === 0 && !card.isFixed ? 'hover:scale-105 hover:-translate-y-1' : ''}
                `}
                style={{
                  left: card.x,
                  top: card.y,
                  transform: `translate(-50%, -50%) rotate(${card.isFixed ? 0 : card.rotation}deg) scale(${card.isFixed ? 1.02 : scale})`,
                  borderColor: card.isFixed ? '#34d399' : style.border,
                  opacity: card.isFixed ? 1 : opacity,
                  zIndex: card.ring === 0 ? 10 : 5 - card.ring,
                }}
              >
                {/* Badge */}
                <div
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide mb-2"
                  style={{
                    backgroundColor: card.isFixed ? '#d1fae5' : style.bg,
                    color: card.isFixed ? '#065f46' : style.text,
                  }}
                >
                  {card.isFixed ? <Check className="w-3 h-3" /> : null}
                  {card.isFixed ? 'Fixed' : style.label}
                </div>

                {/* Title */}
                <h3 className={`font-semibold text-sm mb-1.5 leading-tight ${card.isFixed ? 'text-emerald-900' : 'text-gray-900'}`}>
                  {card.title}
                </h3>

                {/* Before/After text */}
                <p className={`text-xs leading-relaxed ${card.isFixed ? 'text-emerald-700' : 'text-gray-500'}`}>
                  {card.isFixed ? (
                    <span className="flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 mt-0.5 text-emerald-500 flex-shrink-0" />
                      {card.afterText}
                    </span>
                  ) : (
                    <span className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                      {card.beforeText}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Corner hints */}
      <div className="fixed bottom-4 left-4 text-xs text-gray-400">
        Drag to explore more
      </div>
      <div className="fixed bottom-4 right-4 text-xs text-gray-400">
        Built for Gemini Hackathon
      </div>

      {/* Soft vignette */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(250,250,250,0.95) 100%)' }}
      />
    </div>
  );
};

export default LandingPage;
