# Course Correction

**The self-healing engine for your entire course library.**

Course Correction is an AI-powered course modernization platform that solves a universal pain point in corporate training: **course decay**. Courses become obsolete the moment they're published — regulations update, best practices evolve, and designs go stale.

Upload any course (PDF, PPT, DOCX) and Course Correction scans it with two AI engines, identifies what's outdated, and generates modernized versions ready for review.

Built for the **Google Gemini API Developer Competition 2025**.

## How It Works

### Engine 1: The Regulatory Hound
Reads existing course content, identifies facts, regulations, and statistics, then uses **Google Search Grounding** to verify against current standards. Outputs a findings report with citations and proposed rewrites.

### Engine 2: The Visual Alchemist
Analyzes text-heavy slides and documents, converts dense content into modern layouts (timelines, comparison grids, stat highlights), and uses **Gemini image generation** to create fresh visuals.

## Key Features

- **Multi-format ingestion** — Upload PDF, PPT, DOCX, or images
- **AI-powered findings scan** — Identifies outdated content, missing topics, compliance gaps, and structural issues
- **Two-stage review** — AI scans first, you approve findings one by one, then AI generates slides guided only by what you approved
- **Before/after slide generation** — Dramatic visual transformations with real citations from live search
- **Design mode** — Pick a vibe, customize themes, see your slides recolored in real time via canvas pixel remapping
- **Study guide + quiz generation** — Auto-generated study materials and exam-prep quizzes from course content
- **Live voice assistant** — Real-time audio consultation using Gemini Live Audio API
- **Light/dark theme** — Full theme system with localStorage persistence

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Supabase (PostgreSQL, Edge Functions, Auth, Storage) |
| AI | Google Gemini 3 Pro, Gemini 3 Flash, Gemini 2.5 Flash (image + audio) |
| Icons | Lucide React |
| Charts | Recharts |

## Gemini API Usage

| Feature | Model | Grounding | Structured Output |
|---------|-------|-----------|-------------------|
| Course analysis + scoring | Gemini 3 Pro | - | Yes |
| Findings scan | Gemini 3 Flash | Google Search | Yes |
| Slide generation | Gemini 3 Flash | Google Search | Yes |
| Theme/font generation | Gemini 3 Flash | - | Yes |
| Image generation | Gemini 2.5 Flash | - | N/A (image) |
| Voice assistant | Gemini 2.5 Flash | - | N/A (audio) |

All Gemini calls route through Supabase Edge Functions (API key server-side) with automatic retry and direct fallback.

## Getting Started

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# Start dev server
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous key |
| `VITE_GOOGLE_CLIENT_ID` | No | Enables Google Sign-In |
| `VITE_GOOGLE_API_KEY` | No | Enables Google Drive picker |

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
