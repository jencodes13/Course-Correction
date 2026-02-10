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
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
}

interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text?: string; inlineData?: { data: string } }>;
    };
  }>;
  usageMetadata?: GeminiUsageMetadata;
  error?: {
    message: string;
    code: number;
  };
}

export interface GeminiCallResult {
  text: string;
  usageMetadata?: GeminiUsageMetadata;
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
): Promise<GeminiCallResult> {
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

  // Safety settings — explicit content filtering
  body.safetySettings = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  ];

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

  return { text: textPart.text, usageMetadata: data.usageMetadata };
}

export async function callGeminiWithSearchGrounding(
  model: string,
  prompt: string,
  systemInstruction?: string,
  maxOutputTokens?: number
): Promise<GeminiCallResult> {
  return callGemini(
    model,
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      systemInstruction,
      tools: [{ googleSearch: {} }],
      maxOutputTokens,
    }
  );
}

export async function callGeminiWithMapsGrounding(
  model: string,
  prompt: string,
  systemInstruction?: string,
  maxOutputTokens?: number
): Promise<GeminiCallResult> {
  // Use Google Search grounding for location-based regulatory lookups
  return callGemini(
    model,
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      systemInstruction,
      tools: [{ googleSearch: {} }],
      maxOutputTokens,
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

// ============================================
// Gemini Files API — for large file uploads
// ============================================

const GEMINI_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_FILES_URL = "https://generativelanguage.googleapis.com/v1beta/files";

/**
 * Upload a file to the Gemini Files API using the resumable upload protocol.
 * Returns a file_uri that can be used in generateContent requests.
 * Files are stored by Google for 48 hours.
 */
export async function uploadToGeminiFiles(
  bytes: Uint8Array,
  mimeType: string,
  displayName: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  // Step 1: Initiate resumable upload
  const initResponse = await fetch(
    `${GEMINI_UPLOAD_URL}?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: { display_name: displayName },
      }),
    }
  );

  if (!initResponse.ok) {
    const err = await initResponse.text();
    throw new Error(`Gemini Files API init failed: ${initResponse.status} - ${err}`);
  }

  const uploadUrl = initResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("No upload URL returned from Gemini Files API");
  }

  // Step 2: Upload the file bytes
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });

  if (!uploadResponse.ok) {
    const err = await uploadResponse.text();
    throw new Error(`Gemini Files API upload failed: ${uploadResponse.status} - ${err}`);
  }

  const result = await uploadResponse.json();
  const fileUri = result.file?.uri;
  if (!fileUri) {
    throw new Error("No file URI returned from Gemini Files API");
  }

  // Step 3: Poll until file is ACTIVE (some types need processing)
  const fileName = result.file?.name;
  if (fileName && result.file?.state !== "ACTIVE") {
    for (let i = 0; i < 30; i++) {
      const statusResponse = await fetch(
        `${GEMINI_FILES_URL}/${fileName}?key=${GEMINI_API_KEY}`
      );
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.state === "ACTIVE") break;
        if (status.state === "FAILED") {
          throw new Error(`Gemini file processing failed: ${status.error?.message || "unknown"}`);
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return fileUri;
}

// ============================================
// File resolution — converts mixed file refs to Gemini parts
// ============================================

import { downloadFromStorage } from "./storage.ts";

// Files under 15MB decoded can be sent inline; larger ones use Gemini Files API
const INLINE_BYTE_LIMIT = 15 * 1024 * 1024;

interface FileRef {
  name: string;
  type: string;
  data?: string;        // base64 data URL or raw base64
  storagePath?: string;  // Supabase Storage path
}

/**
 * Resolve an array of file references into Gemini API parts.
 * - Inline base64 files: sent directly if small enough
 * - Storage-backed files: downloaded from Supabase, then sent inline or via Files API
 */
export async function resolveFileParts(files: FileRef[]): Promise<GeminiPart[]> {
  const parts: GeminiPart[] = [];

  for (const file of files) {
    if (file.storagePath) {
      // Storage-backed file: download from Supabase Storage
      const { bytes, mimeType } = await downloadFromStorage("course-files", file.storagePath);

      if (bytes.length <= INLINE_BYTE_LIMIT) {
        // Small enough for inline base64
        const base64 = bytesToBase64(bytes);
        parts.push({ inlineData: { mimeType, data: base64 } });
      } else {
        // Large file: upload to Gemini Files API
        const fileUri = await uploadToGeminiFiles(bytes, mimeType, file.name);
        parts.push({ fileData: { mimeType, fileUri } });
      }
    } else if (file.data) {
      // Inline base64 data
      const base64Data = file.data.replace(/^data:[^;]+;base64,/, "");
      const decodedSize = Math.ceil(base64Data.length * 3 / 4);

      if (decodedSize <= INLINE_BYTE_LIMIT) {
        parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
      } else {
        // Unexpectedly large inline data — route through Files API
        const bytes = base64ToBytes(base64Data);
        const fileUri = await uploadToGeminiFiles(bytes, file.type, file.name);
        parts.push({ fileData: { mimeType: file.type, fileUri } });
      }
    }
    // Skip files with neither data nor storagePath
  }

  return parts;
}

// ============================================
// Input sanitization — prompt injection protection
// ============================================

const INJECTION_PATTERNS = [
  /<\s*\/?system[^>]*>/gi,
  /<\s*\/?instructions[^>]*>/gi,
  /<\s*\/?system_instruction[^>]*>/gi,
  /<\s*\/?prompt[^>]*>/gi,
  /<\s*\/?assistant[^>]*>/gi,
  /^(?:IGNORE|DISREGARD|FORGET|OVERRIDE)\s+(?:ALL\s+)?(?:PREVIOUS|ABOVE|PRIOR)\b.*/gim,
  /^NEW\s+INSTRUCTIONS?\s*:/gim,
  /^YOU\s+ARE\s+NOW\b.*/gim,
  /^ACT\s+AS\s+(?:IF|A|AN|THE)\b.*/gim,
];

/**
 * Sanitize user-provided text before embedding in prompts.
 * Strips common prompt injection patterns while preserving legitimate content.
 */
export function sanitizeUserInput(text: string): string {
  if (!text) return "";
  let cleaned = text;
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  // Collapse excessive whitespace left by removals
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}

// Base64 encode/decode helpers for Deno
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
