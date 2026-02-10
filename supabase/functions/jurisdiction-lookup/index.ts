// Edge Function: Jurisdiction Lookup
// Uses Gemini with Maps grounding to identify local Authority Having Jurisdiction (AHJ)

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth, trackApiUsage } from "../_shared/auth.ts";
import { callGeminiWithMapsGrounding } from "../_shared/gemini.ts";

interface JurisdictionRequest {
  location: string; // City, state, or coordinates
  regulationType?: string; // e.g., "OSHA", "FDA", "construction", "healthcare"
}

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

    const body: JurisdictionRequest = await req.json();

    if (!body.location) {
      return errorResponse("Location is required", 400);
    }

    // Build the prompt
    const prompt = `For the location "${body.location}", identify the local Authority Having Jurisdiction (AHJ) for ${body.regulationType || "regulatory compliance"}.

Provide:
1. The primary regulatory authority name
2. The jurisdiction level (federal, state, county, city)
3. Relevant contact information or website if available
4. Any specific local regulations or codes that apply

Focus on official government bodies that enforce regulations in this area.`;

    const systemInstruction = `You are an expert in regulatory compliance and jurisdictional authority identification. Use location-based information to identify the correct regulatory bodies. Be specific about which level of government has authority.`;

    // Call Gemini with Maps grounding
    const { text, usageMetadata } = await callGeminiWithMapsGrounding(
      "gemini-3-flash-preview",
      prompt,
      systemInstruction,
      4096
    );

    // Track API usage
    await trackApiUsage(auth.userId, "jurisdiction-lookup", "gemini-3-flash-preview");

    // Parse the result to extract key information
    return jsonResponse({
      location: body.location,
      regulationType: body.regulationType,
      authority: text,
      _usage: usageMetadata,
    });

  } catch (error) {
    console.error("Jurisdiction lookup error:", error);
    return errorResponse("Jurisdiction lookup failed. Please try again.", 500);
  }
});
