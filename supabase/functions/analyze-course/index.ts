// Edge Function: Analyze Course Content
// Uses Gemini 3 Pro for multimodal course analysis

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth, trackApiUsage } from "../_shared/auth.ts";
import { callGemini } from "../_shared/gemini.ts";

interface AnalysisRequest {
  text?: string;
  files?: Array<{
    name: string;
    type: string;
    data: string; // base64
  }>;
  config?: {
    goal?: string;
    targetAudience?: string;
    standardsContext?: string;
    location?: string;
  };
}

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    freshnessScore: { type: "integer", minimum: 0, maximum: 100 },
    engagementScore: { type: "integer", minimum: 0, maximum: 100 },
    freshnessIssues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          location: { type: "string" },
        },
        required: ["description", "severity"],
      },
    },
    engagementIssues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          location: { type: "string" },
        },
        required: ["description", "severity"],
      },
    },
    summary: { type: "string" },
  },
  required: ["freshnessScore", "engagementScore", "freshnessIssues", "engagementIssues", "summary"],
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

    const body: AnalysisRequest = await req.json();

    if (!body.text && (!body.files || body.files.length === 0)) {
      return errorResponse("Either text or files must be provided", 400);
    }

    // Build the prompt
    const systemPrompt = `You are an expert course auditor specializing in regulatory compliance and instructional design.
Analyze the provided course content for:
1. FRESHNESS: Are facts, regulations, and statistics current? Identify outdated information.
2. ENGAGEMENT: Is the content visually engaging? Identify text-heavy sections that could be interactive.

${body.config?.targetAudience ? `Target Audience: ${body.config.targetAudience}` : ""}
${body.config?.standardsContext ? `Industry Standards: ${body.config.standardsContext}` : ""}
${body.config?.location ? `Geographic Focus: ${body.config.location}` : ""}

Be specific about issues and provide actionable feedback.`;

    // Build message parts
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    if (body.text) {
      parts.push({ text: `Course content:\n\n${body.text}` });
    }

    // Add file data (images, PDFs as images)
    if (body.files) {
      for (const file of body.files) {
        if (file.type.startsWith("image/") || file.type === "application/pdf") {
          parts.push({
            inlineData: {
              mimeType: file.type,
              data: file.data.replace(/^data:[^;]+;base64,/, ""),
            },
          });
        }
      }
    }

    parts.push({ text: "Analyze this course content and provide your assessment." });

    // Call Gemini
    const result = await callGemini(
      "gemini-3-pro-preview",
      [{ role: "user", parts }],
      {
        systemInstruction: systemPrompt,
        responseSchema: ANALYSIS_SCHEMA,
      }
    );

    // Track API usage
    await trackApiUsage(auth.userId, "analyze-course", "gemini-3-pro-preview");

    // Parse and return result
    const analysis = JSON.parse(result);
    return jsonResponse(analysis);

  } catch (error) {
    console.error("Analysis error:", error);
    return errorResponse(error.message || "Analysis failed", 500);
  }
});
