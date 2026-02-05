# CourseCorrect Backend

This directory contains the Supabase backend configuration for CourseCorrect, including database migrations, edge functions, and storage configuration.

## Architecture

```
supabase/
├── migrations/           # PostgreSQL schema migrations
│   ├── 20250204_001_initial_schema.sql
│   └── 20250204_002_storage_buckets.sql
├── functions/            # Deno Edge Functions
│   ├── _shared/          # Shared utilities
│   │   ├── cors.ts       # CORS handling
│   │   ├── auth.ts       # Authentication helpers
│   │   ├── gemini.ts     # Gemini API wrapper
│   │   └── types.ts      # TypeScript types
│   ├── analyze-course/   # Course content analysis
│   ├── regulatory-update/# Regulatory compliance checking
│   ├── visual-transform/ # Visual transformation suggestions
│   ├── generate-asset/   # AI image generation
│   ├── jurisdiction-lookup/ # AHJ identification
│   └── demo-slides/      # Demo slide generation
├── config.toml           # Supabase local config
├── seed.sql              # Sample data
└── .env.example          # Environment variables template
```

## Quick Start

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Docker](https://www.docker.com/) (for local development)
- Gemini API key

### Local Development

1. **Start Supabase locally:**
   ```bash
   supabase start
   ```

2. **Apply migrations:**
   ```bash
   supabase db push
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your GEMINI_API_KEY
   ```

4. **Serve edge functions:**
   ```bash
   supabase functions serve --env-file .env
   ```

5. **Access local services:**
   - API: http://localhost:54321
   - Studio: http://localhost:54323
   - Inbucket (email): http://localhost:54324

### Deployment

1. **Link to your Supabase project:**
   ```bash
   supabase link --project-ref your-project-ref
   ```

2. **Push migrations:**
   ```bash
   supabase db push
   ```

3. **Set secrets:**
   ```bash
   supabase secrets set GEMINI_API_KEY=your-key
   ```

4. **Deploy functions:**
   ```bash
   supabase functions deploy
   ```

## Edge Functions

### analyze-course
Analyzes course content for freshness and engagement issues.

**POST** `/functions/v1/analyze-course`
```json
{
  "text": "Course content...",
  "files": [{"name": "slide.pdf", "type": "application/pdf", "data": "base64..."}],
  "config": {
    "goal": "full",
    "targetAudience": "Construction workers",
    "standardsContext": "OSHA 29 CFR 1926"
  }
}
```

### regulatory-update
Checks content for regulatory accuracy using Google Search grounding.

**POST** `/functions/v1/regulatory-update`
```json
{
  "content": "Content to check...",
  "domainContext": "Construction safety",
  "location": "California, USA"
}
```

### visual-transform
Suggests visual transformations for text-heavy content.

**POST** `/functions/v1/visual-transform`
```json
{
  "content": "Dense paragraph text...",
  "theme": "modern"
}
```

### generate-asset
Generates AI images for course visuals.

**POST** `/functions/v1/generate-asset`
```json
{
  "prompt": "Modern illustration of construction worker using fall protection",
  "projectId": "uuid",
  "transformationId": "uuid"
}
```

### jurisdiction-lookup
Identifies local regulatory authorities.

**POST** `/functions/v1/jurisdiction-lookup`
```json
{
  "location": "Los Angeles, CA",
  "regulationType": "construction"
}
```

### demo-slides
Generates demo slides for the landing page wizard.

**POST** `/functions/v1/demo-slides`
```json
{
  "topic": "Fall Protection Training",
  "location": "Texas",
  "style": "modern"
}
```

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (extends auth.users) |
| `projects` | Course modernization projects |
| `uploaded_files` | Files attached to projects |
| `analyses` | Diagnosis results |
| `regulatory_updates` | Proposed regulatory changes |
| `visual_transformations` | Visual improvement suggestions |
| `generated_assets` | AI-generated images |
| `exports` | SCORM/xAPI export jobs |
| `api_usage` | API usage tracking |

### Storage Buckets

| Bucket | Description | Public |
|--------|-------------|--------|
| `course-files` | User-uploaded course materials | No |
| `generated-assets` | AI-generated images | Yes |
| `exports` | SCORM/xAPI packages | No |

## Security

- All tables have Row Level Security (RLS) enabled
- Users can only access their own data
- Edge functions require authentication (except demo-slides)
- API keys are stored as Supabase secrets, never in code
- Storage access controlled by folder structure (user_id/project_id/)

## Gemini Models Used

| Function | Model | Features |
|----------|-------|----------|
| analyze-course | gemini-3-pro-preview | Multimodal analysis |
| regulatory-update | gemini-3-flash-preview | Google Search grounding |
| visual-transform | gemini-3-flash-preview | Structured output |
| generate-asset | gemini-2.5-flash-image | Image generation |
| jurisdiction-lookup | gemini-2.5-flash | Maps grounding |
| demo-slides | gemini-3-flash-preview | Structured output |
