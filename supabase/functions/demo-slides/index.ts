// Edge Function: Generate Demo Slides
// Uses Gemini 3 Flash to create modernized course slides
// Supports basic mode (simple slides) and enhanced mode (search grounding + structured before/after)

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callGemini, resolveFileParts, sanitizeUserInput } from "../_shared/gemini.ts";
import { requireAuth } from "../_shared/auth.ts";

// ============================================
// Rate Limiting — protects against API abuse
// Anonymous: 20 calls/day (~3 full demo flows: each uses sector + scan + generate + theme/font/style)
// Authenticated: 500 calls/day (enough for heavy course work — long PPTs, multiple iterations)
// Bypass: set RATE_LIMIT_BYPASS_KEY secret + send x-bypass-key header to skip limits entirely
// Uses in-memory store (resets on cold start, but prevents rapid abuse per instance)
// ============================================

const ANON_LIMIT = 20;         // ~3 full demo flows with margin
const AUTH_LIMIT = 500;        // Heavy course work: 50-slide PPT × multiple re-scans, theme iterations
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const BYPASS_KEY = Deno.env.get("RATE_LIMIT_BYPASS_KEY") || "";

// Actions that count toward the limit (Gemini API calls that cost real money)
const RATE_LIMITED_ACTIONS = new Set(["scan", "generate", "verify", "generateCourseSummary", "generateSlideContent", undefined]); // undefined = basic/enhanced mode
// Theme/font/sector inference are lightweight and don't count

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.firstRequest > RATE_WINDOW_MS) {
      rateLimitStore.delete(ip);
    }
  }
}, 10 * 60 * 1000);

function getClientIP(req: Request): string {
  // Supabase Edge Functions set x-forwarded-for
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP (original client) — ignore proxies
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function checkRateLimit(key: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.firstRequest > RATE_WINDOW_MS) {
    // New window
    rateLimitStore.set(key, { count: 1, firstRequest: now });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

interface DemoRequest {
  topic: string;
  location?: string;
  style?: string;
  fileData?: {
    name: string;
    type: string;
    data: string; // base64
  };
  // Enhanced mode params
  enhanced?: boolean;
  sector?: string;
  updateMode?: "regulatory" | "visual" | "full";
  files?: Array<{
    name: string;
    type: string;
    data?: string;
    storagePath?: string;
  }>;
  // Sector inference mode
  inferSector?: boolean;
  // Two-stage findings flow
  action?: "scan" | "generate" | "generateTheme" | "generateThemeOptions" | "generateFontOptions" | "generateStudyGuide" | "generateQuiz" | "verify" | "generateCourseSummary" | "generateSlideContent" | "selectInfographicSlide";
  approvedFindings?: Array<{
    id: string;
    category: string;
    title: string;
    description: string;
    severity: string;
    sourceSnippet?: string;
    currentInfo?: string;
  }>;
  userContext?: string;
  designPreferences?: {
    audience?: string;
    feeling?: string;
    emphasis?: string;
  };
  // Font options params (design mode)
  themeCharacter?: string;
  // Theme generation params (design mode)
  themeQuestionnaire?: {
    brandPersonality?: string;
    audience?: string;
    desiredFeeling?: string;
    primaryColor?: string;
  };
  studyGuideSections?: Array<{
    title: string;
    summary: string;
    keyPoints: string[];
    takeaway: string;
  }>;
  slides?: Array<{
    title: string;
    bullets?: string[];
    keyFact?: string;
  }>;
}

const MAX_TOPIC_LENGTH = 500;
const MAX_LOCATION_LENGTH = 200;
const MAX_STYLE_LENGTH = 50;
const MAX_SECTOR_LENGTH = 100;
const MAX_USER_CONTEXT_LENGTH = 2000;
const MAX_FINDING_TEXT_LENGTH = 1000;
const MAX_DESIGN_PREF_LENGTH = 200;
const MAX_THEME_FIELD_LENGTH = 200;
const MAX_FILE_DATA_SIZE = 14 * 1024 * 1024; // 14MB base64 (~10MB decoded)
const MAX_FILES_COUNT = 5;
const MAX_APPROVED_FINDINGS = 10;

const SLIDES_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      bullets: {
        type: "array",
        items: { type: "string" },
      },
      visualPrompt: { type: "string" },
      colorTheme: { type: "string" },
    },
    required: ["title", "bullets", "visualPrompt", "colorTheme"],
  },
};

const SLIDE_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
    citationIds: { type: "array", items: { type: "integer" } },
    keyFact: { type: "string" },
    sourcePageNumber: { type: "integer" },
  },
  required: ["title", "bullets", "citationIds"],
};

const ENHANCED_SLIDES_SCHEMA = {
  type: "object",
  properties: {
    pageClassifications: {
      type: "array",
      description: "Classify EVERY page of the uploaded PDF before selecting slides. This forces careful reading.",
      items: {
        type: "object",
        properties: {
          pageNumber: { type: "integer" },
          pageTitle: { type: "string" },
          classification: {
            type: "string",
            description: "TEXT_HEAVY | DIAGRAM | INFOGRAPHIC | TITLE_PAGE | TABLE_OF_CONTENTS",
          },
          reason: { type: "string" },
        },
        required: ["pageNumber", "pageTitle", "classification", "reason"],
      },
    },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          before: SLIDE_CONTENT_SCHEMA,
          after: SLIDE_CONTENT_SCHEMA,
          changesSummary: { type: "string" },
          imagePrompt: { type: "string" },
          designReasoning: {
            type: "string",
            description: "Why you chose this page and this layout. What visual transformation are you applying?",
          },
          visualStyle: {
            type: "object",
            properties: {
              accentColor: { type: "string" },
              layout: { type: "string" },
              iconSuggestion: { type: "string" },
            },
            required: ["accentColor", "layout"],
          },
        },
        required: ["id", "before", "after", "changesSummary", "imagePrompt", "designReasoning", "visualStyle"],
      },
    },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          url: { type: "string" },
          snippet: { type: "string" },
          accessedDate: { type: "string" },
        },
        required: ["id", "title", "url", "snippet", "accessedDate"],
      },
    },
    metadata: {
      type: "object",
      properties: {
        topic: { type: "string" },
        sector: { type: "string" },
        location: { type: "string" },
        updateMode: { type: "string" },
        searchQueries: { type: "array", items: { type: "string" } },
      },
      required: ["topic", "sector", "location", "updateMode", "searchQueries"],
    },
  },
  required: ["pageClassifications", "slides", "citations", "metadata"],
};

const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          category: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          severity: { type: "string" },
          sourceSnippet: { type: "string" },
          currentInfo: { type: "string" },
        },
        required: ["id", "category", "title", "description", "severity"],
      },
    },
    searchQueries: { type: "array", items: { type: "string" } },
    courseSummary: { type: "string" },
    totalEstimatedFindings: { type: "integer" },
  },
  required: ["findings", "searchQueries", "courseSummary", "totalEstimatedFindings"],
};

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Note: Demo slides don't require auth for hackathon demo purposes
    // but we enforce IP-based rate limiting

    const body: DemoRequest = await req.json();

    if (!body.topic) {
      return errorResponse("Topic is required", 400);
    }

    // ── Input length validation ──
    if (body.topic.length > MAX_TOPIC_LENGTH) {
      return errorResponse("Topic must be 500 characters or fewer", 400);
    }
    if (body.location && body.location.length > MAX_LOCATION_LENGTH) {
      return errorResponse("Location too long", 400);
    }
    if (body.style && body.style.length > MAX_STYLE_LENGTH) {
      return errorResponse("Style too long", 400);
    }
    if (body.sector && body.sector.length > MAX_SECTOR_LENGTH) {
      return errorResponse("Sector too long", 400);
    }
    if (body.userContext && body.userContext.length > MAX_USER_CONTEXT_LENGTH) {
      return errorResponse("User context too long", 400);
    }
    if (body.themeCharacter && body.themeCharacter.length > MAX_THEME_FIELD_LENGTH) {
      return errorResponse("Theme character too long", 400);
    }

    // Validate design preferences lengths
    if (body.designPreferences) {
      const dp = body.designPreferences;
      if ((dp.audience && dp.audience.length > MAX_DESIGN_PREF_LENGTH) ||
          (dp.feeling && dp.feeling.length > MAX_DESIGN_PREF_LENGTH) ||
          (dp.emphasis && dp.emphasis.length > MAX_DESIGN_PREF_LENGTH)) {
        return errorResponse("Design preference fields too long", 400);
      }
    }

    // Validate theme questionnaire lengths
    if (body.themeQuestionnaire) {
      const tq = body.themeQuestionnaire;
      if ((tq.brandPersonality && tq.brandPersonality.length > MAX_THEME_FIELD_LENGTH) ||
          (tq.audience && tq.audience.length > MAX_THEME_FIELD_LENGTH) ||
          (tq.desiredFeeling && tq.desiredFeeling.length > MAX_THEME_FIELD_LENGTH) ||
          (tq.primaryColor && tq.primaryColor.length > 20)) {
        return errorResponse("Theme questionnaire fields too long", 400);
      }
    }

    // Validate approved findings count and text lengths
    if (body.approvedFindings) {
      if (body.approvedFindings.length > MAX_APPROVED_FINDINGS) {
        return errorResponse("Too many approved findings", 400);
      }
      for (const f of body.approvedFindings) {
        if ((f.title && f.title.length > MAX_FINDING_TEXT_LENGTH) ||
            (f.description && f.description.length > MAX_FINDING_TEXT_LENGTH) ||
            (f.sourceSnippet && f.sourceSnippet.length > MAX_FINDING_TEXT_LENGTH) ||
            (f.currentInfo && f.currentInfo.length > MAX_FINDING_TEXT_LENGTH)) {
          return errorResponse("Finding text too long", 400);
        }
      }
    }

    // Validate file count and inline file sizes
    if (body.files && body.files.length > MAX_FILES_COUNT) {
      return errorResponse("Too many files", 400);
    }
    if (body.fileData?.data && body.fileData.data.length > MAX_FILE_DATA_SIZE) {
      return errorResponse("Inline file size exceeds limit. Use storage upload for large files.", 400);
    }
    if (body.files) {
      for (const file of body.files) {
        if (file.data && file.data.length > MAX_FILE_DATA_SIZE) {
          return errorResponse("Inline file size exceeds limit. Use storage upload for large files.", 400);
        }
      }
    }

    // ── Rate limiting for content-generating actions ──
    const isRateLimited = RATE_LIMITED_ACTIONS.has(body.action) && !body.inferSector;
    const hasBypass = BYPASS_KEY && req.headers.get("x-bypass-key") === BYPASS_KEY;
    if (isRateLimited && !hasBypass) {
      // Check if user is authenticated (optional — demo works without auth)
      const auth = await requireAuth(req).catch(() => null);
      const clientIP = getClientIP(req);

      if (auth) {
        // Authenticated user — rate limit by user ID with generous limit
        const { allowed, remaining } = checkRateLimit(`user:${auth.userId}`, AUTH_LIMIT);
        if (!allowed) {
          return errorResponse(
            "You've reached the daily usage limit. Your limit resets in 24 hours. Contact support if you need more capacity.",
            429
          );
        }
        console.log(`Rate limit (auth): user=${auth.userId} remaining=${remaining}`);
      } else {
        // Anonymous user — rate limit by IP
        const { allowed, remaining } = checkRateLimit(`ip:${clientIP}`, ANON_LIMIT);
        if (!allowed) {
          return errorResponse(
            "You've used all your free demos for today. Sign in for a much higher limit, or try again tomorrow.",
            429
          );
        }
        console.log(`Rate limit (anon): IP=${clientIP} remaining=${remaining}`);
      }
    }

    // Route to the right handler
    if (body.action === "generateFontOptions") {
      return await handleFontOptionsGeneration(body);
    }

    if (body.action === "generateThemeOptions") {
      return await handleThemeOptionsGeneration(body);
    }

    if (body.action === "generateTheme") {
      return await handleThemeGeneration(body);
    }

    if (body.action === "generateSlideContent") {
      return await handleSlideContentGeneration(body);
    }

    if (body.action === "selectInfographicSlide") {
      return await handleInfographicSelection(body);
    }

    if (body.action === "generateStudyGuide") {
      return await handleStudyGuideGeneration(body);
    }

    if (body.action === "generateQuiz") {
      return await handleQuizGeneration(body);
    }

    if (body.action === "verify") {
      return await handleVerifyFindings(body);
    }

    if (body.action === "generateCourseSummary") {
      return await handleCourseSummary(body);
    }

    if (body.action === "scan") {
      return await handleFindingsScan(body);
    }

    if (body.action === "generate" && body.approvedFindings) {
      return await handleGuidedGeneration(body);
    }

    if (body.inferSector) {
      return await handleSectorInference(body);
    }

    if (body.enhanced) {
      return await handleEnhancedMode(body);
    }

    return await handleBasicMode(body);

  } catch (error) {
    console.error("Demo slides error:", error);
    return errorResponse("Slide generation failed. Please try again.", 500);
  }
});

// ============================================
// Theme Generation — AI generates a personalized color palette + typography
// ============================================

const THEME_SCHEMA = {
  type: "object",
  properties: {
    primaryColor: { type: "string", description: "Main accent color (hex, e.g. #2563eb)" },
    secondaryColor: { type: "string", description: "Supporting color (hex)" },
    backgroundColor: { type: "string", description: "Slide background color (hex)" },
    textColor: { type: "string", description: "Primary text color (hex)" },
    mutedTextColor: { type: "string", description: "Secondary/muted text color (hex)" },
    fontSuggestion: { type: "string", description: "Google Font name for headings (e.g. Poppins, Inter, Playfair Display)" },
    layoutStyle: { type: "string", description: "One of: geometric, organic, editorial, structured" },
    designReasoning: { type: "string", description: "1-2 sentence explanation of why this palette fits the user's preferences" },
  },
  required: ["primaryColor", "secondaryColor", "backgroundColor", "textColor", "mutedTextColor", "fontSuggestion", "layoutStyle", "designReasoning"],
};

const THEME_OPTIONS_SCHEMA = {
  type: "object",
  properties: {
    themes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short theme name (2-3 words, e.g. 'Midnight Bold')" },
          description: { type: "string", description: "One sentence describing the visual feel" },
          backgroundColor: { type: "string", description: "Slide background color (hex)" },
          textColor: { type: "string", description: "Primary text color (hex)" },
          primaryColor: { type: "string", description: "Main accent color (hex)" },
          secondaryColor: { type: "string", description: "Supporting accent color (hex)" },
          mutedTextColor: { type: "string", description: "Muted/secondary text color (hex)" },
          fontSuggestion: { type: "string", description: "Google Font name for headings" },
          layoutStyle: { type: "string", description: "One of: geometric, organic, editorial, structured, minimal, bold" },
        },
        required: ["name", "description", "backgroundColor", "textColor", "primaryColor", "secondaryColor", "mutedTextColor", "fontSuggestion", "layoutStyle"],
      },
    },
  },
  required: ["themes"],
};

async function handleThemeOptionsGeneration(body: DemoRequest): Promise<Response> {
  const sector = sanitizeUserInput(body.sector || "General");
  const topic = sanitizeUserInput(body.topic || "");

  const prompt = `Generate 6 dramatically different presentation color palettes for a ${sector} training course${topic ? ` about "${topic}"` : ""}.

Each theme must be visually DISTINCT from the others at a glance. Include a mix of:
1. A light, airy theme (white/cream background)
2. A dark, high-contrast theme (navy or near-black background)
3. A warm, inviting theme (warm colors dominate)
4. A cool, corporate theme (blues, teals)
5. A rich, prestigious theme (deep greens, golds, or burgundy)
6. A modern, edgy theme (bold contrasts, vibrant accents)

For each theme provide: name, description, backgroundColor, textColor, primaryColor, secondaryColor, mutedTextColor, fontSuggestion (must be a real Google Font), layoutStyle.

CRITICAL CONSTRAINTS:
- All colors must be valid 6-digit hex codes starting with #
- textColor MUST have high contrast against backgroundColor (WCAG AA minimum)
- primaryColor must be vibrant and visible against backgroundColor
- mutedTextColor must be a softer version of textColor (add transparency or desaturate)
- No two themes should share the same backgroundColor
- fontSuggestion must be real Google Fonts: Inter, Poppins, Space Grotesk, DM Sans, IBM Plex Sans, Playfair Display, Lora, Manrope, Outfit, Plus Jakarta Sans
- layoutStyle options: geometric (angular, grid-based), organic (flowing, rounded), editorial (serif, magazine-style), structured (clean lines, columns), minimal (lots of whitespace), bold (oversized elements)`;

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      responseSchema: THEME_OPTIONS_SCHEMA,
      maxOutputTokens: 4096,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return errorResponse("Failed to generate theme options", 500);
  }

  return jsonResponse({ themes: parsed.themes || [], _usage: usageMetadata });
}

const FONT_OPTIONS_SCHEMA = {
  type: "object",
  properties: {
    fonts: {
      type: "array",
      items: { type: "string" },
      description: "Array of 5 Google Font names ideal for presentation headings",
    },
  },
  required: ["fonts"],
};

async function handleFontOptionsGeneration(body: DemoRequest): Promise<Response> {
  const sector = sanitizeUserInput(body.sector || "General");
  const topic = sanitizeUserInput(body.topic || "");
  const themeCharacter = sanitizeUserInput(body.themeCharacter || "professional");

  const prompt = `Suggest 5 Google Font names ideal for presentation headings in a ${sector} training course${topic ? ` about "${topic}"` : ""}.

The design style is: ${themeCharacter}.

Return exactly 5 font names. Each must be a real, freely available Google Font that works well for large headings and titles in slide presentations.

CRITICAL CONSTRAINTS:
- Only suggest fonts available on Google Fonts
- Include a mix: 1-2 geometric sans-serifs, 1 humanist sans-serif, 1 display/personality font, and 1 serif or slab-serif
- All fonts must be highly legible at large sizes (headings, not body text)
- Prioritize fonts with bold/extrabold weights available`;

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      responseSchema: FONT_OPTIONS_SCHEMA,
      maxOutputTokens: 1024,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse({
      fonts: ["Inter", "Poppins", "Space Grotesk", "DM Sans", "Playfair Display"],
      _usage: usageMetadata,
    });
  }

  return jsonResponse({
    fonts: (parsed.fonts || []).slice(0, 5),
    _usage: usageMetadata,
  });
}

async function handleThemeGeneration(body: DemoRequest): Promise<Response> {
  const q = body.themeQuestionnaire || {};

  const prompt = `Generate a cohesive presentation color palette and typography recommendation.

User preferences:
- Brand personality: ${sanitizeUserInput(q.brandPersonality || "not specified")}
- Target audience: ${sanitizeUserInput(q.audience || "not specified")}
- Desired feeling: ${sanitizeUserInput(q.desiredFeeling || "not specified")}
${q.primaryColor ? `- Brand color to build around: ${sanitizeUserInput(q.primaryColor)}` : "- No specific brand color provided — choose freely"}

Requirements:
- backgroundColor must be a light color (white or near-white) for readability
- textColor must have high contrast against backgroundColor (WCAG AA minimum)
- primaryColor should be vibrant and work as an accent on the light background
- secondaryColor should complement primaryColor
- fontSuggestion must be a real Google Font name
- layoutStyle: "geometric" for structured/corporate, "organic" for warm/approachable, "editorial" for elegant/premium, "structured" for clean/functional
${q.primaryColor ? `- Build the entire palette around the provided brand color ${q.primaryColor}. Use it as primaryColor or derive primaryColor from it.` : ""}

CRITICAL: All colors must be valid 6-digit hex codes starting with #. Ensure sufficient contrast between text and background.`;

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      systemInstruction: "You are a brand identity designer. Generate a cohesive presentation color palette and typography recommendation based on user preferences.",
      responseSchema: THEME_SCHEMA,
      maxOutputTokens: 2048,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Fallback theme if parsing fails
    parsed = {
      primaryColor: "#2563eb",
      secondaryColor: "#60a5fa",
      backgroundColor: "#ffffff",
      textColor: "#1e293b",
      mutedTextColor: "#94a3b8",
      fontSuggestion: "Inter",
      layoutStyle: "geometric",
      designReasoning: "A clean, professional default palette.",
    };
  }

  return jsonResponse({ ...parsed, _usage: usageMetadata });
}

// ============================================
// Slide Content Generation — AI-generated slide deck content
// ============================================

const SLIDE_CONTENT_GEN_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
          keyFact: { type: "string" },
          layoutSuggestion: { type: "string", description: "hero | two-column | stats-highlight | comparison | timeline" },
          sourceContext: { type: "string" },
        },
        required: ["title", "bullets", "layoutSuggestion"],
      },
    },
    disclaimer: { type: "string", description: "Copyright notice, distribution restriction, or attribution disclaimer found in the source material. Extract verbatim if present. Leave empty if none found." },
    dataVerification: {
      type: "object",
      properties: {
        totalSourcePages: { type: "integer" },
        pagesReferenced: { type: "integer" },
        coveragePercentage: { type: "integer" },
        missingTopics: { type: "array", items: { type: "string" } },
      },
      required: ["totalSourcePages", "pagesReferenced", "coveragePercentage"],
    },
  },
  required: ["slides", "dataVerification"],
};

async function handleSlideContentGeneration(body: DemoRequest): Promise<Response> {
  const topic = sanitizeUserInput(body.topic || "");
  const sector = sanitizeUserInput(body.sector || "General");

  const files = body.files || [];
  let fileParts: Awaited<ReturnType<typeof resolveFileParts>> = [];
  try {
    fileParts = await resolveFileParts(files);
  } catch (err) {
    console.warn("File resolution failed for slide content, continuing with topic only:", err);
  }

  const hasFiles = fileParts.length > 0;

  const prompt = `
    Create a 10-15 slide presentation deck ${hasFiles ? 'from this course material' : 'for a course on this topic'}.

    <user_content>
    Topic: "${topic}"
    Industry: ${sector}
    </user_content>

    TASK: Generate structured slide content. Each slide should have a clear purpose and contain specific, fact-rich content ${hasFiles ? 'extracted from the uploaded materials' : `about "${topic}" in the ${sector} sector`}.

    For each slide provide:
    - title: A clear, engaging slide title
    - subtitle: Optional subtitle or section label
    - bullets: 3-5 specific, fact-rich bullet points. Each must contain a concrete detail, number, process name, or technical term.
    - keyFact: The single most important stat or fact on this slide (a number, percentage, or 2-4 word metric). Leave empty if no standout stat.
    - layoutSuggestion: One of "hero" (for intro/impact slides), "two-column" (for comparisons), "stats-highlight" (for data-heavy), "comparison" (for before/after), "timeline" (for sequential processes)
    - sourceContext: Brief note on what part of the source material this slide covers

    After generating slides, provide dataVerification:
    - totalSourcePages: Total pages in the uploaded material (estimate if not a PDF)
    - pagesReferenced: How many source pages contributed to slides
    - coveragePercentage: Percentage of source material covered (0-100)
    - missingTopics: Important topics from the source that were NOT included in the slides

    CRITICAL CONSTRAINTS (follow exactly):
    - ${hasFiles ? 'Extract REAL content from the uploaded materials — do not invent facts' : 'Use accurate, current knowledge about this subject'}
    - Every bullet must contain a specific fact, number, tool name, or technical detail — NOT generic statements
    - Vary layoutSuggestion across slides — do not use the same layout for every slide
    - First slide should use "hero" layout
    - Include a mix of conceptual, technical, and applied content
    - Do NOT generate generic filler like "Understanding the basics"
    - DO generate specific content like "Amazon S3 provides 11 9s (99.999999999%) of data durability"
    - If the source material contains a copyright notice, disclaimer, or distribution restriction, extract it verbatim into the disclaimer field
  `;

  const parts = [...fileParts, { text: prompt }];

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      responseSchema: SLIDE_CONTENT_GEN_SCHEMA,
      maxOutputTokens: 8192,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse({
      slides: [],
      dataVerification: { totalSourcePages: 0, pagesReferenced: 0, coveragePercentage: 0, missingTopics: [] },
      _usage: usageMetadata,
    });
  }

  return jsonResponse({
    slides: parsed.slides || [],
    dataVerification: parsed.dataVerification || { totalSourcePages: 0, pagesReferenced: 0, coveragePercentage: 0, missingTopics: [] },
    _usage: usageMetadata,
  });
}

// ============================================
// Infographic Slide Selection — Gemini reasoning picks the best slide for a visual
// ============================================

const INFOGRAPHIC_SELECTION_SCHEMA = {
  type: "object",
  properties: {
    selectedSlideIndex: { type: "integer", description: "0-based index of the slide that would benefit most from an infographic" },
    reasoning: { type: "string", description: "Brief explanation of why this slide was chosen" },
    imagePrompt: { type: "string", description: "Detailed prompt for generating an infographic. Should describe the visual in detail: layout, data points, icons, color guidance. Start with 'Create a clean, modern infographic'" },
  },
  required: ["selectedSlideIndex", "reasoning", "imagePrompt"],
};

async function handleInfographicSelection(body: DemoRequest): Promise<Response> {
  const slides = (body as any).slides || [];
  const topic = sanitizeUserInput(body.topic || "");
  const sector = sanitizeUserInput(body.sector || "General");

  if (slides.length === 0) {
    return jsonResponse({ selectedSlideIndex: 0, reasoning: "No slides provided", imagePrompt: "" });
  }

  const slideSummaries = slides.map((s: any, i: number) =>
    `Slide ${i}: "${s.title}" — ${(s.bullets || []).slice(0, 3).join('; ')}${s.keyFact ? ` [Key fact: ${s.keyFact}]` : ''}`
  ).join('\n');

  const prompt = `
    Analyze these course slides and select the ONE slide that would benefit most from an infographic visualization.

    <slides>
    ${slideSummaries}
    </slides>

    Topic: "${topic}"
    Industry: ${sector}

    Pick the slide with the most data-rich, quantitative, or process-oriented content — the kind of content that becomes dramatically clearer as a visual diagram, flowchart, comparison chart, or data visualization.

    For the imagePrompt, describe a specific infographic: mention layout style (flowchart, comparison grid, radial diagram, timeline), specific data points or labels to include, and color scheme guidance.

    CRITICAL CONSTRAINTS:
    - Do NOT pick the first or last slide (intro/conclusion) — pick a content-rich middle slide
    - The imagePrompt must describe a SPECIFIC infographic, not a generic illustration
    - The infographic should visualize the actual data/process from the slide content
    - Start imagePrompt with "Create a clean, modern infographic"
  `;

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      responseSchema: INFOGRAPHIC_SELECTION_SCHEMA,
      maxOutputTokens: 1024,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse({
      selectedSlideIndex: Math.min(2, slides.length - 1),
      reasoning: "Parse error — defaulting to slide 3",
      imagePrompt: `Create a clean, modern infographic about ${topic} in the ${sector} sector`,
      _usage: usageMetadata,
    });
  }

  return jsonResponse({
    ...parsed,
    _usage: usageMetadata,
  });
}

async function handleBasicMode(body: DemoRequest): Promise<Response> {
  const styleMap: Record<string, string> = {
    modern: "Clean, minimalist design with bold typography and ample white space. Use gradients and subtle shadows.",
    corporate: "Professional, polished look with consistent branding elements. Navy, gray, and accent colors.",
    playful: "Colorful, engaging design with illustrations and icons. Rounded corners and friendly fonts.",
    technical: "Data-focused with charts, diagrams, and code snippets. Dark theme with syntax highlighting.",
  };

  const safeStyle = sanitizeUserInput(body.style || "modern");
  const safeLocation = sanitizeUserInput(body.location || "");
  const safeTopic = sanitizeUserInput(body.topic);
  const styleDescription = styleMap[safeStyle] || styleMap.modern;

  const systemPrompt = `Create modernized training slides.

Design Style: ${styleDescription}
${safeLocation ? `Geographic Context: ${safeLocation} (include relevant local regulations/standards)` : ""}

For each slide:
1. Create a clear, action-oriented title
2. Write 3-5 concise bullet points
3. Suggest a visual prompt for AI image generation
4. Recommend a color theme that fits the style

Each bullet must include a specific fact, regulation number, or actionable instruction — not generic statements.`;

  // Resolve file data from inline base64 or storage
  const fileDataArr = body.fileData ? [body.fileData] : [];
  const fileParts = await resolveFileParts(fileDataArr);

  const parts = [
    ...fileParts,
    {
      text: fileParts.length > 0
        ? `Analyze this document and create modernized training slides based on its content. Topic context: ${safeTopic}`
        : `Create 5-7 modernized training slides for this topic: ${safeTopic}`,
    },
  ];

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      systemInstruction: systemPrompt,
      responseSchema: SLIDES_SCHEMA,
      maxOutputTokens: 4096,
    }
  );

  let slides;
  try {
    slides = JSON.parse(text);
  } catch {
    slides = [
      {
        title: body.topic,
        bullets: [text.substring(0, 200)],
        visualPrompt: `Professional illustration for ${body.topic}`,
        colorTheme: "blue-600",
      },
    ];
  }

  return jsonResponse({ slides, _usage: usageMetadata });
}

async function handleEnhancedMode(body: DemoRequest): Promise<Response> {
  const sector = sanitizeUserInput(body.sector || "General");
  const location = sanitizeUserInput(body.location || "United States");
  const updateMode = body.updateMode || "full";
  const style = sanitizeUserInput(body.style || "modern");

  // Resolve uploaded files from inline base64 or storage
  const files = body.files || [];
  let fileParts: Awaited<ReturnType<typeof resolveFileParts>> = [];
  try {
    fileParts = await resolveFileParts(files);
  } catch (err) {
    console.warn("File resolution failed for enhanced mode, continuing without file content:", err);
  }

  const isVisualOnly = updateMode === "visual";
  const accentColor = style === 'modern' ? '#2563eb' : style === 'playful' ? '#ea580c' : style === 'minimal' ? '#18181b' : '#d4a843';

  const styleGuide: Record<string, string> = {
    modern: "Professional corporate theme. White/light background, dark text. Accent: #2563eb (professional blue). Clean sans-serif typography, ample whitespace. Like a polished Keynote template. Suggest shield-check, zap, or trending-up icons.",
    playful: "Warm, engaging educational theme. Light warm background, dark text. Accent: #ea580c (energetic orange). Rounded elements, friendly typography. Like a modern e-learning platform. Suggest star, trophy, or rocket icons.",
    minimal: "Ultra-clean minimalist theme. Near-white background, very dark text. Accent: #18181b (near-black). Maximum whitespace, thin geometric lines. Like a Swiss design poster. Suggest circle-dot, minus, or hash icons.",
    academic: "Formal scholarly theme. Dark navy background (#0f172a), light text. Accent: #d4a843 (gold). Structured layout, gold accents. Like a university lecture deck. Suggest book-open, award, or scale icons.",
  };

  // ── System Instruction: Designer Persona ──
  const systemInstruction = isVisualOnly
    ? [
        "You are an award-winning Presentation Designer specializing in visual modernization of existing course materials.",
        "",
        "Your Design Principles:",
        "1. FAITHFUL READING: You read every word, number, and visual element on each PDF page before working with it. You never invent, hallucinate, or substitute content.",
        "2. Page Classification First: Before selecting pages to redesign, you classify EVERY page as TEXT_HEAVY, DIAGRAM, INFOGRAPHIC, or TITLE_PAGE.",
        "3. Only Redesign Text: You ONLY redesign TEXT_HEAVY pages. Diagrams, infographics, org charts, flowcharts, and inheritance diagrams are SKIPPED — they are already visual.",
        "4. Zero Content Loss: The redesigned slide contains 100% of the original text content. Same title, same data, same facts. Only the visual presentation changes.",
        "5. Visual Hierarchy: You create clear hierarchy through typography size, color accents, and spatial layout — not by changing content.",
        "",
        "What counts as a DIAGRAM or INFOGRAPHIC (SKIP these):",
        "- Org charts, inheritance trees, permission matrices (e.g., IAM Policies with users and groups)",
        "- Flowcharts, process diagrams, architecture diagrams",
        "- Gartner Magic Quadrants, scatter plots, pie charts, bar graphs",
        "- Network topology diagrams, system architecture visuals",
        "- Any page where the primary content is a VISUAL ELEMENT rather than text bullets",
        "",
        "What counts as TEXT_HEAVY (redesign these):",
        "- Pages with a title and bullet points listing facts, features, or specifications",
        "- Pages with paragraphs of text that could benefit from better visual hierarchy",
        "- Pages with data tables that could be reformatted",
        "",
        "Format Requirements: Output must be valid JSON matching the provided schema.",
      ].join("\n")
    : [
        "You are an award-winning Presentation Designer and Content Strategist. You take outdated course slides and create dramatically modernized versions with current data and compelling visual design.",
        "",
        "Your Design Principles:",
        "1. Radical Transformation: The before and after must look like completely different slides. The before is boring and vague; the after is specific, data-rich, and visually striking.",
        "2. Visual Dominance: Prioritize big numbers, clear headings, and structured layouts over text walls.",
        "3. Hierarchy: Clearly distinguish the Headline (the takeaway) from the Body (the evidence).",
        "4. Data-Driven: Every after bullet must contain a specific number, date, or technical fact.",
        "",
        "Format Requirements: Output must be valid JSON matching the provided schema.",
      ].join("\n");

  // ── User Prompt: Structured Input → Instructions → Constraints ──

  // Section 1: Input Data
  const inputSection = [
    "### INPUT DATA",
    '"""',
    "Course Topic: " + sanitizeUserInput(body.topic),
    "Industry: " + sector,
    "Location: " + location,
    "Style: " + style + ". " + (styleGuide[style] || styleGuide.modern),
    files.length > 0 ? "Source: Uploaded course PDF (attached as file). Read every page carefully." : "Source: No file uploaded. Create realistic example slides for this topic.",
    '"""',
  ].join("\n");

  // Section 2: Page Classification
  const classificationSection = files.length > 0 ? [
    "",
    "### STEP 1: PAGE CLASSIFICATION",
    "Before generating any slides, examine EVERY page of the uploaded PDF.",
    "For each page, record in pageClassifications:",
    "- pageNumber: the 1-based page number",
    "- pageTitle: the title or heading visible on that page",
    "- classification: exactly one of TEXT_HEAVY, DIAGRAM, INFOGRAPHIC, TITLE_PAGE, TABLE_OF_CONTENTS",
    "- reason: why you classified it this way (e.g., 'Contains a flowchart showing IAM policy inheritance' or 'Bullet list of S3 storage facts')",
    "",
    "THEN select exactly 3 TEXT_HEAVY pages for redesign. If fewer than 3 TEXT_HEAVY pages exist, select as many as are available.",
  ].join("\n") : "";

  // Section 3: Slide Instructions (visual-only vs content mode)
  let slideInstructions = "";

  if (isVisualOnly) {
    slideInstructions = [
      "",
      "### STEP 2: VISUAL REDESIGN (zero content changes)",
      "Create exactly 3 slides from TEXT_HEAVY pages only.",
      "",
      '"before" — Faithful transcription of the PDF page:',
      "- title: The EXACT title shown on the PDF page, character for character",
      "- subtitle: The section/module label from the PDF page",
      "- bullets: Transcribe ALL key data points. Every number, name, percentage, fact, and reference mentioned on the page. If the page mentions a 'Gartner Magic Quadrant', that must appear in the bullets. If it says '31% market share', include it exactly.",
      "- keyFact: Leave empty",
      "- citationIds: Empty array",
      "- sourcePageNumber: The page number from the PDF",
      "",
      '"after" — Same content, modernized visual design (SAME page as before):',
      "- title: IDENTICAL to before.title — copy it character for character",
      "- subtitle: IDENTICAL to before.subtitle",
      "- keyFact: Pull one prominent number/stat from the before bullets (e.g., '31% market share' becomes '31%'). If no numbers, leave empty.",
      "- bullets: EVERY bullet from before MUST appear. You may slightly reword for visual rhythm, but NO facts, numbers, or references may be dropped. If before has 5 bullets, after has 5 bullets.",
      "- citationIds: Empty array",
      "- sourcePageNumber: SAME as before.sourcePageNumber — this is a redesign of the SAME page",
      "",
      "The ONLY changes are: typography hierarchy, color accents, spatial layout, and visual structure.",
      "",
      "changesSummary: Vary — 'RESTRUCTURED', 'VISUAL HIERARCHY', 'STREAMLINED', 'MODERNIZED LAYOUT', 'ENHANCED READABILITY'. Different for each slide.",
    ].join("\n");
  } else {
    slideInstructions = [
      "",
      "### STEP 2: CONTENT + VISUAL REDESIGN",
      "Create exactly 3 slides. Each shows a dramatic before/after transformation.",
      "",
      '"before" — A boring, outdated PowerPoint slide:',
      "- title: Plain topic name only. No benefits language.",
      "- subtitle: Generic module/section label (e.g., 'Module 3 - Core Services')",
      "- bullets: 3-4 GENERIC, VAGUE phrases. No specific numbers, no citations. Should feel like 2018-era content.",
      "- keyFact: Empty",
      "- citationIds: Empty array",
      "- sourcePageNumber: Page number from PDF if uploaded",
      "",
      '"after" — Agency-quality modernized slide:',
      "- title: Reframe as a BENEFIT or INSIGHT (e.g., 'Storage That Scales to Zero Cost'). Must differ from before title.",
      "- subtitle: Punchy tagline, max 6 words",
      "- keyFact: The single most impressive stat. A number or 2-4 word metric (e.g., '11 9s', '99.999%', '3x Faster'). NEVER a sentence.",
      "- bullets: 3-4 phrases with specific numbers, dates, or specs in every bullet. Cite sources with [N] markers.",
      "- citationIds: IDs matching citations array",
      "",
      "changesSummary: Category labels — 'UPDATED PRICING', 'NEW STANDARD', 'REVISED SPEC', 'CURRENT DATA'. Different for each slide.",
    ].join("\n");
  }

  // Section 4: Visual Style + Image
  const visualSection = [
    "",
    "### VISUAL STYLE",
    "- accentColor: '" + accentColor + "' for all slides",
    "- layout assignments: Slide 1 (id 'slide-1') = 'hero', Slide 2 (id 'slide-2') = 'two-column', Slide 3 (id 'slide-3') = one of 'stats-highlight', 'timeline', 'comparison'",
    "- iconSuggestion: A Lucide icon name (shield-check, zap, trending-up, book-open, target, award, star, clock)",
    "",
    "imagePrompt format: 'Flat vector illustration of [specific subject with 2-3 details], clean white background, [color palette], no text, no labels'",
    "",
    "designReasoning: Explain why you chose this page and this layout. What visual transformation does it apply?",
  ].join("\n");

  // Section 5: Critical Constraints (LAST per Gemini 3 best practices)
  let criticalConstraints = "";

  if (isVisualOnly) {
    criticalConstraints = [
      "",
      "### CRITICAL CONSTRAINTS (override everything above)",
      "- pageClassifications MUST cover every page in the PDF, not just selected ones",
      "- Only select TEXT_HEAVY pages for slides. NEVER redesign a DIAGRAM or INFOGRAPHIC page.",
      "- NEVER select copyright, disclaimer, legal notice, table of contents, blank, or cover pages for slides. Only select TEXT_HEAVY pages with substantive educational content.",
      "- If before/after titles are nearly identical and bullets have no meaningful differences, the slide is INVALID.",
      "- SAME PAGE RULE: before and after MUST be the SAME page. before.sourcePageNumber and after.sourcePageNumber must be identical. The after is a visual redesign of the before — NEVER content from a different page.",
      "- before.title and after.title MUST be identical — character for character. If they differ, you have failed.",
      "- ZERO content loss: every fact, number, name, and data point in before MUST appear in after. Count the bullets — if before has N bullets, after must have at least N bullets.",
      "- If a page mentions an infographic, chart, or visual element (e.g., 'Gartner Magic Quadrant'), reference it in the bullets",
      "- keyFact is NEVER a sentence. Max 5 words. Prefer numbers.",
      "- No bullet starts with a gerund (Understanding, Exploring, Leveraging, Implementing, Ensuring)",
      "- changesSummary MUST be DIFFERENT for each slide",
      "- sourcePageNumber is REQUIRED for every before AND after slide — and they MUST match",
    ].join("\n");
  } else {
    criticalConstraints = [
      "",
      "### CRITICAL CONSTRAINTS (override everything above)",
      "- 'before' must read like a REAL BORING slide — generic and vague. If a before bullet has a specific stat, you have failed.",
      "- 'after' must be COMPLETELY DIFFERENT — specific, data-rich, benefit-oriented. If an after bullet lacks a number, you have failed.",
      "- NEVER select copyright, disclaimer, legal notice, table of contents, blank, or cover pages for slides. Only select TEXT_HEAVY pages with substantive educational content.",
      "- If before/after titles are nearly identical and bullets have no meaningful differences, the slide is INVALID.",
      "- after titles name the TOPIC BENEFIT, not the update process",
      "- Every citation must have a real URL from search results",
      "- keyFact is NEVER a sentence. Max 5 words. Prefer numbers.",
      "- No bullet starts with a gerund (Understanding, Exploring, Leveraging, Implementing, Ensuring)",
      "- changesSummary MUST be DIFFERENT for each slide",
      "- sourcePageNumber is REQUIRED for every before slide when a PDF is uploaded",
    ].join("\n");
  }

  const prompt = inputSection + classificationSection + slideInstructions + visualSection + criticalConstraints;

  const parts = [...fileParts, { text: prompt }];

  // Gemini 3: System Instruction + Structured Output + optional Search Grounding
  // Visual-only mode doesn't need search grounding (no content changes)
  const geminiOptions: Record<string, unknown> = {
    systemInstruction,
    responseSchema: ENHANCED_SLIDES_SCHEMA,
    maxOutputTokens: 16384,
  };
  if (!isVisualOnly) {
    geminiOptions.tools = [{ googleSearch: {} }];
  }
  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    geminiOptions,
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // If structured output fails, return a minimal result
    return jsonResponse({
      slides: [],
      citations: [],
      metadata: {
        sector,
        location,
        updateMode,
        generatedAt: new Date().toISOString(),
        searchQueries: [],
      },
      _usage: usageMetadata,
    });
  }

  // Run review pass to catch low-quality slides
  const reviewedSlides = await reviewAndCorrectSlides(
    parsed.slides || [],
    parsed.citations || [],
    body.topic,
    sector,
  );

  return jsonResponse({
    slides: reviewedSlides,
    citations: parsed.citations || [],
    metadata: {
      sector: parsed.metadata?.sector || sector,
      location: parsed.metadata?.location || location,
      updateMode: parsed.metadata?.updateMode || updateMode,
      generatedAt: new Date().toISOString(),
      searchQueries: parsed.metadata?.searchQueries || [],
    },
    _usage: usageMetadata,
  });
}

// ============================================
// Stage 1: Findings Scan — analyze course, return structured findings
// ============================================

async function handleFindingsScan(body: DemoRequest): Promise<Response> {
  const sector = sanitizeUserInput(body.sector || "General");
  const location = sanitizeUserInput(body.location || "United States");
  const updateMode = body.updateMode || "full";
  const topic = sanitizeUserInput(body.topic);

  const files = body.files || [];
  let fileParts: Awaited<ReturnType<typeof resolveFileParts>> = [];
  try {
    fileParts = await resolveFileParts(files);
  } catch (err) {
    console.warn("File resolution failed for findings scan, continuing without file content:", err);
  }

  let categoryInstructions = "";
  if (updateMode === "regulatory" || updateMode === "full") {
    categoryInstructions += `
    1. OUTDATED: Content that was once correct but has been superseded (old service names, deprecated features, outdated best practices, changed procedures)
    2. COMPLIANCE: Regulatory or standards changes that affect the course content (only if the course explicitly teaches compliance topics)`;
  }
  if (updateMode === "visual" || updateMode === "full") {
    categoryInstructions += `
    3. MISSING: Important topics that should be in a modern course on this subject but are absent
    4. STRUCTURAL: Format issues (text-heavy slides, missing assessments, poor visual hierarchy)`;
  }

  const prompt = `
    Analyze the following course materials and identify what needs updating.

    <user_content>
    Topic: "${topic}"
    Industry: ${sector}
    Location: ${location}
    </user_content>

    TASK: Identify what needs updating. DO NOT generate new slides or rewritten content. Only analyze and report findings.

    Categories of findings:
    ${categoryInstructions}

    For OUTDATED and COMPLIANCE findings, use search to verify what has actually changed.
    For each finding, set sourceSnippet to the specific text or concept from the course that triggered the finding.
    For each finding, set currentInfo to what the current correct state is (from search results).

    CRITICAL CONSTRAINTS (follow exactly):
    - Focus ONLY on the course's primary subject matter. An AWS cloud course is about AWS services — not tangentially related privacy laws or AI governance.
    - Every factual claim must come from either the uploaded course materials or from search results. Do not invent facts, dates, regulation numbers, or statistics.
    - If you cannot determine when the course was created, say "undated" — do not fabricate a year.
    - Do NOT flag regulations unless the course explicitly teaches that regulatory topic.
    - For technical certification courses, focus on: deprecated services/features, changed best practices, new tools/services that the course teaches.
    - At most 1 finding may be about exam structure changes (blueprint, format, passing score). The majority of findings (at least 2-3) must be about the actual course CONTENT — outdated facts, deprecated practices, missing knowledge areas, or stale examples being taught.
    - Severity: HIGH = core content is wrong or could cause errors. MEDIUM = content is stale but not incorrect. LOW = nice-to-have improvement.
    - Return the 3-5 most impactful findings. Prioritize findings that are impressive and specific. This is a demo preview.
    - Set totalEstimatedFindings to your honest estimate of HOW MANY TOTAL findings a full deep scan would produce across all categories (outdated, missing, compliance, structural, accessibility, visual design, assessment gaps, etc.). Consider the size and age of the course material. Be realistic — a large course might have 30-80+, a small one might have 10-25.
    - Set id to "finding-1", "finding-2", etc.
    - category must be exactly one of: "outdated", "missing", "compliance", "structural"
    - severity must be exactly one of: "high", "medium", "low"
    - If the content appears current and accurate, return an empty findings array with a courseSummary explaining that.
  `;

  const parts = [...fileParts, { text: prompt }];

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      responseSchema: FINDINGS_SCHEMA,
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 16384,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return errorResponse("Failed to parse scan results from Gemini", 502);
  }

  return jsonResponse({
    findings: parsed.findings || [],
    searchQueries: parsed.searchQueries || [],
    courseSummary: parsed.courseSummary || "",
    _usage: usageMetadata,
  });
}

// ============================================
// Stage 2: Guided Generation — generate slides from approved findings
// ============================================

async function handleGuidedGeneration(body: DemoRequest): Promise<Response> {
  const sector = sanitizeUserInput(body.sector || "General");
  const location = sanitizeUserInput(body.location || "United States");
  const updateMode = body.updateMode || "full";
  const style = body.style || "modern";
  const approvedFindings = body.approvedFindings || [];
  const userContext = sanitizeUserInput(body.userContext || "");
  const designPrefs = body.designPreferences;

  const files = body.files || [];
  let fileParts: Awaited<ReturnType<typeof resolveFileParts>> = [];
  try {
    fileParts = await resolveFileParts(files);
  } catch (err) {
    console.warn("File resolution failed for guided generation, continuing without file content:", err);
  }

  const findingsText = approvedFindings
    .map((f) => `- [${sanitizeUserInput(f.category).toUpperCase()}/${sanitizeUserInput(f.severity)}] ${sanitizeUserInput(f.title)}: ${sanitizeUserInput(f.description)}`)
    .join("\n");

  let designContext = "";
  if (designPrefs) {
    designContext = `
    Design preferences:
    - Target audience: ${sanitizeUserInput((designPrefs.audience || "").slice(0, MAX_DESIGN_PREF_LENGTH))}
    - Desired learner feeling: ${sanitizeUserInput((designPrefs.feeling || "").slice(0, MAX_DESIGN_PREF_LENGTH))}
    - Emphasis: ${sanitizeUserInput((designPrefs.emphasis || "").slice(0, MAX_DESIGN_PREF_LENGTH))}
    `;
  }

  const styleGuide: Record<string, string> = {
    modern: "Professional corporate theme. White/light background, dark text. Accent: #2563eb (professional blue). Clean sans-serif typography, ample whitespace, subtle drop shadows. Like a polished Keynote template. Suggest shield-check, zap, or trending-up icons.",
    playful: "Warm, engaging educational theme. Light warm background (#fffbeb cream), dark text. Accent: #ea580c (energetic orange). Rounded elements, friendly typography, subtle warm gradients. Like a modern e-learning platform. Suggest star, trophy, or rocket icons.",
    minimal: "Ultra-clean minimalist theme. Near-white background (#fafafa), very dark text. Accent: #18181b (near-black). Maximum whitespace, thin geometric lines, precise typography. Like a Swiss design poster. Suggest circle-dot, minus, or hash icons.",
    academic: "Formal scholarly theme. Dark navy background (#0f172a), light text. Accent: #d4a843 (gold). Structured layout, serif-influenced display type, gold divider lines. Like a university lecture deck. Suggest book-open, award, or scale icons.",
  };

  const prompt = `
    Redesign course slides for: "${sanitizeUserInput(body.topic)}" (${sector}, ${location}).
    Style: ${style}. ${styleGuide[style] || styleGuide.modern}
    ${userContext ? `Context: ${userContext}` : ""}
    ${designContext}

    Approved changes to incorporate:
    ${findingsText}

    Create 3 slides. Each addresses one approved finding above, shown as "before" (original with the problem) and "after" (redesigned with the fix incorporated).

    THE "BEFORE" AND "AFTER" MUST BE DRAMATICALLY DIFFERENT. The whole point is showing transformation. If they look similar, the demo fails.

    SLIDE CONTENT RULES:

    "before" (the ORIGINAL slide — a real, boring, outdated PowerPoint):
    The "before" slide must feel like it was made by a non-designer years ago. Flat, generic, text-heavy. It shows the PROBLEMATIC content that the finding identified.
    - title: Plain topic name only. No clever framing, no benefits language.
      GOOD titles: "S3 Storage Classes", "VPC Networking", "Fall Protection Requirements"
      BAD titles: "Mastering S3 Storage", "Next-Gen Networking" (too polished for an old slide)
    - subtitle: Generic module/section label.
      GOOD subtitles: "Module 3 - Core Services", "Section 2.1", "AWS Fundamentals"
      BAD subtitles: "Empowering Your Cloud Journey" (too polished)
    - bullets: 3-4 GENERIC, VAGUE phrases showing the outdated content. These should reflect the PROBLEM identified in the finding — old stats, deprecated features, stale info. No impressive numbers, no citations.
      GOOD before bullets: "Multiple storage tiers available", "Data stored with high durability", "Standard retrieval takes several hours"
      BAD before bullets: "99.999999999% durability across 3+ AZs" (too specific and accurate for an outdated slide)
    - keyFact: Leave empty or omit — old slides don't have visual anchors.
    - citationIds: Empty array — old slides have no citations.
    - sourcePageNumber: The 1-based page number from the uploaded PDF. Required when a PDF is uploaded.

    "after" (the REDESIGNED slide — a complete transformation, agency-quality):
    The "after" must feel like a DIFFERENT SLIDE, not a minor edit. It incorporates the fix from the approved finding with specific, verified data.
    - title: Reframe the topic as a BENEFIT or INSIGHT statement. The title should answer "why should I care?"
      GOOD after titles: "Storage That Scales to Zero Cost", "11 9s of Durability — Built In", "Eliminate Falls: The #1 Construction Killer"
      BAD after titles: "S3 Storage Classes" (same as before), "Updated Storage Info" (describes the process)
    - subtitle: Punchy tagline, max 6 words.
      GOOD: "Built for enterprise scale", "Save 40% automatically"
      BAD: "An overview of storage options" (too generic)
    - keyFact: THE SINGLE MOST IMPRESSIVE STAT related to the finding's correction. Must be a number, percentage, or punchy 2-4 word metric.
      GOOD: "11 9s", "99.999%", "< 10ms", "$0.023/GB", "3x Faster", "Zero Downtime"
      BAD: "Highly durable storage solution" (sentence, not a stat)
      If no hard stat exists, create a compelling metric framing: "3x Faster", "Zero Downtime", "100% Automated"
    - bullets: 3-4 phrases, 5-10 words max. EVERY bullet MUST contain a specific number, percentage, date, or technical specification from the corrected/current information. Bullets with corrected info get " [N]" citation marker.
      GOOD: "Automatic cross-region replication across 3+ AZs [1]", "Intelligent-Tiering saves up to 40% [2]", "Glacier Deep Archive: $0.00099/GB/month"
      BAD: "Improved storage capabilities", "Better data management" (vague, no specifics)
    - citationIds: IDs for verified facts from search results

    imagePrompt: Must reference the SPECIFIC topic of the slide with 2-3 concrete visual details.
    Format: "Flat vector illustration of [specific technical subject with 2-3 details], clean white background, [color palette], no text, no labels"
    GOOD: "Flat vector illustration of cloud storage architecture with S3 buckets, data lifecycle arrows, and tiered pricing layers, clean white background, blue and gray palette, no text, no labels"
    BAD: "Flat vector illustration of cloud computing, clean white background" (too vague)

    visualStyle:
    - accentColor: "${style === 'modern' ? '#2563eb' : style === 'playful' ? '#ea580c' : style === 'minimal' ? '#18181b' : '#d4a843'}". Same across all slides.
    - layout: MUST follow this exact assignment:
      Slide 1 (id "slide-1"): "hero"
      Slide 2 (id "slide-2"): "two-column"
      Slide 3 (id "slide-3"): one of "stats-highlight", "timeline", or "comparison"
      NEVER repeat the same layout across slides.
    - iconSuggestion: A Lucide icon name (shield-check, zap, trending-up, book-open, target, award, star, clock)

    changesSummary: A 2-3 word CATEGORY LABEL, varied across slides. Use: "UPDATED PRICING", "NEW STANDARD", "REVISED SPEC", "CURRENT DATA", "NEW REQUIREMENT". Never repeat the same label across slides.

    CRITICAL — these rules override everything above:
    - sourcePageNumber is REQUIRED for every "before" slide when a PDF is uploaded
    - keyFact is NEVER a sentence. Max 5 words. Prefer numbers.
    - No bullet starts with a gerund (Understanding, Exploring, Leveraging, Implementing, Ensuring)
    - "before" must read like a REAL BORING course slide — generic and vague. If a "before" bullet contains a specific stat or citation, you have failed.
    - "after" must read like a COMPLETELY DIFFERENT slide — specific, data-rich, benefit-oriented. If an "after" bullet lacks a number or specific fact, you have failed.
    - "after" titles name the TOPIC BENEFIT, not the update process
    - Every citation must have a real URL from search results
    - changesSummary must be DIFFERENT for each slide — never repeat
    - NEVER select copyright, disclaimer, legal notice, table of contents, blank, or cover pages for slides. Only select TEXT_HEAVY pages with substantive educational content.
    - If before/after titles are nearly identical and bullets have no meaningful differences, the slide is INVALID.
  `;

  const parts = [...fileParts, { text: prompt }];

  const { text: genText, usageMetadata: genUsage } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      responseSchema: ENHANCED_SLIDES_SCHEMA,
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 16384,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(genText);
  } catch {
    return jsonResponse({
      slides: [],
      citations: [],
      metadata: {
        sector,
        location,
        updateMode,
        generatedAt: new Date().toISOString(),
        searchQueries: [],
      },
      _usage: genUsage,
    });
  }

  // Run review pass to catch low-quality slides
  const reviewedSlides = await reviewAndCorrectSlides(
    parsed.slides || [],
    parsed.citations || [],
    body.topic,
    sector,
  );

  return jsonResponse({
    slides: reviewedSlides,
    citations: parsed.citations || [],
    metadata: {
      sector: parsed.metadata?.sector || sector,
      location: parsed.metadata?.location || location,
      updateMode: parsed.metadata?.updateMode || updateMode,
      generatedAt: new Date().toISOString(),
      searchQueries: parsed.metadata?.searchQueries || [],
    },
    _usage: genUsage,
  });
}

const SECTOR_SCHEMA = {
  type: "object",
  properties: {
    sector: { type: "string" },
    confidence: { type: "string" },
    alternatives: { type: "array", items: { type: "string" } },
    reasoning: { type: "string" },
    isAmbiguous: { type: "boolean" },
    detectedTopics: { type: "array", items: { type: "string" } },
  },
  required: ["sector", "confidence", "reasoning", "isAmbiguous"],
};

async function handleSectorInference(body: DemoRequest): Promise<Response> {
  // Resolve uploaded files — gracefully degrade if storage download fails
  const files = body.files || [];
  let fileParts: Awaited<ReturnType<typeof resolveFileParts>> = [];
  try {
    fileParts = await resolveFileParts(files);
  } catch (err) {
    console.warn("File resolution failed for sector inference, continuing with topic only:", err);
  }

  const prompt = `
    Determine the primary industry for this training/certification material.

    ${body.topic ? `Topic: "${sanitizeUserInput(body.topic)}"` : "No topic provided - infer from files only."}

    Pick the single best-matching industry:
    - Healthcare, Pharmaceuticals
    - Construction, Manufacturing, Mining & Resources
    - Food Service, Hospitality & Tourism
    - Transportation & Logistics, Aviation
    - Finance & Banking, Insurance, Accounting & Audit
    - Energy & Utilities, Environmental & Sustainability
    - Legal & Compliance, Government & Public Sector
    - Information Technology, Cloud Computing, Cybersecurity, Software Engineering, Data Science & AI
    - Telecommunications, Media & Communications
    - Education & Training, Human Resources, Project Management
    - Real Estate, Retail & E-Commerce
    - Agriculture, Nonprofit & NGO

    Return the industry name exactly as listed above.

    CRITICAL RULES:
    - Identify the PRIMARY industry of the course itself, not industries mentioned as examples within the course.
    - A cloud computing certification that uses plumbing as an analogy is Cloud Computing, not Construction.
    - Set isAmbiguous to false unless the course genuinely spans two equal industries.
    - Include 3-5 specific subjects in detectedTopics (e.g., "AWS Solutions Architect", "EC2 Instance Types") — not generic category names.
  `;

  const parts = [...fileParts, { text: prompt }];

  const { text: sectorText, usageMetadata: sectorUsage } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      responseSchema: SECTOR_SCHEMA,
      maxOutputTokens: 1024,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(sectorText);
  } catch {
    return jsonResponse({
      sector: "General",
      confidence: "low",
      reasoning: "Could not parse analysis result.",
      isAmbiguous: true,
      alternatives: ["Healthcare", "Construction", "Manufacturing", "Information Technology"],
      detectedTopics: [],
      _usage: sectorUsage,
    });
  }

  return jsonResponse({ ...parsed, _usage: sectorUsage });
}

// ============================================
// Study Guide Generation
// ============================================

const STUDY_GUIDE_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Clear section heading" },
          summary: { type: "string", description: "One-sentence section overview" },
          keyPoints: {
            type: "array",
            items: { type: "string" },
            description: "3-5 specific, actionable key points as complete sentences",
          },
          takeaway: { type: "string", description: "One-sentence key takeaway" },
        },
        required: ["title", "summary", "keyPoints", "takeaway"],
      },
    },
  },
  required: ["sections"],
};

async function handleStudyGuideGeneration(body: DemoRequest): Promise<Response> {
  const topic = sanitizeUserInput(body.topic || "");
  const sector = sanitizeUserInput(body.sector || "General");

  const files = body.files || [];
  let fileParts: Awaited<ReturnType<typeof resolveFileParts>> = [];
  try {
    fileParts = await resolveFileParts(files);
  } catch (err) {
    console.warn("File resolution failed for study guide, continuing with topic only:", err);
  }

  const hasFiles = fileParts.length > 0;

  const prompt = `
    Create a comprehensive study guide ${hasFiles ? 'for this course material' : 'for a course on this topic'}.

    <user_content>
    Topic: "${topic}"
    Industry: ${sector}
    </user_content>

    TASK: Generate 8-12 well-structured sections for a study guide ${hasFiles ? 'based on the uploaded course materials' : `about "${topic}" in the ${sector} sector. Use your knowledge of this subject to create educational content.`}.

    For each section provide:
    - title: A clear, descriptive heading for the section
    - summary: One sentence describing what this section covers
    - keyPoints: 3-5 key points, each a COMPLETE, SPECIFIC sentence that teaches something. Include specific facts, numbers, tools, processes, or concepts${hasFiles ? ' from the course' : ''}.
    - takeaway: One sentence capturing the single most important concept from this section

    CRITICAL CONSTRAINTS (follow exactly):
    - Every key point MUST be a complete, meaningful sentence — NOT a keyword list, NOT a word dump
    - ${hasFiles ? 'Extract REAL content, facts, and concepts from the uploaded documents' : 'Use accurate, current knowledge about this subject to create educational content'}
    - Each key point should teach something specific and actionable
    - Sections should follow a logical learning progression
    - If the materials are about a certification, organize by exam domains/objectives
    - If a section covers tools or services, name them specifically
    - Do NOT generate generic filler like "Understanding the basics of cloud computing"
    - DO generate specific content like "Amazon S3 provides 11 9s (99.999999999%) of data durability across multiple Availability Zones"
  `;

  const parts = [...fileParts, { text: prompt }];

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      responseSchema: STUDY_GUIDE_SCHEMA,
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 8192,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse({
      sections: [],
      _usage: usageMetadata,
    });
  }

  // Fallback: if sections are empty despite a valid parse, generate topic-based fallback
  const sections = parsed.sections || [];
  if (sections.length === 0 && topic) {
    return jsonResponse({
      sections: [
        {
          title: `Introduction to ${topic}`,
          summary: `Overview of key concepts in ${topic} for the ${sector} sector.`,
          keyPoints: [
            `${topic} is a foundational subject in the ${sector} industry.`,
            `Understanding core principles is essential for professional competency.`,
            `This study guide covers the most important areas for exam preparation and practical application.`,
          ],
          takeaway: `A solid foundation in ${topic} is critical for success in ${sector}.`,
        },
      ],
      _usage: usageMetadata,
    });
  }

  return jsonResponse({
    sections,
    _usage: usageMetadata,
  });
}

// ============================================
// Quiz Generation
// ============================================

const QUIZ_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number", description: "Question number starting at 1" },
          type: { type: "string", description: "Always 'multiple-choice'" },
          topic: { type: "string", description: "Short topic label for this question (e.g. 'AWS ECS', 'VPC Networking', 'IAM Policies')" },
          question: { type: "string", description: "The question text" },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Exactly 4 answer options",
          },
          correctAnswer: { type: "string", description: "The correct answer — must EXACTLY match one of the options strings" },
          explanation: { type: "string", description: "Why this answer is correct — 1-2 sentences" },
        },
        required: ["id", "type", "topic", "question", "options", "correctAnswer", "explanation"],
      },
    },
  },
  required: ["questions"],
};

async function handleQuizGeneration(body: DemoRequest): Promise<Response> {
  const topic = sanitizeUserInput(body.topic || "");
  const sector = sanitizeUserInput(body.sector || "General");

  const files = body.files || [];
  let fileParts: Awaited<ReturnType<typeof resolveFileParts>> = [];
  try {
    fileParts = await resolveFileParts(files);
  } catch (err) {
    console.warn("File resolution failed for quiz, continuing with topic only:", err);
  }

  const hasFiles = fileParts.length > 0;

  const studyGuideSections = body.studyGuideSections;
  const hasStudyGuide = studyGuideSections && studyGuideSections.length > 0;

  let studyGuideContext = '';
  if (hasStudyGuide) {
    studyGuideContext = `

    STUDY GUIDE SECTIONS (use these as the PRIMARY source for quiz questions):
    ${studyGuideSections.map((s, i) => `
    Section ${i + 1}: ${s.title}
    Summary: ${s.summary}
    Key Points:
    ${s.keyPoints.map((kp, ki) => `  ${ki + 1}. ${kp}`).join('\n')}
    Takeaway: ${s.takeaway}
    `).join('\n')}
    `;
  }

  const prompt = `
    Create an exam-prep quiz ${hasFiles ? 'based on this course material' : 'for a course on this topic'}.

    <user_content>
    Topic: "${topic}"
    Industry: ${sector}
    </user_content>

    TASK: ${hasStudyGuide ? 'Generate questions that test the key concepts from the study guide sections below.' : hasFiles ? 'Scan the course materials and identify the most important concepts, services, and facts that would appear on the certification exam or final assessment.' : `Create quiz questions about "${topic}" in the ${sector} sector based on common exam topics and key concepts.`} Generate 10-15 multiple-choice questions testing these high-value topics.
    ${studyGuideContext}

    Every question must have:
    - id: Sequential number starting at 1
    - type: Always "multiple-choice"
    - topic: A short label (2-4 words) identifying the specific subject area being tested (e.g. "AWS ECS", "VPC Networking", "IAM Policies", "S3 Storage Classes", "Fall Protection", "HIPAA Privacy Rule"). This appears as a tag on the question card.
    - question: A clear, specific question
    - options: Exactly 4 answer choices
    - correctAnswer: Must EXACTLY match one of the 4 options
    - explanation: 1-2 sentences explaining WHY this is correct and what makes the distractors wrong

    CRITICAL CONSTRAINTS (follow exactly):
    - Focus on what matters for the exam: key services, core concepts, common gotchas, best practices
    - Questions should test real understanding, not just vocabulary recognition
    - Distractors must be plausible — use real service names, real concepts, real numbers that are close but wrong
    - Range from basic recall ("Which service does X?") to scenario-based application ("A company needs to... which solution?")
    - topic labels should be specific: "EC2 Auto Scaling" not just "AWS", "OSHA 1910.134" not just "Safety"
    - ${hasFiles ? 'Every question must relate directly to content in the uploaded course materials' : 'Every question must relate directly to key concepts and common exam topics for this subject'}
    - Do NOT generate questions about tangential topics not covered in the ${hasFiles ? 'course' : 'subject area'}
    - Explanations should teach — help the student understand the concept, not just confirm the answer
    - Assign sequential id values starting at 1
  `;

  const parts = [...fileParts, { text: prompt }];

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      responseSchema: QUIZ_SCHEMA,
      maxOutputTokens: 8192,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse({
      questions: [],
      _usage: usageMetadata,
    });
  }

  return jsonResponse({
    questions: parsed.questions || [],
    _usage: usageMetadata,
  });
}

// ============================================
// Slide Review & Correction Pass
// ============================================

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          isValid: { type: "boolean", description: "true if the slide has meaningful before/after differentiation" },
          issue: { type: "string", description: "What is wrong with the slide (empty if valid)" },
          correctedBefore: SLIDE_CONTENT_SCHEMA,
          correctedAfter: SLIDE_CONTENT_SCHEMA,
          correctedChangesSummary: { type: "string" },
        },
        required: ["id", "isValid"],
      },
    },
  },
  required: ["slides"],
};

async function reviewAndCorrectSlides(
  slides: any[],
  citations: any[],
  topic: string,
  sector: string,
): Promise<any[]> {
  if (!slides || slides.length === 0) return slides;

  const slideSummary = slides.map((s: any) => ({
    id: s.id,
    beforeTitle: s.before?.title,
    afterTitle: s.after?.title,
    beforeBullets: s.before?.bullets,
    afterBullets: s.after?.bullets,
    changesSummary: s.changesSummary,
  }));

  const prompt = `
    Review these generated course slides for quality. Each slide has a "before" (outdated) and "after" (modernized) version.

    <slides>
    ${JSON.stringify(slideSummary, null, 2)}
    </slides>

    Topic: "${sanitizeUserInput(topic)}"
    Sector: ${sanitizeUserInput(sector)}

    For each slide, check:
    1. Are the before and after titles meaningfully different? (before should be generic, after should be benefit-oriented)
    2. Do the after bullets contain specific facts, numbers, or data that the before bullets lack?
    3. Is the changesSummary a short category label (not a sentence)?

    If a slide is INVALID (titles too similar, no meaningful content difference, or generic after content), set isValid=false, describe the issue, and provide corrected before/after content.

    CRITICAL CONSTRAINTS:
    - Only correct slides that are genuinely poor quality — do not change valid slides
    - Corrected "before" must be generic and vague (boring old slide)
    - Corrected "after" must be specific, data-rich, and benefit-oriented
    - If a slide is valid, set isValid=true and omit correction fields
  `;

  try {
    const { text } = await callGemini(
      "gemini-3-flash-preview",
      [{ role: "user", parts: [{ text: prompt }] }],
      {
        responseSchema: REVIEW_SCHEMA,
        maxOutputTokens: 8192,
      }
    );

    const reviewResult = JSON.parse(text);
    if (!reviewResult.slides || !Array.isArray(reviewResult.slides)) return slides;

    // Apply corrections to invalid slides
    const correctedSlides = slides.map((slide: any) => {
      const review = reviewResult.slides.find((r: any) => r.id === slide.id);
      if (review && !review.isValid && review.correctedBefore && review.correctedAfter) {
        return {
          ...slide,
          before: review.correctedBefore,
          after: review.correctedAfter,
          changesSummary: review.correctedChangesSummary || slide.changesSummary,
        };
      }
      return slide;
    });

    return correctedSlides;
  } catch (err) {
    console.warn("Slide review pass failed, returning original slides:", err);
    return slides;
  }
}

// ============================================
// Verify Findings — Search Grounding + Structured Output
// ============================================

const VERIFICATION_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          findingId: { type: "string" },
          title: { type: "string" },
          status: { type: "string", description: "verified | updated | unverified" },
          confidence: { type: "number", description: "0-100 confidence score" },
          sourceUrl: { type: "string" },
          sourceTitle: { type: "string" },
          verificationNote: { type: "string" },
          originalDescription: { type: "string" },
          updatedInfo: { type: "string" },
        },
        required: ["findingId", "title", "status", "confidence", "verificationNote", "originalDescription"],
      },
    },
    searchQueries: { type: "array", items: { type: "string" } },
  },
  required: ["findings", "searchQueries"],
};

async function handleVerifyFindings(body: DemoRequest): Promise<Response> {
  const sector = sanitizeUserInput(body.sector || "General");
  const location = sanitizeUserInput(body.location || "United States");
  const approvedFindings = body.approvedFindings || [];

  if (approvedFindings.length === 0) {
    return errorResponse("No findings provided for verification", 400);
  }

  const findingsText = approvedFindings
    .map((f) => `- [${sanitizeUserInput(f.id)}] ${sanitizeUserInput(f.title)}: ${sanitizeUserInput(f.description)}${f.currentInfo ? ` (Current info: ${sanitizeUserInput(f.currentInfo)})` : ""}`)
    .join("\n");

  const prompt = `
    Verify the following course findings using web search. Each finding claims something in a ${sector} course (${location}) is outdated or needs updating.

    <findings>
    ${findingsText}
    </findings>

    For each finding:
    1. Search the web to verify if the claim is accurate
    2. Determine the status:
       - "verified": The finding is correct — the content IS outdated or needs updating, confirmed by search results
       - "updated": The finding is partially correct but the details need updating based on what search found
       - "unverified": Cannot confirm the finding — search results suggest the content may still be current
    3. Set confidence (0-100) based on how strong the search evidence is
    4. Include the source URL and title of the most relevant search result
    5. Write a verificationNote explaining what you found
    6. Copy the original description to originalDescription
    7. If status is "updated", provide the corrected information in updatedInfo

    CRITICAL CONSTRAINTS:
    - Use Google Search to verify EVERY finding — do not rely on training data alone
    - sourceUrl must be a real URL from search results, not a placeholder
    - confidence should be HIGH (80-100) only when search results clearly confirm the finding
    - For regulatory/compliance findings, cite the specific regulation number and effective date
    - findingId must match the original finding's id exactly
  `;

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      responseSchema: VERIFICATION_SCHEMA,
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 8192,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse({
      findings: [],
      searchQueries: [],
      verifiedAt: new Date().toISOString(),
      _usage: usageMetadata,
    });
  }

  return jsonResponse({
    findings: parsed.findings || [],
    searchQueries: parsed.searchQueries || [],
    verifiedAt: new Date().toISOString(),
    _usage: usageMetadata,
  });
}

// ============================================
// Course Summary Generation
// ============================================

const COURSE_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    courseTitle: { type: "string", description: "Inferred or extracted course title" },
    learningObjectives: {
      type: "array",
      items: { type: "string" },
      description: "3-6 learning objectives",
    },
    keyTopics: {
      type: "array",
      items: { type: "string" },
      description: "5-10 key topics covered",
    },
    difficulty: { type: "string", description: "beginner | intermediate | advanced" },
    estimatedDuration: { type: "string", description: "Estimated course duration (e.g. '4 hours', '2 days')" },
    moduleCount: { type: "number", description: "Estimated number of modules/sections" },
    summary: { type: "string", description: "2-3 sentence course summary" },
  },
  required: ["courseTitle", "learningObjectives", "keyTopics", "difficulty", "estimatedDuration", "moduleCount", "summary"],
};

async function handleCourseSummary(body: DemoRequest): Promise<Response> {
  const topic = sanitizeUserInput(body.topic || "");
  const sector = sanitizeUserInput(body.sector || "General");

  const files = body.files || [];
  let fileParts: Awaited<ReturnType<typeof resolveFileParts>> = [];
  try {
    fileParts = await resolveFileParts(files);
  } catch (err) {
    console.warn("File resolution failed for course summary, continuing with topic only:", err);
  }

  const hasFiles = fileParts.length > 0;

  const prompt = `
    ${hasFiles ? 'Analyze the uploaded course materials and generate a structured summary.' : `Generate a structured summary for a course about "${topic}" in the ${sector} sector.`}

    <user_content>
    Topic: "${topic}"
    Industry: ${sector}
    </user_content>

    TASK: Extract or infer the following information:
    - courseTitle: The title of the course (extract from materials if available, otherwise infer)
    - learningObjectives: 3-6 specific learning objectives
    - keyTopics: 5-10 key topics or subjects covered
    - difficulty: beginner, intermediate, or advanced
    - estimatedDuration: How long the course takes (e.g., "4 hours", "2 days")
    - moduleCount: Number of modules or major sections
    - summary: 2-3 sentence overview of what the course covers

    CRITICAL CONSTRAINTS:
    - ${hasFiles ? 'Base all information on the actual uploaded materials — do not invent content' : 'Use your knowledge to create a realistic and accurate summary for this subject'}
    - Learning objectives should be specific and measurable (use verbs: identify, explain, configure, implement, evaluate)
    - Key topics should be specific subject areas, not generic categories
    - Difficulty should reflect the actual depth and prerequisites of the content
    - Duration should be a realistic estimate based on content volume
  `;

  const parts = [...fileParts, { text: prompt }];

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      responseSchema: COURSE_SUMMARY_SCHEMA,
      maxOutputTokens: 4096,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse({
      courseTitle: topic || "Unknown Course",
      learningObjectives: [],
      keyTopics: [],
      difficulty: "intermediate",
      estimatedDuration: "Unknown",
      moduleCount: 0,
      summary: "Unable to generate course summary.",
      _usage: usageMetadata,
    });
  }

  return jsonResponse({
    courseTitle: parsed.courseTitle || topic || "Unknown Course",
    learningObjectives: parsed.learningObjectives || [],
    keyTopics: parsed.keyTopics || [],
    difficulty: parsed.difficulty || "intermediate",
    estimatedDuration: parsed.estimatedDuration || "Unknown",
    moduleCount: parsed.moduleCount || 0,
    summary: parsed.summary || "",
    _usage: usageMetadata,
  });
}
