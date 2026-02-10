# Course Correction — Accomplishments

## February 10, 2026 — Day 9

### Feat: AI-Generated Course Title for Presentations

**Problem**: Uploaded file names (e.g. "CFP Study Guide 2024") were used as the presentation title everywhere — slide deck title slides, footers, study guide headers, quiz headers, and PPTX exports. The `generateCourseSummary` agent already produced a proper `courseTitle` via AI, but it was never wired to display.

**Fix**: Plumbed `courseSummaryResult.courseTitle` through as a `presentationTitle` prop from DemoFlow to VisualOutput and RegulatoryOutput. Created a `displayTitle` computed value (`presentationTitle || topic`) used in all ~15 display locations while keeping the original `topic` for AI prompt inputs.

**Files modified**: `components/DemoFlow.tsx`, `components/VisualOutput.tsx`, `components/RegulatoryOutput.tsx`
**Commit**: `ba04e88`

### Fix: Scan Findings Too Exam-Focused

**Problem**: When analyzing certification prep content (e.g. CFP study guide), all 3 findings were about exam structure changes (blueprint, format, passing score) rather than actual course content being taught.

**Fix**: Added explicit constraints to both scan prompts (edge function + direct API fallback): at most 1 finding about exam structure changes, majority must be about actual course content — outdated facts, deprecated practices, missing knowledge areas.

**Files modified**: `supabase/functions/demo-slides/index.ts`, `services/geminiService.ts`
**Commits**: `84fac88`

---

### Fix: Scan Errors Silently Showing "Content Looks Current"

**Problem**: ~1/3 of the time, the course scan would show "Your content looks current!" with a "Continue to Design Update" button — even when the course clearly had outdated content. The Gemini API was failing intermittently, and errors were being silently swallowed and returned as empty findings arrays, which the UI interpreted as "no issues found."

**Root cause**: Two places caught API errors and returned `{ findings: [] }` instead of propagating the failure:
1. `scanCourseFindingsDirect` in geminiService.ts — the direct API fallback returned empty findings on any error
2. `handleFindingsScan` in the demo-slides edge function — returned HTTP 200 with empty findings when JSON parsing failed

**Fix**:
- **Direct API fallback** (`services/geminiService.ts`): Added 3-attempt retry loop with exponential backoff (1s, 2s). Bails immediately on 4xx client errors. Throws on exhaustion so the error propagates to the UI's "Scan incomplete" retry screen.
- **Edge function** (`supabase/functions/demo-slides/index.ts`): Changed JSON parse failure from returning HTTP 200 with empty data to returning HTTP 502, which triggers client-side retries.

**Result**: Full retry chain is now: edge function (3 attempts) → direct API (3 attempts) → manual retry UI. Users only see the retry prompt after 6 automatic attempts have failed.

**Files modified**: `services/geminiService.ts`, `supabase/functions/demo-slides/index.ts`
**Commit**: `84fac88`

---

## February 9, 2026 — Day 8 (Final Day)

### Session 3: Polish, Bug Fixes, Auth Flow, Documentation

This session focused on fixing bugs found during final testing, cleaning up the UI, improving the auth flow, and writing hackathon submission materials.

#### Sector Inference Fix

**Problem**: A CFP (Certified Financial Planner) study guide was misidentified as "Information Technology" because the sector inference engine lacked finance-specific keywords and defaulted to IT when no keywords matched.

**Fix** (in `services/geminiService.ts`):
- Added 17 finance/banking keywords: cfp, certified financial, wealth management, retirement, estate planning, fiduciary, portfolio, securities, mutual fund, annuity, tax planning, financial planning, cfa, series 7, series 65, finra, sec
- Added Insurance and Pharmaceuticals keyword groups
- Rewrote fallback logic: 2+ keyword matches = confident return; 0-1 matches = call Gemini edge function for AI classification; no match = return empty with `isAmbiguous: true` (user picks manually, never defaults to IT)

#### Regulatory Output Cleanup

**Problem**: The regulatory results tab was showing design-related content (Course Module with downloads, Clean Document, Quiz, Slide Preview, CourseSummaryBar) that belongs in the visual/design results.

**Fix** (in `components/RegulatoryOutput.tsx`):
- Removed tabs: Course Module, Clean Document, Quiz
- Removed CourseSummaryBar component
- Removed "Verified via:" search queries line
- Kept only 3 tabs: Redline View, Change Report, Fact Check
- Removed unused imports and props (`quizResults`, `courseSummaryResult`)
- Updated DemoFlow.tsx to stop passing removed props

#### Quiz Agent Retry Logic

**Problem**: Quiz generator was failing because it depended on study guide completion — if the study guide failed or returned empty sections, the quiz agent would get 0 questions and throw an error.

**Fix** (in `components/DemoFlow.tsx`):
- Added retry logic: if first quiz attempt returns 0 questions, retry without study guide context
- Applied to both visual mode and full mode agent dispatchers
- Quiz now generates topic-based questions as fallback when study guide isn't available

#### AuthGate Email Login

**Problem**: The access code screen was the only way in — users with email/password accounts had no way to bypass the code gate.

**Fix** (in `components/AuthGate.tsx`):
- Added `showEmailLogin` state to bypass the access code gate
- Added "Sign in with email" button at bottom of access code form
- When clicked, skips access code and shows the email/password + Google login form directly

#### Demo Link from Auth

**Problem**: "Try the free demo" on the access code screen went back to the landing page instead of directly to the demo flow.

**Fix**:
- Added `onDemo` prop to AuthGate component
- Wired it to `goToStep(AppStep.DEMO)` in App.tsx
- Updated the "Try the free demo" link to use `onDemo || onBack`

#### Sidebar Logo Navigation

**Problem**: After signing in, clicking the logo in the sidebar did nothing — users couldn't get back to the landing page.

**Fix** (in `components/Sidebar.tsx`):
- Made the logo + brand text clickable with `onClick={() => goToStep(AppStep.LANDING)}`

#### PROJECT_STORY.md

Wrote the hackathon submission story covering: Inspiration, What it does, How I built it, Gemini API usage, Challenges, Accomplishments, What I learned, What's next. Included all 6 agents with mode-dependent dispatching explanation.

#### CLAUDE.md + ACCOMPLISHMENTS.md Rebuild

Both files were deleted in commit `9f87399` during repo cleanup. Recreated both:
- CLAUDE.md — Comprehensive project instructions reflecting current architecture (agent orchestration, sector inference, auth flow, security, design system)
- ACCOMPLISHMENTS.md — Full record of all work across all sessions

**Files modified**: `App.tsx`, `AuthGate.tsx`, `Sidebar.tsx`, `RegulatoryOutput.tsx`, `DemoFlow.tsx`, `geminiService.ts`, `CLAUDE.md`, `ACCOMPLISHMENTS.md`

---

### Session 2: Agent Orchestration, Visual Pipeline, Security (Major Build)

Implemented the full agent orchestration system — the core hackathon feature. This was the largest single commit in the project.

**Commit**: `c074530`

#### Agent Orchestration System
- 6-agent full mode (Fact Checker, Slide Designer, Study Guide Agent, Slide Deck Agent, Quiz Agent, Course Summary) dispatched via `Promise.allSettled` with staggered starts
- 4-agent regulatory pipeline (Fact Checker, Slide Designer, Course Summary, Study Guide)
- 3-agent visual pipeline (Study Guide → Quiz, Slide Deck + infographic in parallel)
- Animated 2x2/2x3 agent grid panel with status transitions (idle → working → complete/error), progress text cycling, and pulsing borders
- "View Results" button when all agents complete

#### AI-Powered Content Pipeline
- `generateSlideContent` edge function action with data verification
- `selectInfographicSlide` action using Gemini reasoning (thinkingConfig) to pick best slide for infographic
- Infographic image generation via gemini-2.5-flash-image
- Study guide with Google Search grounding for fact-checking
- Quiz generated from study guide sections for topic alignment
- Two-pass slide review agent with Gemini thinking for factual accuracy
- `verify` action for fact-checking findings via Search Grounding with confidence scores
- `generateCourseSummary` action for course overview (title, objectives, difficulty, duration)
- Pre-generated content passed as props (no lazy loading in results view)

#### Security Hardening
- IP-based rate limiting on demo-slides (20/day anonymous, 500/day authenticated)
- `sanitizeUserInput()` on all user inputs across all edge function handlers
- Input length limits on all edge function request bodies
- Dynamic CORS origin checking with `x-bypass-key` header support
- `maxOutputTokens` caps on all Gemini calls
- Access code gate on AuthGate (moved to environment variable)

#### New Components
- `components/ArchitecturePage.tsx` — Interactive architecture visualization with animated pipeline flow showing how agents process content
- `components/RegulatoryOutput.tsx` — Regulatory results with Redline View, Change Report, Fact Check tabs
- `components/VisualOutput.tsx` — Visual results with Slides, Study Guide, Quiz, Infographic tabs

#### Bug Fixes (in this session)
- Fixed study guide stuck loading when no files uploaded (conditional prompt based on file availability)
- Fixed quiz stuck loading (same pattern as study guide)
- Fixed identical before/after slides (added explicit exclusion for disclaimer/copyright/title pages in prompts)
- Expanded sector inference with 17 new finance keywords + Insurance/Pharma groups

**Files modified**: 22 files modified, 7 new files created

---

### Session 1: Design Overhaul — Slide-Based Landing, Light/Dark Theme, New Brand

**Commit**: `8c93219`

Complete frontend redesign for the hackathon.

- **Slide-based landing page** — 5 full-viewport scroll-snap sections (Hero, Problem, Two Engines, How It Works, CTA) with dot navigation, keyboard nav, and scroll hint
- **Light/dark mode** — Full theme system using CSS custom properties with RGB values for Tailwind opacity modifier support. ThemeContext with localStorage persistence
- **New logo** — Custom SVG looping arrow mark with gradient, replacing Zap icon across all components
- **New color palette** — Accent coral/amber, warm blacks and off-whites
- **Inter font** — Replaced multi-font stack with Inter as primary typeface
- **Brand rename** — "CourseCorrect" → "Course Correction"
- **CourseDashboard** — New component connected to Supabase `projects` table
- **OAuth redirect** — After Google OAuth, redirect to dashboard instead of landing

---

## February 9, 2026 — Day 7

### Design Mode: Vibe Picker + Canvas Color Remapping

**Commit**: `5f4707d`

Reworked the visual/design mode flow. Instead of AI-generated questionnaires or lossy text extraction, uses **canvas pixel remapping** to transform slide visuals while preserving 100% of original content.

- **"Pick a vibe" UI** — 4 visually distinct thumbnail presets (Light & Minimal, Dark & Bold, Colorful & Warm, Structured & Corporate)
- **Canvas pixel remapping** (`utils/pdfColorRemapper.ts`) — Remaps grayscale spectrum to theme palette while preserving saturated elements (images, diagrams)
- **Client-side PDF text extraction** (`utils/pdfTextExtractor.ts`) — Text extraction via pdfjs-dist for page classification
- **PDF page renderer** (`utils/pdfPageRenderer.ts`) — Renders pages to canvas for display and recoloring
- **Professional slide renderer** — 5 layout types with dynamic theme colors
- **Brand customization** — Optional color picker and logo upload overlay

---

## February 8, 2026 — Day 6

### Two-Stage Findings Review + Usage Tracking

**Commit**: `8f04f55`

- **Two-stage findings review** — Stage 1: AI scans course and presents findings as card carousel (approve/skip one at a time). Stage 2: generates slides guided ONLY by approved findings
- **Real usage tracking** — Gemini `usageMetadata` pass-through from Edge Functions, displayed in admin dashboard
- **Google Cloud Monitoring integration** — `cloud-metrics` Edge Function + dashboard tab
- **"Free demo" branding** — "Finding X of Y" progress indicator + blurred pro teaser pane

---

## February 7, 2026 — Day 5

### Edge Function Routing + WorkflowContext + Auth + Dark Theme

**Commit**: `46c20fc`

- **Edge Function routing** — All 7 Gemini functions route through Supabase Edge Functions first with automatic retry and direct API fallback
- **WorkflowContext** — Centralized state management replacing scattered useState in App.tsx
- **AuthGate** — Email/password + Google OAuth authentication gate
- **Dark warm theme** — Consistent design tokens across all components
- **Prompt injection sanitization** — `sanitizeUserInput()` in shared utilities
