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
- **Backend**: Supabase (PostgreSQL + Edge Functions + Storage)
- **AI**: Google Gemini API (via Supabase Edge Functions with direct fallback)
  - `gemini-3-pro-preview` - Multimodal course analysis (document scanning + scoring)
  - `gemini-3-flash-preview` - Content generation, regulatory research (with Search Grounding), jurisdiction lookup, visual transforms
  - `gemini-2.5-flash-image` - Asset/image generation
  - `gemini-2.5-flash-native-audio-preview` - Live voice assistant
- **Icons**: Lucide React
- **Charts**: Recharts

## Project Structure

```
coursecorrect/
├── components/
│   ├── LandingPage.tsx      # Infinite canvas with AI-generated use case cards
│   ├── DemoFlow.tsx         # 5-step demo wizard (mode → upload → sector/location → style → results)
│   ├── AuthGate.tsx         # Email/password auth gate (wraps app views)
│   ├── IngestionZone.tsx    # File upload & project creation
│   ├── ConfigurationZone.tsx # Goal & context configuration
│   ├── DiagnosisDashboard.tsx # Analysis results visualization
│   ├── RegulatoryView.tsx   # Regulatory compliance updates
│   ├── VisualView.tsx       # Visual transformation studio
│   ├── ExportView.tsx       # Export to SCORM/xAPI
│   ├── Sidebar.tsx          # Navigation
│   └── LiveAssistant.tsx    # Real-time voice consultation
├── contexts/
│   └── WorkflowContext.tsx  # Centralized app state (replaces scattered useState in App.tsx)
├── services/
│   ├── geminiService.ts     # Gemini routing layer: Edge Functions first, direct API fallback
│   └── supabaseClient.ts    # Supabase client with auth, DB, storage, edge functions
├── supabase/
│   ├── migrations/          # Database schema
│   ├── functions/           # Edge functions (Gemini API proxy)
│   │   ├── analyze-course/
│   │   ├── regulatory-update/
│   │   ├── visual-transform/
│   │   ├── generate-asset/
│   │   ├── jurisdiction-lookup/
│   │   ├── demo-slides/
│   │   └── _shared/         # Shared utilities (cors, auth, gemini)
│   └── config.toml
├── types.ts                 # TypeScript interfaces
├── App.tsx                  # Main app with routing
└── .env.local               # Supabase keys (GEMINI_API_KEY to be removed)
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

| Feature | Model | Grounding | Structured Output |
|---------|-------|-----------|-------------------|
| Course Analysis (scan + score) | gemini-3-pro-preview | - | Yes (responseSchema) |
| Regulatory Updates | gemini-3-flash-preview | Google Search | Yes (responseSchema) |
| Jurisdiction Lookup | gemini-3-flash-preview | Google Search | No (planned) |
| Visual Suggestions | gemini-3-flash-preview | - | Yes (responseSchema) |
| Image Generation | gemini-2.5-flash-image | - | N/A (image output) |
| Demo Slides (basic) | gemini-3-flash-preview | - | Yes (responseSchema) |
| Demo Slides (enhanced) | gemini-3-flash-preview | Google Search | No (uses regex parsing - NEEDS FIX) |
| Landing Page Cards | gemini-3-flash-preview | - | Yes (responseSchema) |
| Sector Inference | gemini-3-flash-preview | - | Yes (responseSchema) |
| Voice Assistant | gemini-2.5-flash-native-audio | - | N/A (audio) |

### Gemini Routing Architecture
All Gemini calls in `geminiService.ts` follow this pattern:
1. Try Supabase Edge Function (API key server-side, secure)
2. Retry up to 3x with exponential backoff (1s, 2s delays; skip retry on 4xx)
3. Fall back to direct Gemini API call if Edge Function fails
4. Static fallback content as last resort (demo slides only)

## Future Goals

### Phase 1: Core Platform (Current)
- [x] Landing page with AI-generated use cases
- [x] Multi-format file ingestion
- [x] Dual-engine analysis (Regulatory + Visual)
- [x] Live voice assistant
- [x] Edge Function routing with direct fallback + retry logic
- [x] WorkflowContext (centralized state management)
- [x] AuthGate (Supabase email/password, guards app views)
- [x] Dark warm theme across all components (including DemoFlow)
- [x] Demo flow E2E with improved slide parsing
- [ ] Working SCORM/xAPI export
- [ ] Search Grounding + Structured Output for enhanced demo slides (eliminates regex parsing)
- [ ] Prompt improvements (see Gemini 3 section below)

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

---

## Gemini 3 Prompting Best Practices

These findings are from a comprehensive audit of Gemini 3 behavior. Follow these when writing or modifying any Gemini prompt.

### Critical Rules

1. **Temperature MUST stay at 1.0 (default).** Setting below 1.0 causes looping and degraded output with Gemini 3. Never override temperature.
2. **Search Grounding + Structured Output work together in Gemini 3.** This is new — Gemini 2.x could not combine `tools: [{ googleSearch: {} }]` with `responseSchema`. Use this to eliminate all regex-based response parsing.
3. **Place critical constraints LAST in the prompt.** Gemini 3 may drop negative constraints or formatting requirements that appear too early. Put the most important instructions at the END.
4. **Be direct, not conversational.** Gemini 3 treats prompts as executable instructions. Remove: "Act as...", "You are an expert...", "Please...", "Could you...". Just state what to do.
5. **Concise by default.** Gemini 3 gives the shortest correct answer. If you need detail, explicitly ask for it.
6. **Don't repeat what the schema defines.** If using `responseSchema`, don't also say "Return JSON with fields X, Y, Z" in the prompt — it's redundant.

### Useful Parameters

- `thinking_level`: MINIMAL / MEDIUM / HIGH (default: HIGH). Use MEDIUM for latency-sensitive calls (demo slides, use case generation). Use HIGH for deep analysis (course scoring, regulatory research).
- `propertyOrdering`: Order schema properties explicitly for consistent output.
- `anyOf` and `$ref`: Gemini 3 supports more expressive JSON schemas.

### Prompt Structure Template

```
<system_instruction>
[Role context — what domain/task, NOT "you are an expert"]
[Scoring rubrics or evaluation criteria if applicable]
[Output format guidance only if not covered by responseSchema]
</system_instruction>

[User prompt with task-specific content]
[Context/content to analyze]

[CRITICAL CONSTRAINTS GO LAST — specificity requirements, what NOT to do, format rules]
```

## Prompt Improvement Priorities

### CRITICAL (Next to implement)
1. **Enhanced Demo Slides → Add responseSchema + Search Grounding combo.** Currently `generateDemoSlidesEnhancedDirect()` uses search grounding but parses output with ~80 lines of fragile regex (`parseResponseToSlides`). Adding `responseSchema` eliminates all parsing code. This is the #1 improvement — it's what judges see.
2. **Course Analysis → Add scoring rubric.** Current prompts say "score freshness 0-100" with no rubric. Add: 90+ = all citations within 1 year, 70-89 = mostly current, 50-69 = several outdated, below 50 = significantly outdated. Same for engagement.
3. **Regulatory Update (direct) → Add responseSchema + Search Grounding combo.** Same pattern as #1 — currently uses regex to parse `text.match(/\[.*\]/s)`.

### HIGH
4. **Demo Slides → Add bullet specificity constraint.** Gemini generates generic bullets like "Understanding the basics." Add constraint: "Each bullet must include a specific fact, regulation number, or actionable instruction."
5. **All prompts → Simplify persona framing.** Remove "Act as the Regulatory Hound", "You are an expert instructional designer", etc. Replace with direct task description.

### MEDIUM
6. **Visual Transformation → Add content-type-to-format matching.** Tell the model: sequential steps → timeline, definitions → flip cards, comparisons → tables, procedures → process diagrams.
7. **Live Audio Assistant → Expand system instruction.** Current: "You are an expert Instructional Designer consultant." Add CourseCorrect product context so it can give relevant guidance.
8. **All prompts → Use XML/Markdown structural tags** to separate instructions from user content (e.g., `<content>...</content>`).

### LOW
9. Landing page use cases — minor simplification
10. Sector inference — already well-structured

## Design System

### Dark Warm Theme Tokens (Tailwind)

All app views use these consistent tokens defined in `tailwind.config.js`:

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0c0b09` | Page backgrounds |
| `card` | `#1a1914` | Card/panel backgrounds |
| `surface` | `rgba(255,248,230,0.04)` | Subtle elevated surfaces |
| `surface-border` | `rgba(255,248,230,0.08)` | Borders, dividers |
| `text-primary` | `#f5f0e0` | Headings, body text |
| `text-muted` | `rgba(245,240,224,0.5)` | Secondary text, labels |
| `accent` | `#c8956c` | Warm amber — buttons, links, active states |
| `success` | `#6abf8a` | Positive scores, confirmations |
| `warning` | `#c27056` | Alerts, low scores, errors |

### Font Stack
- `font-sans`: Lato (body text)
- `font-heading`: Poppins (headings, buttons)
- `font-serif`: DM Serif Display (decorative)

### Components Themed
All components use these tokens: LandingPage, DemoFlow, AuthGate, Sidebar, IngestionZone, ConfigurationZone, DiagnosisDashboard, RegulatoryView, VisualView, ExportView.

## Working Agreement (PM Process)

### Autonomous (agents can proceed without approval)
- Backend logic (Edge Functions, API routing, retry logic, state management)
- Bug fixes (type errors, model mismatches, config issues)
- Performance optimizations
- Code organization / refactoring

### Requires user input FIRST
- Design/visual decisions (themes, colors, layout, component styling, animations)
- User-facing flow decisions (what steps exist, what happens at each step, navigation)
- Copy/content decisions (button labels, error messages, CTA text)
- Prompt wording that affects what users/judges see (demo output quality, analysis scoring)
- Any changes to LandingPage.tsx (frozen — do not modify without explicit approval)

### File Ownership (when running parallel agents)
Prevent merge conflicts by assigning strict file ownership:
- **Gemini/Service agent**: `geminiService.ts`, `DemoFlow.tsx`, `LocationInput.tsx`, `types.ts`, `supabase/functions/*/`
- **App/Architecture agent**: `App.tsx`, `WorkflowContext.tsx`, `AuthGate.tsx`, `supabaseClient.ts`, Sidebar, app-view components
- **UX/Design agent**: `index.css`, `tailwind.config.js`, component styling only (no logic changes)
- **No agent touches another agent's files.** Coordination goes through the PM.

---

## Integration Layer Instructions

### STATUS: Edge Function Routing COMPLETE (Day 5)

`geminiService.ts` now routes all Gemini calls through Edge Functions first with direct API fallback. The pattern:
```typescript
export async function analyzeCourseContent(text, files, config) {
  try {
    // Try edge function (API key server-side)
    const result = await withRetry(() =>
      supabase.functions.invoke('analyze-course', { body: { text, files, config } })
    );
    if (result.error) throw result.error;
    return result.data;
  } catch (err) {
    console.warn('Edge Function failed, falling back to direct:', err);
    return await analyzeCourseContentDirect(text, files, config);
  }
}
```

### Remaining Migration Work

### DONE: Edge Function Routing (Day 5)

All 7 Gemini functions in `geminiService.ts` now route through Edge Functions first with direct fallback:
- `analyzeCourseContent` → `analyze-course`
- `performRegulatoryUpdate` → `regulatory-update`
- `performVisualTransformation` → `visual-transform`
- `generateAsset` → `generate-asset`
- `identifyLocalAuthority` → `jurisdiction-lookup`
- `generateDemoSlides` → `demo-slides`
- `generateDemoSlidesEnhanced` → `demo-slides` (with enhanced params)

Components still import from `geminiService.ts` — the routing is transparent.

### Still TODO

1. **Remove `GEMINI_API_KEY` from `.env.local`** after confirming all Edge Functions work reliably
2. **Add project persistence** — Save/load projects from Supabase DB
3. **Use Supabase Storage** for file uploads instead of base64 in memory

### Environment Variables After Migration

```env
# Keep these (frontend needs them)
VITE_SUPABASE_URL=https://yyqgxzbzdcsjdlxiydyj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Remove this (now in Supabase secrets only)
# GEMINI_API_KEY=...
```

### Edge Function Endpoints

All deployed at: `https://yyqgxzbzdcsjdlxiydyj.supabase.co/functions/v1/`

| Endpoint | Auth Required | Purpose |
|----------|---------------|---------|
| `analyze-course` | Yes | Course content analysis |
| `regulatory-update` | Yes | Fact-checking with Search grounding |
| `visual-transform` | Yes | Visual transformation suggestions |
| `generate-asset` | Yes | AI image generation |
| `jurisdiction-lookup` | Yes | Local authority identification |
| `demo-slides` | No | Demo wizard (public for hackathon) |

### Database Tables Available

- `projects` - Course modernization projects
- `uploaded_files` - File metadata (actual files in Storage)
- `analyses` - Diagnosis results
- `regulatory_updates` - Proposed regulatory changes
- `visual_transformations` - Visual improvement suggestions
- `generated_assets` - AI-generated images
- `exports` - SCORM/xAPI export jobs

### Storage Buckets

- `course-files` - User uploads (private)
- `generated-assets` - AI images (public)
- `exports` - SCORM packages (private)
