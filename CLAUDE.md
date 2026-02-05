# CourseCorrect

**The self-healing, self-updating engine for your entire course library.**

## Overview

CourseCorrect is an AI-powered course modernization platform built for the **Google Gemini 3 Hackathon**. It addresses a massive, universal pain point in corporate training and education: **Course Decay**.

Courses immediately start becoming obsolete the moment they are published, either because:
- **Regulatory Decay**: Facts change, regulations update, compliance requirements evolve
- **Visual Decay**: Design trends evolve, making courses look dated and unengaging

CourseCorrect uses advanced AI to ingest existing course materials, analyze them for both factual accuracy and visual engagement, and automatically generate modernized versions ready for human review and deployment.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API (`@google/genai`)
  - `gemini-3-pro-preview` - Multimodal course analysis
  - `gemini-3-flash-preview` - Fast content generation, regulatory updates
  - `gemini-2.5-flash` - Maps grounding for jurisdiction lookup
  - `gemini-2.5-flash-image` - Asset/image generation
  - `gemini-2.5-flash-native-audio-preview` - Live voice assistant
- **Icons**: Lucide React
- **Charts**: Recharts

## Project Structure

```
coursecorrect/
├── components/
│   ├── LandingPage.tsx      # Infinite canvas with AI-generated use case cards
│   ├── DemoFlow.tsx         # 3-step demo wizard
│   ├── IngestionZone.tsx    # File upload & project creation
│   ├── ConfigurationZone.tsx # Goal & context configuration
│   ├── DiagnosisDashboard.tsx # Analysis results visualization
│   ├── RegulatoryView.tsx   # Regulatory compliance updates
│   ├── VisualView.tsx       # Visual transformation studio
│   ├── ExportView.tsx       # Export to SCORM/xAPI
│   ├── Sidebar.tsx          # Navigation
│   └── LiveAssistant.tsx    # Real-time voice consultation
├── services/
│   └── geminiService.ts     # All Gemini API integrations
├── types.ts                 # TypeScript interfaces
├── App.tsx                  # Main app with routing
└── .env.local               # GEMINI_API_KEY (gitignored)
```

## The Dual-Engine Approach

### Engine 1: The "Regulatory Hound" (Content & Fact Updating)
- Reads existing course text and identifies facts, regulations, statistics
- Uses **Google Search Grounding** to verify against current standards
- Uses **Maps Grounding** to identify local Authority Having Jurisdiction (AHJ)
- Outputs a "Redline Report" with citations and proposed rewrites

### Engine 2: The "Visual Alchemist" (Engagement & Design Updating)
- Analyzes text-heavy slides, PDFs, or documents
- Converts dense paragraphs into interactive elements (accordions, timelines, flip cards)
- Uses **Gemini Image Generation** to create modern visuals
- Suggests high-quality imagery to replace outdated stock photos

## Current Features

### Landing Page
- Infinite draggable canvas with 30 static use case cards
- Cards arranged in 25% staggered grid pattern around center hero
- AI generates new cards when users explore beyond initial view
- Showcases diverse industry examples (Aviation, Healthcare, Legal, etc.)

### Demo Flow
- 3-step wizard: Topic → Location → Style → Generated slides
- Supports file upload (PDF, images)
- Geolocation for regional compliance

### Full App Flow
1. **Ingestion**: Drag-and-drop multi-format support (PPT, PDF, DOC, video)
2. **Configuration**: Set goal (Regulatory/Visual/Full), audience, standards context
3. **Diagnosis**: Dashboard with Freshness Score and Engagement Score
4. **Regulatory View**: Side-by-side diff with citations from live search
5. **Visual View**: Transformation suggestions with AI asset generation
6. **Export**: SCORM 1.2 / xAPI package generation

### Live Voice Assistant
- Real-time audio consultation using Gemini Live Audio API
- Acts as an Instructional Designer consultant
- Helps users plan course updates

## Gemini API Usage

| Feature | Model | Grounding |
|---------|-------|-----------|
| Course Analysis | gemini-3-pro-preview | - |
| Regulatory Updates | gemini-3-flash-preview | Google Search |
| Jurisdiction Lookup | gemini-2.5-flash | Google Maps |
| Visual Suggestions | gemini-3-flash-preview | - |
| Image Generation | gemini-2.5-flash-image | - |
| Landing Page Cards | gemini-3-flash-preview | - |
| Voice Assistant | gemini-2.5-flash-native-audio | - |

## Future Goals

### Phase 1: Core Platform (Current)
- [x] Landing page with AI-generated use cases
- [x] Multi-format file ingestion
- [x] Dual-engine analysis (Regulatory + Visual)
- [x] Live voice assistant
- [ ] Working SCORM/xAPI export

### Phase 2: Enhanced Intelligence
- [ ] Video transcript analysis and chapter generation
- [ ] Automatic quiz/assessment generation from content
- [ ] Multi-language support with translation
- [ ] Accessibility compliance checking (WCAG)
- [ ] Version control and change tracking

### Phase 3: Enterprise Features
- [ ] LMS integrations (Workday, Cornerstone, Canvas)
- [ ] Team collaboration and review workflows
- [ ] Custom branding and white-labeling
- [ ] API for programmatic course updates
- [ ] Scheduled auto-refresh for regulatory content

### Phase 4: Advanced AI
- [ ] Fine-tuned models for specific industries
- [ ] Predictive decay scoring (when will content become outdated?)
- [ ] AI-generated video narration with avatars
- [ ] Interactive scenario builder with branching logic
- [ ] Learner analytics and adaptive content paths

## Target Market

- **L&D Departments in Regulated Industries**: Finance, Healthcare, Construction, Aviation
- **Corporate HR**: Rapidly growing companies with stale onboarding materials
- **Course Creators/Agencies**: Service providers managing large course libraries

## Running the App

```bash
# Install dependencies
npm install

# Add your Gemini API key to .env.local
GEMINI_API_KEY=your-key-here

# Start dev server
npm run dev

# Build for production
npm run build
```

## Key Design Decisions

1. **Static initial cards**: Pre-generated cards load instantly; AI only generates when exploring
2. **Session storage caching**: Generated cards persist in browser tab
3. **Fallback to static**: If Gemini API fails, gracefully falls back to procedural generation
4. **Orbital card layout**: Cards arranged in concentric rings around hero with faded outer rings

## Landing Page Content Guidelines

### Two Categories Only
- **Regulatory**: Compliance updates, regulation changes, outdated safety standards
- **Visual**: Format transformations (PDF/PPT → Interactive modules)

### Target Industries (Regulated/Safety-Critical)
- Healthcare (HIPAA, infection control, patient handling)
- Construction/Trades (OSHA 10/30, fall protection, tool safety)
- Manufacturing (lockout/tagout, machine guarding)
- Food Service (FDA food codes, allergens)
- Transportation/Logistics (DOT, FMCSA)

### Course Types to Feature
- Safety & Compliance training
- Technical/Certification courses
- Role-specific & Safety onboarding

### Content to AVOID
- Soft skills (leadership, communication, time management)
- HR policies (PTO, dress code, benefits enrollment)
- Marketing/Sales training
- Generic corporate content

### Language Style
- **Landing page**: Plain language, accessible to L&D managers
- **Actual app**: Specific citations with regulation numbers, last-updated dates, and source links (e.g., "OSHA 1910.134(c)(2) - Updated Jan 2024")
