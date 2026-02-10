# Course Correction

**The self-healing engine for your entire course library.**

Course Correction is an AI-powered course modernization platform that solves a universal pain point in corporate training: **course decay**. Courses become obsolete the moment they're published — regulations update, best practices evolve, and designs go stale.

Upload any course file and Course Correction's AI agents scan it in parallel, identify what's outdated, and generate modernized content ready for review.

---

## How It Works

Upload a PDF, PowerPoint, or document. Up to six specialized AI agents analyze and rebuild your course simultaneously:

| Agent | What It Does |
|-------|-------------|
| **Fact Checker** | Verifies every claim, regulation, and statistic against current sources using real-time Google Search Grounding. Returns confidence scores, source URLs, and verification notes. |
| **Slide Designer** | Generates before/after slide comparisons using a two-pass architecture — first generates, then self-reviews for accuracy and quality. Slides that don't pass get auto-corrected. |
| **Study Guide Agent** | Extracts key concepts and produces a structured study guide, fact-checked against live sources. |
| **Slide Deck Agent** | Generates complete slide content with theme-aware styling, data verification, and AI-generated hero images. |
| **Quiz Agent** | Creates certification-style assessment questions with multiple choice options, correct answers, and explanations grounded in the actual course content. |
| **Course Summary** | Produces a structured overview — title, learning objectives, difficulty level, estimated duration, key topics, and module count. |

All agents run in parallel via `Promise.allSettled` and results appear in a live orchestration panel as each agent completes.

---

## Key Features

- **Multi-format ingestion** — PDF, PPT, DOCX, and images
- **AI-powered findings scan** — Identifies outdated content, compliance gaps, missing topics, and structural issues
- **Two-stage review** — AI scans first, you approve findings one by one, then slides are generated guided only by what you approved
- **Before/after slide generation** — Visual transformations with real citations from live search
- **Parallel agent orchestration** — Watch all agents work simultaneously in a live dashboard
- **Study guide + quiz generation** — Auto-generated study materials and assessment questions from course content
- **Light/dark theme** — Full theme system with persistence

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Supabase (PostgreSQL, Edge Functions, Auth, Storage) |
| AI | Google Gemini 3 Pro, Gemini 3 Flash, Gemini 2.5 Flash (image generation) |
| Icons | Lucide React |
| Charts | Recharts |

## Gemini API Usage

| Feature | Model | Grounding | Structured Output |
|---------|-------|-----------|-------------------|
| Course analysis + scoring | Gemini 3 Pro | — | Yes |
| Fact checking + findings scan | Gemini 3 Flash | Google Search | Yes |
| Slide generation | Gemini 3 Flash | Google Search | Yes |
| Study guide generation | Gemini 3 Flash | Google Search | Yes |
| Quiz generation | Gemini 3 Flash | — | Yes |
| Image generation | Gemini 2.5 Flash | — | N/A (image) |

All Gemini calls route through Supabase Edge Functions (API key server-side) with automatic retry and direct fallback.

---

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

You'll need a [Supabase](https://supabase.com) project with Edge Functions deployed and a `GEMINI_API_KEY` set in your Supabase secrets. See `.env.example` for the full list of environment variables.

## Project Structure

```
components/        UI components (LandingPage, DemoFlow, AuthGate, Dashboard, etc.)
contexts/          React contexts (WorkflowContext, ThemeContext)
services/          Gemini routing layer + Supabase client
supabase/functions Edge Functions (analyze-course, demo-slides, regulatory-update, etc.)
utils/             PDF processing, color remapping, text extraction
public/            Static assets and logos
```

## Security

- All Gemini API calls proxied through Supabase Edge Functions (key never exposed to client)
- IP-based rate limiting on public endpoints
- Input sanitization against prompt injection
- Row-Level Security on all database tables
- Access code gate for full platform (demo is public)

## License

MIT
