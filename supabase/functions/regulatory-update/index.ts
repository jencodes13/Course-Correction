// Edge Function: Regulatory Update
// Uses Gemini 3 Flash with Google Search Grounding for live fact-checking

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth, trackApiUsage } from "../_shared/auth.ts";
import { callGemini } from "../_shared/gemini.ts";

interface RegulatoryRequest {
  content: string;
  domainContext?: string;
  location?: string;
}

const REGULATORY_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      originalText: { type: "string" },
      updatedText: { type: "string" },
      citation: { type: "string" },
      reason: { type: "string" },
      sourceUrl: { type: "string" },
    },
    required: ["id", "originalText", "updatedText", "citation", "reason"],
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

    const body: RegulatoryRequest = await req.json();

    if (!body.content) {
      return errorResponse("Content is required", 400);
    }

    // Build the prompt with grounding
    const systemPrompt = `You are a regulatory compliance specialist. Your task is to:
1. Identify any facts, statistics, regulations, or standards mentioned in the content
2. Use Google Search to verify if they are current and accurate
3. For any outdated or incorrect information, provide the updated version with citation

${body.domainContext ? `Industry Context: ${body.domainContext}` : ""}
${body.location ? `Geographic Jurisdiction: ${body.location}` : ""}

For each issue found, provide:
- The original text that needs updating
- The corrected/updated text
- A specific citation (e.g., "OSHA 1910.134(c)(2) - Updated Jan 2024")
- The reason for the change
- A source URL if available

Be thorough and cite specific regulation numbers, publication dates, and official sources.`;

    const userPrompt = `Review this content for regulatory accuracy and provide updates:

${body.content}`;

    // Call Gemini with Google Search grounding
    const { text, usageMetadata } = await callGemini(
      "gemini-3-flash-preview",
      [{ role: "user", parts: [{ text: userPrompt }] }],
      {
        systemInstruction: systemPrompt,
        responseSchema: REGULATORY_SCHEMA,
        tools: [{ googleSearch: {} }],
        maxOutputTokens: 8192,
      }
    );

    // Track API usage
    await trackApiUsage(auth.userId, "regulatory-update", "gemini-3-flash-preview");

    // Parse and return result with usage metadata
    let updates;
    try {
      updates = JSON.parse(text);
    } catch {
      // If JSON parsing fails, return the raw text
      updates = [{ id: "1", originalText: "", updatedText: text, citation: "", reason: "Analysis result" }];
    }

    return jsonResponse({ updates, _usage: usageMetadata });

  } catch (error) {
    console.error("Regulatory update error:", error);
    return errorResponse("Regulatory update failed. Please try again.", 500);
  }
});
