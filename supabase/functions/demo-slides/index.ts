// Edge Function: Generate Demo Slides
// Uses Gemini 3 Flash to create modernized course slides

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callGemini } from "../_shared/gemini.ts";

interface DemoRequest {
  topic: string;
  location?: string;
  style?: string;
  fileData?: {
    name: string;
    type: string;
    data: string; // base64
  };
}

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

    // Build the prompt
    const styleMap: Record<string, string> = {
      modern: "Clean, minimalist design with bold typography and ample white space. Use gradients and subtle shadows.",
      corporate: "Professional, polished look with consistent branding elements. Navy, gray, and accent colors.",
      playful: "Colorful, engaging design with illustrations and icons. Rounded corners and friendly fonts.",
      technical: "Data-focused with charts, diagrams, and code snippets. Dark theme with syntax highlighting.",
    };

    const styleDescription = styleMap[body.style || "modern"] || styleMap.modern;

    const systemPrompt = `You are an expert instructional designer creating modernized training slides.
Transform the given topic into engaging, interactive course slides.

Design Style: ${styleDescription}
${body.location ? `Geographic Context: ${body.location} (include relevant local regulations/standards)` : ""}

For each slide:
1. Create a clear, action-oriented title
2. Write 3-5 concise bullet points (not walls of text)
3. Suggest a visual prompt for AI image generation
4. Recommend a color theme that fits the style

Focus on:
- Breaking up dense text into digestible chunks
- Adding interactive elements (scenarios, questions, examples)
- Modern, engaging formatting
- Regulatory accuracy if applicable`;

    // Build message parts
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    if (body.fileData) {
      // Add the uploaded file
      parts.push({
        inlineData: {
          mimeType: body.fileData.type,
          data: body.fileData.data.replace(/^data:[^;]+;base64,/, ""),
        },
      });
      parts.push({
        text: `Analyze this ${body.fileData.type.includes("pdf") ? "PDF document" : "image"} and create modernized training slides based on its content. Topic context: ${body.topic}`,
      });
    } else {
      parts.push({
        text: `Create 5-7 modernized training slides for this topic: ${body.topic}`,
      });
    }

    // Call Gemini
    const result = await callGemini(
      "gemini-3-flash-preview",
      [{ role: "user", parts }],
      {
        systemInstruction: systemPrompt,
        responseSchema: SLIDES_SCHEMA,
        temperature: 0.7,
      }
    );

    // Parse and return result
    let slides;
    try {
      slides = JSON.parse(result);
    } catch {
      // If parsing fails, create a simple slide from the text
      slides = [
        {
          title: body.topic,
          bullets: [result.substring(0, 200)],
          visualPrompt: `Professional illustration for ${body.topic}`,
          colorTheme: "blue-600",
        },
      ];
    }

    return jsonResponse({ slides });

  } catch (error) {
    console.error("Demo slides error:", error);
    return errorResponse(error.message || "Slide generation failed", 500);
  }
});
