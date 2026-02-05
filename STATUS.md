# CourseCorrect Development Status

---

## Agent 2: Gemini/Service-Layer
**Branch:** gemini/service-layer
**Last update:** 2026-02-05

### DONE:
- Added new types: UpdateMode, Citation, InferredSector, DemoSlideEnhanced, DemoResult
- Created `inferSectorFromContent()` - analyzes uploaded files/topic, returns sector with confidence
- Created `generateDemoSlidesEnhanced()` - Google Search grounding for real regulatory citations
- Refactored DemoFlow to 5-step flow (mode → upload → sector/location → style → results)
- Integrated LocationInput component for geolocation
- Added usage tracking to all Gemini API calls

### WARNINGS:
- `parseResponseToSlides()` uses basic regex - may need refinement
- Fallback slides are generic placeholders
- No retry logic for API failures yet

---

## Agent 3: Backend/Supabase
**Branch:** gemini/service-layer
**Last update:** 2026-02-05

### DONE:
- Installed `@supabase/supabase-js`
- Created 9-table database schema with RLS policies
- Created 3 storage buckets (course-files, generated-assets, exports)
- Built and deployed 6 Edge Functions (analyze-course, regulatory-update, visual-transform, generate-asset, jurisdiction-lookup, demo-slides)
- Created shared utilities (_shared/gemini.ts, cors.ts, auth.ts, types.ts)
- Created `services/supabaseClient.ts` with full frontend client
- Pushed migrations and deployed Edge Functions to production

### WARNINGS:
- GEMINI_API_KEY still in frontend .env.local — remove after switching to edge functions
- Edge Functions require Authorization header with anon key
- gen-lang-client-*.json in project root — DO NOT COMMIT
