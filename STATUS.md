Agent: Gemini/Service-Layer
Branch: gemini/service-layer
Last update: 2026-02-05

DONE:
- Added new types for demo flow: UpdateMode, Citation, InferredSector, DemoSlideEnhanced, DemoResult
- Created `inferSectorFromContent()` - analyzes uploaded files/topic, returns sector with confidence level, flags ambiguity
- Created `generateDemoSlidesEnhanced()` - uses Google Search grounding for real regulatory content, extracts groundingMetadata for citations
- Refactored DemoFlow component with new 5-step flow:
  1. Update mode selection (Regulatory / Visual / Full)
  2. File upload + topic input
  3. Sector confirmation (AI-inferred, editable) + location
  4. Style selection (skipped for regulatory-only)
  5. Before/After split view results with citations panel
- Integrated LocationInput component for geolocation
- Added usage tracking to all Gemini API calls

IN PROGRESS:
- Nothing half-finished

BLOCKED:
- Nothing

NEXT:
- Test the full demo flow end-to-end
- Refine search grounding prompts for better regulatory citation extraction
- Improve response parsing for before/after slide content
- Add loading states and error handling polish
- Consider caching for sector inference results

WARNINGS:
- The response parsing in `parseResponseToSlides()` is basic - uses regex to extract before/after content from free-form text. May need refinement based on actual Gemini output patterns.
- Fallback slides are generic placeholders - should be improved with sector-specific content
- No retry logic for API failures yet
