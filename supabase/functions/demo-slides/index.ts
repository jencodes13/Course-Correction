// Edge Function: Generate Demo Slides
// Uses Gemini 3 Flash to create modernized course slides
// Supports basic mode (simple slides) and enhanced mode (search grounding + structured before/after)

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callGemini, resolveFileParts, sanitizeUserInput } from "../_shared/gemini.ts";

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
  action?: "scan" | "generate" | "generateTheme";
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
  // Theme generation params (design mode)
  themeQuestionnaire?: {
    brandPersonality?: string;
    audience?: string;
    desiredFeeling?: string;
    primaryColor?: string;
  };
}

const MAX_TOPIC_LENGTH = 500;
const MAX_FILE_DATA_SIZE = 14 * 1024 * 1024; // 14MB base64 (~10MB decoded)

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
    const body: DemoRequest = await req.json();

    if (!body.topic) {
      return errorResponse("Topic is required", 400);
    }

    // Input validation
    if (body.topic.length > MAX_TOPIC_LENGTH) {
      return errorResponse("Topic must be 500 characters or fewer", 400);
    }

    // Validate inline file sizes (storage files are validated at upload time)
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

    // Route to the right handler
    if (body.action === "generateTheme") {
      return await handleThemeGeneration(body);
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

async function handleBasicMode(body: DemoRequest): Promise<Response> {
  const styleMap: Record<string, string> = {
    modern: "Clean, minimalist design with bold typography and ample white space. Use gradients and subtle shadows.",
    corporate: "Professional, polished look with consistent branding elements. Navy, gray, and accent colors.",
    playful: "Colorful, engaging design with illustrations and icons. Rounded corners and friendly fonts.",
    technical: "Data-focused with charts, diagrams, and code snippets. Dark theme with syntax highlighting.",
  };

  const styleDescription = styleMap[body.style || "modern"] || styleMap.modern;

  const systemPrompt = `Create modernized training slides.

Design Style: ${styleDescription}
${body.location ? `Geographic Context: ${body.location} (include relevant local regulations/standards)` : ""}

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
        ? `Analyze this document and create modernized training slides based on its content. Topic context: ${body.topic}`
        : `Create 5-7 modernized training slides for this topic: ${body.topic}`,
    },
  ];

  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      systemInstruction: systemPrompt,
      responseSchema: SLIDES_SCHEMA,
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
  const sector = body.sector || "General";
  const location = body.location || "United States";
  const updateMode = body.updateMode || "full";
  const style = body.style || "modern";

  // Resolve uploaded files from inline base64 or storage
  const files = body.files || [];
  const fileParts = await resolveFileParts(files);

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
    "Course Topic: " + body.topic,
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

  return jsonResponse({
    slides: parsed.slides || [],
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
  const fileParts = await resolveFileParts(files);

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
    - For technical certification courses, focus on: deprecated services/features, changed best practices, new tools/services, exam blueprint changes.
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
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse({
      findings: [],
      searchQueries: [],
      courseSummary: "Unable to analyze course content.",
      _usage: usageMetadata,
    });
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
  const fileParts = await resolveFileParts(files);

  const findingsText = approvedFindings
    .map((f) => `- [${f.category.toUpperCase()}/${f.severity}] ${f.title}: ${f.description}`)
    .join("\n");

  let designContext = "";
  if (designPrefs) {
    designContext = `
    Design preferences:
    - Target audience: ${sanitizeUserInput(designPrefs.audience || "")}
    - Desired learner feeling: ${sanitizeUserInput(designPrefs.feeling || "")}
    - Emphasis: ${sanitizeUserInput(designPrefs.emphasis || "")}
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
  `;

  const parts = [...fileParts, { text: prompt }];

  const { text: genText, usageMetadata: genUsage } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      responseSchema: ENHANCED_SLIDES_SCHEMA,
      tools: [{ googleSearch: {} }],
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

  return jsonResponse({
    slides: parsed.slides || [],
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
  // Resolve uploaded files from inline base64 or storage
  const files = body.files || [];
  const fileParts = await resolveFileParts(files);

  const prompt = `
    Determine the primary industry for this training/certification material.

    ${body.topic ? `Topic: "${body.topic}"` : "No topic provided - infer from files only."}

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
