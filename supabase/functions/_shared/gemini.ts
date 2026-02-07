// Shared Gemini API utilities for Edge Functions
// This keeps the API key secure on the server side

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY environment variable not set");
}

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text?: string; inlineData?: { data: string } }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

interface GeminiOptions {
  systemInstruction?: string;
  responseSchema?: object;
  tools?: Array<Record<string, unknown>>;
  temperature?: number;
  maxOutputTokens?: number;
}

export async function callGemini(
  model: string,
  messages: GeminiMessage[],
  options: GeminiOptions = {}
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const body: Record<string, unknown> = {
    contents: messages,
  };

  // System instruction
  if (options.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  // Generation config
  const generationConfig: Record<string, unknown> = {};
  if (options.responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = options.responseSchema;
  }
  if (options.temperature !== undefined) {
    generationConfig.temperature = options.temperature;
  }
  if (options.maxOutputTokens !== undefined) {
    generationConfig.maxOutputTokens = options.maxOutputTokens;
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }

  // Tools (for grounding)
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No response from Gemini API");
  }

  const textPart = data.candidates[0].content.parts.find((p) => p.text);
  if (!textPart?.text) {
    throw new Error("No text content in Gemini response");
  }

  return textPart.text;
}

export async function callGeminiWithSearchGrounding(
  model: string,
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  return callGemini(
    model,
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      systemInstruction,
      tools: [{ googleSearch: {} }],
    }
  );
}

export async function callGeminiWithMapsGrounding(
  model: string,
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  // Use Google Search grounding for location-based regulatory lookups
  return callGemini(
    model,
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      systemInstruction,
      tools: [{ googleSearch: {} }],
    }
  );
}

export async function generateImage(
  prompt: string,
  baseImage?: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const url = `${GEMINI_BASE_URL}/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;

  const parts: GeminiPart[] = [{ text: prompt }];

  if (baseImage) {
    // Extract base64 data from data URL if present
    const base64Data = baseImage.includes(",")
      ? baseImage.split(",")[1]
      : baseImage;
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: base64Data,
      },
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["image", "text"],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Image API error: ${response.status} - ${errorText}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(`Gemini Image API error: ${data.error.message}`);
  }

  // Extract image from response
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData
  );

  if (imagePart?.inlineData?.data) {
    return `data:image/png;base64,${imagePart.inlineData.data}`;
  }

  // If no image, return any text response
  const textPart = data.candidates?.[0]?.content?.parts?.find((p) => p.text);
  if (textPart?.text) {
    throw new Error(`Image generation failed. Model response: ${textPart.text}`);
  }

  throw new Error("No image generated");
}
