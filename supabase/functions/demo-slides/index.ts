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
  action?: "scan" | "generate";
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
    bullets: { type: "array", items: { type: "string" } },
    citationIds: { type: "array", items: { type: "integer" } },
  },
  required: ["title", "bullets", "citationIds"],
};

const ENHANCED_SLIDES_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          before: SLIDE_CONTENT_SCHEMA,
          after: SLIDE_CONTENT_SCHEMA,
          changesSummary: { type: "string" },
          visualStyle: {
            type: "object",
            properties: {
              accentColor: { type: "string" },
              layout: { type: "string" },
            },
            required: ["accentColor", "layout"],
          },
        },
        required: ["id", "before", "after", "changesSummary", "visualStyle"],
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
  required: ["slides", "citations", "metadata"],
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
  },
  required: ["findings", "searchQueries", "courseSummary"],
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

  let modeInstructions = "";
  if (updateMode === "regulatory" || updateMode === "full") {
    modeInstructions += `
      REGULATORY UPDATES:
      - Search for current ${sector} regulations in ${location}
      - Find specific code numbers, effective dates, and official sources
      - Identify outdated information and provide corrected versions
      - Reference citations by ID number matching the citations array
    `;
  }
  if (updateMode === "visual" || updateMode === "full") {
    modeInstructions += `
      VISUAL UPDATES:
      - Transform text-heavy content into engaging formats
      - Suggest modern layouts (timelines, accordions, cards)
      - Recommend visual hierarchy improvements
    `;
  }

  const prompt = `
    Modernize training materials for "${body.topic}" in the ${sector} sector, located in ${location}.
    Update type: ${updateMode}. Visual style: ${style}.

    ${modeInstructions}

    Create exactly 3 slides showing BEFORE (outdated 2015-era content) and AFTER (current, corrected content).
    ${files.length > 0 ? "Base content on the uploaded materials." : "Create realistic example content for this sector."}

    For the "after" content, use search to find real current regulations. Include citation IDs referencing specific sources.

    CRITICAL CONSTRAINTS (follow exactly):
    - Each bullet must include a specific fact, regulation number, or actionable instruction — not generic statements like "Understanding the basics"
    - "before" bullets must show plausible outdated content with wrong dates, old regulation numbers, or deprecated practices
    - "after" bullets must cite specific current codes, dates, and requirements
    - Provide real source URLs in citations, not placeholder links
  `;

  const parts = [...fileParts, { text: prompt }];

  // Gemini 3: Search Grounding + Structured Output together
  const { text, usageMetadata } = await callGemini(
    "gemini-3-flash-preview",
    [{ role: "user", parts }],
    {
      responseSchema: ENHANCED_SLIDES_SCHEMA,
      tools: [{ googleSearch: {} }],
    }
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

  const prompt = `
    Generate 3 modernized slide pairs (BEFORE/AFTER) for the following course.

    <user_content>
    Topic: "${sanitizeUserInput(body.topic)}"
    Industry: ${sector}. Location: ${location}.
    Update type: ${updateMode}. Visual style: ${style}.
    ${userContext ? `User context: ${userContext}` : ""}
    ${designContext}
    </user_content>

    The user reviewed a course analysis and approved these findings for update:
    ${findingsText}

    Generate slides that address ONLY the approved findings above. Each slide should:
    - Show realistic "before" content reflecting the actual issue identified in the finding
    - Show corrected "after" content with specific, current information
    - Reference citations by ID number

    Use search to find current, accurate information for the "after" content.

    CRITICAL CONSTRAINTS (follow exactly):
    - Do NOT invent issues beyond what the user approved
    - "before" content must reflect what the course actually says — do not fabricate outdated content or dates
    - Every factual claim in "after" content must come from search results. Do not invent facts, dates, regulation numbers, or statistics.
    - Each "after" bullet must include a specific fact, date, or actionable instruction
    - Provide real source URLs in citations, not placeholder links
    - Each slide should address 1-3 related findings — group logically
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
