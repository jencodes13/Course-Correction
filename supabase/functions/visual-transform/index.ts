// Edge Function: Visual Transformation
// Uses Gemini 3 Flash to suggest engagement improvements

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth, trackApiUsage } from "../_shared/auth.ts";
import { callGemini } from "../_shared/gemini.ts";

interface VisualRequest {
  content: string;
  theme?: string;
}

const VISUAL_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      sectionId: { type: "string" },
      originalType: { type: "string", enum: ["paragraph", "bullet_list", "table", "heading"] },
      suggestedType: { type: "string", enum: ["accordion", "timeline", "flip_card", "infographic", "tabbed_content", "process_diagram", "comparison_table", "interactive_quiz"] },
      visualDescription: { type: "string" },
      imagePrompt: { type: "string" },
      content: {
        type: "object",
        properties: {
          title: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                content: { type: "string" },
              },
            },
          },
        },
      },
    },
    required: ["sectionId", "originalType", "suggestedType", "visualDescription", "content"],
  },
};

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Require authentication
    const auth = await requireAuth(req);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body: VisualRequest = await req.json();

    if (!body.content) {
      return errorResponse("Content is required", 400);
    }

    // Build the prompt
    const systemPrompt = `You are an expert instructional designer specializing in eLearning engagement.
Your task is to identify text-heavy sections and suggest interactive transformations.

Available transformation types:
- accordion: Collapsible sections for detailed content
- timeline: Chronological or sequential information
- flip_card: Key terms with definitions, Q&A pairs
- infographic: Data visualization, statistics, comparisons
- tabbed_content: Related topics in organized tabs
- process_diagram: Step-by-step procedures
- comparison_table: Side-by-side comparisons
- interactive_quiz: Knowledge check questions

${body.theme ? `Visual Theme: ${body.theme}` : ""}

For each transformation:
1. Identify a specific section that would benefit
2. Explain why the suggested format improves engagement
3. Provide an image prompt for AI-generated visuals
4. Structure the content for the new format`;

    const userPrompt = `Analyze this content and suggest visual transformations:

${body.content}`;

    // Call Gemini
    const { text, usageMetadata } = await callGemini(
      "gemini-3-flash-preview",
      [{ role: "user", parts: [{ text: userPrompt }] }],
      {
        systemInstruction: systemPrompt,
        responseSchema: VISUAL_SCHEMA,
        maxOutputTokens: 8192,
      }
    );

    // Track API usage
    await trackApiUsage(auth.userId, "visual-transform", "gemini-3-flash-preview");

    // Parse and return result with usage metadata
    let transformations;
    try {
      transformations = JSON.parse(text);
    } catch {
      transformations = [];
    }

    return jsonResponse({ transformations, _usage: usageMetadata });

  } catch (error) {
    console.error("Visual transformation error:", error);
    return errorResponse("Visual transformation failed. Please try again.", 500);
  }
});
