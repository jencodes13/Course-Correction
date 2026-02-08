import { GoogleGenAI, Type } from "@google/genai";
import {
  AnalysisMetrics,
  RegulatoryUpdate,
  VisualTransformation,
  ProjectConfig,
  IngestedFile,
  DemoSlide,
  GeneratedUseCase,
  InferredSector,
  DemoResult,
  UpdateMode,
  Citation,
  DemoSlideEnhanced,
  CourseFinding,
  FindingsScanResult
} from "../types";
import { recordUsage } from "./usageTracker";
import { supabase } from "./supabaseClient";

// Gemini Client — only used as fallback in development when Edge Functions fail
let ai: GoogleGenAI;
try {
  ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || 'placeholder' });
} catch {
  // If initialization fails, create with placeholder — Edge Functions are the primary path
  ai = new GoogleGenAI({ apiKey: 'placeholder' });
}

/**
 * Helper to extract usage metadata from response and record it
 */
function trackUsage(response: any, model: string, functionName: string, startTime: number): void {
  const durationMs = Date.now() - startTime;

  // The @google/genai SDK includes usageMetadata in the response
  const usage = response.usageMetadata;
  if (usage) {
    recordUsage(
      model,
      functionName,
      usage.promptTokenCount || 0,
      usage.candidatesTokenCount || 0,
      durationMs
    );
  } else {
    // Fallback: estimate tokens from response length if no metadata
    const responseText = response.text || '';
    const estimatedOutputTokens = Math.ceil(responseText.length / 4);
    recordUsage(model, functionName, 0, estimatedOutputTokens, durationMs);
  }
}

/**
 * Retry wrapper with exponential backoff for Edge Function calls.
 * Only retries on network errors and 5xx server errors, not 4xx client errors.
 */
async function withRetry<T>(
  fn: () => Promise<{ data: T; error: any }>,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<{ data: T; error: any }> {
  let lastResult: { data: T; error: any } = { data: null as T, error: null };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      lastResult = await fn();

      if (!lastResult.error) return lastResult;

      // Don't retry 4xx auth/client errors
      const status = lastResult.error?.status || lastResult.error?.context?.status;
      if (status && status >= 400 && status < 500) return lastResult;

      // Retryable error -- wait with exponential backoff before next attempt
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (err) {
      // Network-level error (fetch failed, timeout, etc.) -- retryable
      lastResult = { data: null as T, error: err };
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return lastResult;
}

// ============================================
// 1. Multimodal Analysis (Text + Images + Video)
// ============================================

async function analyzeCourseContentDirect(text: string, files: IngestedFile[], config: ProjectConfig): Promise<AnalysisMetrics> {
  const startTime = Date.now();
  const model = 'gemini-3-pro-preview';

  try {
    const parts: any[] = [];

    if (text) parts.push({ text: `Course Text Content: ${text}` });

    // Direct fallback only supports inline files (storage files need Edge Functions)
    files.forEach(file => {
      if (!file.data) return;
      const base64Data = file.data.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: base64Data
        }
      });
    });

    const prompt = `
      Analyze this course material for content freshness and learner engagement.

      Context:
      - Goal: ${config.goal}
      - Audience: ${config.targetAudience}
      - Location: ${config.location || "General/Global"}
      - Standards: ${config.standardsContext}

      Score freshness (0-100) and engagement (0-100). Identify 3 specific issues for each. Provide a summary.

      SCORING RUBRICS (follow exactly):

      FRESHNESS SCORE:
      - 90-100: All citations, regulations, and statistics are within 1 year of current date
      - 70-89: Mostly current, with 1-2 outdated references
      - 50-69: Several outdated references, some deprecated regulations cited
      - Below 50: Significantly outdated — multiple expired regulations, old statistics, deprecated practices

      ENGAGEMENT SCORE:
      - 90-100: Rich multimedia, interactive scenarios, varied question types, strong visual hierarchy
      - 70-89: Good structure with some interactivity, clear headings, reasonable visual variety
      - 50-69: Mostly text-based, minimal interactivity, basic formatting
      - Below 50: Dense text walls, no visual breaks, no interactive elements, poor readability
    `;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [...parts, { text: prompt }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            freshnessScore: { type: Type.INTEGER },
            engagementScore: { type: Type.INTEGER },
            freshnessIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
            engagementIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING }
          },
          required: ["freshnessScore", "engagementScore", "freshnessIssues", "engagementIssues", "summary"]
        }
      }
    });

    trackUsage(response, model, 'analyzeCourseContent', startTime);

    if (response.text) {
      return JSON.parse(response.text) as AnalysisMetrics;
    }
    throw new Error("No response");

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      freshnessScore: 50,
      engagementScore: 50,
      freshnessIssues: ["Unable to fully process files", "Check file formats"],
      engagementIssues: ["Content analysis interrupted"],
      summary: "Error during AI analysis. Please verify API key and file types."
    };
  }
}

export const analyzeCourseContent = async (text: string, files: IngestedFile[], config: ProjectConfig): Promise<AnalysisMetrics> => {
  const startTime = Date.now();
  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('analyze-course', { body: { text, files, config } })
    );
    if (error) throw error;
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-pro-preview', 'analyzeCourseContent (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
    return data as AnalysisMetrics;
  } catch (err) {
    console.warn('Edge Function analyze-course failed, falling back to direct:', err);
    return analyzeCourseContentDirect(text, files, config);
  }
};

// ============================================
// 2. Maps Grounding (Authority Identification)
// ============================================

async function identifyLocalAuthorityDirect(location: string): Promise<string> {
  if (!location) return "General Federal Standards";

  const startTime = Date.now();
  const model = "gemini-2.5-flash";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `What is the specific government body or code authority responsible for professional training regulations in ${location}?`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    trackUsage(response, model, 'identifyLocalAuthority', startTime);

    return response.text || location;
  } catch (e) {
    console.error("Maps Grounding Error", e);
    return location;
  }
}

export const identifyLocalAuthority = async (location: string): Promise<string> => {
  if (!location) return "General Federal Standards";
  const startTime = Date.now();
  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('jurisdiction-lookup', { body: { location } })
    );
    if (error) throw error;
    const result = (data as any)?.authority || (data as any)?.result || location;
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'identifyLocalAuthority (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
    return result;
  } catch (err) {
    console.warn('Edge Function jurisdiction-lookup failed, falling back to direct:', err);
    return identifyLocalAuthorityDirect(location);
  }
};

// ============================================
// 3. Search Grounding (Regulatory Update)
// ============================================

async function performRegulatoryUpdateDirect(content: string, domainContext: string, location: string): Promise<RegulatoryUpdate[]> {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  try {
    let localAuthority = domainContext;
    if (location) {
        const auth = await identifyLocalAuthority(location);
        localAuthority = `${domainContext} in ${location} (${auth})`;
    }

    const prompt = `
      Act as the "Regulatory Hound".
      Context: ${localAuthority}.
      Task: Identify 3 outdated sections. Rewrite them for 2024/2025 compliance.
      YOU MUST USE GOOGLE SEARCH to find the latest specific codes.

      Content: "${content.substring(0, 2000)}"
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    trackUsage(response, model, 'performRegulatoryUpdate', startTime);

    const text = response.text || "[]";
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as RegulatoryUpdate[];
    }

    return [{
        id: "1",
        originalText: "Content analysis",
        updatedText: text.substring(0, 150) + "...",
        citation: "Google Search Result",
        reason: "Search grounding data retrieved."
    }];

  } catch (error) {
    console.error("Regulatory Search Error:", error);
    return [];
  }
}

export const performRegulatoryUpdate = async (content: string, domainContext: string, location: string): Promise<RegulatoryUpdate[]> => {
  const startTime = Date.now();
  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('regulatory-update', { body: { content, domainContext, location } })
    );
    if (error) throw error;
    const result = Array.isArray(data) ? data as RegulatoryUpdate[] : (data as any)?.updates || [];
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'performRegulatoryUpdate (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
    return result;
  } catch (err) {
    console.warn('Edge Function regulatory-update failed, falling back to direct:', err);
    return performRegulatoryUpdateDirect(content, domainContext, location);
  }
};

// ============================================
// 4. Image Generation / Editing
// ============================================

async function generateAssetDirect(prompt: string, base64Image?: string): Promise<string | null> {
    const startTime = Date.now();
    const model = 'gemini-2.5-flash-image';

    try {
        const parts: any[] = [];

        if (base64Image) {
            parts.push({
                inlineData: {
                    mimeType: "image/png",
                    data: base64Image.split(',')[1]
                }
            });
            parts.push({ text: `Edit this image: ${prompt}` });
        } else {
            parts.push({ text: `Generate an image: ${prompt}` });
        }

        const response = await ai.models.generateContent({
            model,
            contents: { parts },
        });

        trackUsage(response, model, 'generateAsset', startTime);

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        return null;

    } catch (e) {
        console.error("Image Gen Error", e);
        return null;
    }
}

export const generateAsset = async (prompt: string, base64Image?: string): Promise<string | null> => {
    const startTime = Date.now();
    try {
        const { data, error } = await withRetry(() =>
            supabase.functions.invoke('generate-asset', { body: { prompt, baseImage: base64Image } })
        );
        if (error) throw error;
        const result = (data as any)?.imageUrl || (data as any)?.image || null;
        recordUsage('gemini-2.5-flash-image', 'generateAsset (edge)', 0, 1, Date.now() - startTime);
        return result;
    } catch (err) {
        console.warn('Edge Function generate-asset failed, falling back to direct:', err);
        return generateAssetDirect(prompt, base64Image);
    }
};

// ============================================
// 5. Visual Analysis
// ============================================

async function performVisualTransformationDirect(content: string, theme: string): Promise<VisualTransformation[]> {
    const startTime = Date.now();
    const model = 'gemini-3-flash-preview';

    try {
      const response = await ai.models.generateContent({
        model,
        contents: `Theme: ${theme}. Identify 3 boring sections in: "${content.substring(0,2000)}". Suggest visual transforms (timeline, accordion, etc). Return JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sectionId: { type: Type.STRING },
                originalType: { type: Type.STRING },
                suggestedType: { type: Type.STRING },
                visualDescription: { type: Type.STRING },
                imagePrompt: { type: Type.STRING },
                content: { type: Type.STRING }
              }
            }
          }
        }
      });

      trackUsage(response, model, 'performVisualTransformation', startTime);

      return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}

export const performVisualTransformation = async (content: string, theme: string): Promise<VisualTransformation[]> => {
    const startTime = Date.now();
    try {
        const { data, error } = await withRetry(() =>
            supabase.functions.invoke('visual-transform', { body: { content, theme } })
        );
        if (error) throw error;
        const result = Array.isArray(data) ? data as VisualTransformation[] : (data as any)?.transformations || [];
        const usage = (data as any)?._usage;
        recordUsage('gemini-3-flash-preview', 'performVisualTransformation (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
        return result;
    } catch (err) {
        console.warn('Edge Function visual-transform failed, falling back to direct:', err);
        return performVisualTransformationDirect(content, theme);
    }
};

// ============================================
// 6. Demo Slide Generation
// ============================================

async function generateDemoSlidesDirect(topic: string, location: string, style: string, fileData?: string): Promise<DemoSlide[]> {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  try {
    const parts: any[] = [];

    let promptText = `
      Create 3 introductory training slides for a course about "${topic}".
      Context:
      - Location: ${location} (Ensure any regulatory mentions match this region).
      - Style: ${style}.

      Return a JSON array of 3 slides. Each slide has:
      - title
      - bullets (array of strings)
      - visualPrompt (a prompt to generate an image for this slide)
      - colorTheme (hex code suggestion)
    `;

    if (fileData) {
        const base64Data = fileData.split(',')[1];
        let mimeType = "application/pdf";
        if (fileData.includes("image/png")) mimeType = "image/png";
        if (fileData.includes("image/jpeg")) mimeType = "image/jpeg";

        parts.push({
            inlineData: {
                mimeType: mimeType,
                data: base64Data
            }
        });
        promptText = `Based on the attached file, ` + promptText;
    }

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                        visualPrompt: { type: Type.STRING },
                        colorTheme: { type: Type.STRING }
                    },
                    required: ["title", "bullets", "visualPrompt", "colorTheme"]
                }
            }
        }
    });

    trackUsage(response, model, 'generateDemoSlides', startTime);

    return JSON.parse(response.text || "[]");

  } catch (error) {
      console.error("Demo Gen Error", error);
      return [
          {
              title: "Welcome to " + topic,
              bullets: ["Introduction to key concepts", "Overview of safety protocols", "Getting started"],
              visualPrompt: "A welcoming modern office abstract background",
              colorTheme: "#4f46e5"
          },
          {
              title: "Core Requirements",
              bullets: ["Understanding the basics", "Compliance checklist", "Required tools"],
              visualPrompt: "Checklist and tools arranged neatly",
              colorTheme: "#4f46e5"
          },
          {
              title: "Next Steps",
              bullets: ["Assessment preview", "Certification path", "Resources"],
              visualPrompt: "A path leading to a goal flag",
              colorTheme: "#4f46e5"
          }
      ];
  }
}

export const generateDemoSlides = async (topic: string, location: string, style: string, fileData?: string): Promise<DemoSlide[]> => {
  const startTime = Date.now();
  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', { body: { topic, location, style, fileData } })
    );
    if (error) throw error;
    const result = Array.isArray(data) ? data as DemoSlide[] : (data as any)?.slides || [];
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'generateDemoSlides (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
    return result;
  } catch (err) {
    console.warn('Edge Function demo-slides failed, falling back to direct:', err);
    return generateDemoSlidesDirect(topic, location, style, fileData);
  }
};

// ============================================
// 7. Landing Page Use Case Generator (direct only)
// ============================================

export const generateCreativeUseCases = async (batchSize: number = 8): Promise<GeneratedUseCase[]> => {
    const startTime = Date.now();
    const model = 'gemini-3-flash-preview';

    try {
        const prompt = `
            Generate ${batchSize} diverse, high-value corporate training use cases where an AI updates regulations and modernizes outdated course materials.

            Think across industries: Aviation, Medical, Legal, Construction, Culinary, Cyber Security, Manufacturing, Retail, Energy, Finance, Hospitality, Tech, Logistics, etc.

            For each use case, imagine a SPECIFIC legacy training material (like a VHS tape, dusty binder, 2005 PowerPoint, fax-based manual, etc.) being transformed into a cutting-edge modern format (like VR simulation, AI chatbot, mobile microlearning, AR overlay, gamified quiz, etc.).

            Return a JSON array where each item has:
            - industry: The industry sector (short, e.g., "Aviation", "Healthcare")
            - title: A punchy training topic title (3-5 words, e.g., "Hydraulics 101", "Sterile Field Protocol")
            - legacyInput: The old format being replaced (e.g., "1998 VHS Tape", "Faded Binder", "Fax Manual")
            - modernOutput: The new AI-powered format (e.g., "VR Simulation", "AI Chatbot", "AR Overlay")
            - color: A hex color code that fits the industry (e.g., "#0ea5e9" for Aviation blue)
            - icon: A Lucide icon name that represents the industry (e.g., "Plane", "Activity", "HardHat", "Shield", "ShoppingBag", "Zap", "Scale", "Truck", "Factory", "Banknote", "Coffee", "Cpu")

            Make each use case unique and creative. Vary the industries, topics, legacy formats, and modern outputs.
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            industry: { type: Type.STRING },
                            title: { type: Type.STRING },
                            legacyInput: { type: Type.STRING },
                            modernOutput: { type: Type.STRING },
                            color: { type: Type.STRING },
                            icon: { type: Type.STRING }
                        },
                        required: ["industry", "title", "legacyInput", "modernOutput", "color", "icon"]
                    }
                }
            }
        });

        trackUsage(response, model, 'generateCreativeUseCases', startTime);

        return JSON.parse(response.text || "[]") as GeneratedUseCase[];
    } catch (e) {
        console.error("Use Case Gen Error", e);
        return [];
    }
}

// ============================================
// 8. Sector Inference from Content (direct only)
// ============================================

export const inferSectorFromContent = async (
  topic: string,
  files: IngestedFile[]
): Promise<InferredSector> => {
  const startTime = Date.now();

  // Build a richer topic string from filenames if topic is sparse
  const fileContext = files.map(f => f.name).join(', ');
  const enrichedTopic = topic
    ? (fileContext ? `${topic} (files: ${fileContext})` : topic)
    : fileContext || 'unknown';

  // Prepare files for the Edge Function:
  // - Storage-backed files: pass storagePath (Edge Function will download)
  // - Small inline files: pass data
  // - Large inline files: pass metadata only (topic + filename is enough)
  const MAX_INLINE_INFERENCE_SIZE = 4 * 1024 * 1024;
  const inferenceFiles = files
    .map(f => {
      if (f.storagePath) return { name: f.name, type: f.type, storagePath: f.storagePath };
      if (f.data && f.data.length <= MAX_INLINE_INFERENCE_SIZE) return f;
      return null; // too large for inline, no storage path — skip
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  try {
    // Route through Edge Function (API key server-side)
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: { topic: enrichedTopic, inferSector: true, files: inferenceFiles }
      })
    );
    if (error) throw error;

    const result = data as any;
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'inferSectorFromContent (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);

    return {
      sector: result.sector || 'General',
      confidence: result.confidence || 'low',
      alternatives: result.alternatives || [],
      reasoning: result.reasoning || 'Unable to determine industry',
      isAmbiguous: result.isAmbiguous || false,
      detectedTopics: result.detectedTopics || []
    };

  } catch (err) {
    console.warn('Edge Function sector inference failed, trying direct:', err);

    // Fallback to direct API (dev only) — only inline files work here
    try {
      const inlineFiles = files.filter(f => f.data);
      return await inferSectorFromContentDirect(enrichedTopic, inlineFiles);
    } catch (error) {
      console.error("Sector Inference Error:", error);
      return {
        sector: 'General',
        confidence: 'low',
        reasoning: 'Could not identify industry automatically.',
        isAmbiguous: true,
        alternatives: ['Information Technology', 'Healthcare', 'Construction', 'Finance & Banking']
      };
    }
  }
};

async function inferSectorFromContentDirect(
  topic: string,
  files: IngestedFile[]
): Promise<InferredSector> {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  const parts: any[] = [];

  files.forEach(file => {
    if (!file.data) return;
    const base64Data = file.data.split(',')[1];
    parts.push({
      inlineData: {
        mimeType: file.type,
        data: base64Data
      }
    });
  });

  const prompt = `
    Determine the primary industry for this training/certification material.

    ${topic ? `Topic: "${topic}"` : 'No topic provided - infer from files only.'}

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

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sector: { type: Type.STRING },
          confidence: { type: Type.STRING },
          alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
          reasoning: { type: Type.STRING },
          isAmbiguous: { type: Type.BOOLEAN },
          detectedTopics: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["sector", "confidence", "reasoning", "isAmbiguous"]
      }
    }
  });

  trackUsage(response, model, 'inferSectorFromContent', startTime);

  const result = JSON.parse(response.text || '{}');
  return {
    sector: result.sector || 'General',
    confidence: result.confidence || 'low',
    alternatives: result.alternatives || [],
    reasoning: result.reasoning || 'Unable to determine sector',
    isAmbiguous: result.isAmbiguous || false,
    detectedTopics: result.detectedTopics || []
  };
}

// ============================================
// 9. Enhanced Demo Slide Generation with Search Grounding
// ============================================

async function generateDemoSlidesEnhancedDirect(
  topic: string,
  sector: string,
  location: string,
  updateMode: UpdateMode,
  style: string,
  files: IngestedFile[]
): Promise<DemoResult> {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  try {
    const parts: any[] = [];

    // Direct fallback only supports inline files
    files.forEach(file => {
      if (!file.data) return;
      const base64Data = file.data.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: base64Data
        }
      });
    });

    let modeInstructions = '';
    if (updateMode === 'regulatory' || updateMode === 'full') {
      modeInstructions += `
        REGULATORY UPDATES:
        - Search for current ${sector} regulations in ${location}
        - Find specific code numbers, effective dates, and official sources
        - Identify outdated information and provide corrected versions
        - Reference citations by ID number matching the citations array
      `;
    }
    if (updateMode === 'visual' || updateMode === 'full') {
      modeInstructions += `
        VISUAL UPDATES:
        - Transform text-heavy content into engaging formats
        - Suggest modern layouts (timelines, accordions, cards)
        - Recommend visual hierarchy improvements
      `;
    }

    const prompt = `
      Modernize training materials for "${topic}" in the ${sector} sector, located in ${location}.
      Update type: ${updateMode}. Visual style: ${style}.

      ${modeInstructions}

      Create exactly 3 slides showing BEFORE (outdated 2015-era content) and AFTER (current, corrected content).
      ${files.length > 0 ? 'Base content on the uploaded materials.' : 'Create realistic example content for this sector.'}

      For the "after" content, use search to find real current regulations. Include citation IDs referencing specific sources.

      CRITICAL CONSTRAINTS (follow exactly):
      - Each bullet must include a specific fact, regulation number, or actionable instruction — not generic statements like "Understanding the basics"
      - "before" bullets must show plausible outdated content with wrong dates, old regulation numbers, or deprecated practices
      - "after" bullets must cite specific current codes, dates, and requirements
      - Provide real source URLs in citations, not placeholder links
    `;

    parts.push({ text: prompt });

    // Gemini 3: Search Grounding + Structured Output together
    const slideContentSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        citationIds: { type: Type.ARRAY, items: { type: Type.INTEGER } }
      },
      required: ["title", "bullets", "citationIds"],
      propertyOrdering: ["title", "bullets", "citationIds"]
    };

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  before: slideContentSchema,
                  after: slideContentSchema,
                  changesSummary: { type: Type.STRING },
                  visualStyle: {
                    type: Type.OBJECT,
                    properties: {
                      accentColor: { type: Type.STRING },
                      layout: { type: Type.STRING }
                    },
                    required: ["accentColor", "layout"]
                  }
                },
                required: ["id", "before", "after", "changesSummary", "visualStyle"]
              }
            },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  url: { type: Type.STRING },
                  snippet: { type: Type.STRING },
                  accessedDate: { type: Type.STRING }
                },
                required: ["id", "title", "url", "snippet", "accessedDate"]
              }
            },
            metadata: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                sector: { type: Type.STRING },
                location: { type: Type.STRING },
                updateMode: { type: Type.STRING },
                searchQueries: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["topic", "sector", "location", "updateMode", "searchQueries"]
            }
          },
          required: ["slides", "citations", "metadata"],
          propertyOrdering: ["slides", "citations", "metadata"]
        }
      }
    });

    trackUsage(response, model, 'generateDemoSlidesEnhanced', startTime);

    const responseText = response.text || '';

    // Try structured JSON parsing first (expected with responseSchema)
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.slides && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
        // Merge grounding metadata citations with model-generated citations
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        let citations: Citation[] = parsed.citations || [];

        // Supplement with grounding chunks if model citations are sparse
        if (groundingMetadata?.groundingChunks && citations.length === 0) {
          groundingMetadata.groundingChunks.forEach((chunk: any, idx: number) => {
            if (chunk.web) {
              citations.push({
                id: idx + 1,
                title: chunk.web.title || `Source ${idx + 1}`,
                url: chunk.web.uri || '',
                snippet: '',
                accessedDate: new Date().toISOString().split('T')[0]
              });
            }
          });
        }

        const searchQueries = parsed.metadata?.searchQueries ||
          groundingMetadata?.webSearchQueries || [];

        return {
          slides: parsed.slides.slice(0, 3).map((s: any, idx: number) => ({
            id: s.id || `slide-${idx + 1}`,
            before: {
              title: s.before?.title || `Section ${idx + 1} (Original)`,
              bullets: s.before?.bullets || ['Original content'],
              citationIds: s.before?.citationIds || []
            },
            after: {
              title: s.after?.title || `Section ${idx + 1} (Updated)`,
              bullets: s.after?.bullets || ['Updated content'],
              citationIds: s.after?.citationIds || []
            },
            changesSummary: s.changesSummary || 'Updated with current information.',
            visualStyle: {
              accentColor: s.visualStyle?.accentColor || ['#4f46e5', '#0ea5e9', '#10b981'][idx % 3],
              layout: (s.visualStyle?.layout || 'split') as 'split' | 'stacked' | 'overlay'
            }
          })),
          citations,
          metadata: {
            sector: parsed.metadata?.sector || sector,
            location: parsed.metadata?.location || location,
            updateMode: (parsed.metadata?.updateMode || updateMode) as UpdateMode,
            generatedAt: new Date().toISOString(),
            searchQueries
          }
        };
      }
    } catch {
      // JSON parsing failed, fall through to regex parser
      console.warn('Structured JSON parsing failed, falling back to text parsing');
    }

    // Fallback: use legacy text parsing
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const citations: Citation[] = [];

    if (groundingMetadata?.groundingChunks) {
      groundingMetadata.groundingChunks.forEach((chunk: any, idx: number) => {
        if (chunk.web) {
          citations.push({
            id: idx + 1,
            title: chunk.web.title || `Source ${idx + 1}`,
            url: chunk.web.uri || '',
            snippet: '',
            accessedDate: new Date().toISOString().split('T')[0]
          });
        }
      });
    }

    const searchQueries = groundingMetadata?.webSearchQueries || [];
    const slides = parseResponseToSlides(responseText, style);

    return {
      slides,
      citations,
      metadata: {
        sector,
        location,
        updateMode,
        generatedAt: new Date().toISOString(),
        searchQueries
      }
    };

  } catch (error) {
    console.error("Enhanced Demo Gen Error:", error);
    return createFallbackDemoResult(topic, sector, location, updateMode, style);
  }
}

// ============================================
// Findings Scan — Stage 1 of the two-stage demo flow
// ============================================

export const scanCourseFindings = async (
  topic: string,
  sector: string,
  location: string,
  updateMode: UpdateMode,
  files: IngestedFile[]
): Promise<FindingsScanResult> => {
  const startTime = Date.now();

  // Prepare files: pass storage paths, small inline files, skip large inline-only files
  const scanFiles = files
    .map(f => {
      if (f.storagePath) return { name: f.name, type: f.type, storagePath: f.storagePath };
      if (f.data && f.data.length <= 4 * 1024 * 1024) return f;
      return null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: { topic, sector, location, updateMode, files: scanFiles, action: 'scan' }
      })
    );
    if (error) throw error;
    const scanUsage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'scanCourseFindings (edge)', scanUsage?.promptTokenCount || 0, scanUsage?.candidatesTokenCount || 0, Date.now() - startTime);
    return data as FindingsScanResult;
  } catch (err) {
    console.warn('Edge Function scan failed, falling back to direct:', err);
    return scanCourseFindingsDirect(topic, sector, location, updateMode, files);
  }
};

async function scanCourseFindingsDirect(
  topic: string,
  sector: string,
  location: string,
  updateMode: UpdateMode,
  files: IngestedFile[]
): Promise<FindingsScanResult> {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  const parts: any[] = [];
  files.forEach(file => {
    if (!file.data) return;
    const base64Data = file.data.split(',')[1] || file.data;
    parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
  });

  let categoryInstructions = "";
  if (updateMode === "regulatory" || updateMode === "full") {
    categoryInstructions += `1. OUTDATED: Content that was once correct but has been superseded\n2. COMPLIANCE: Regulatory/standards changes (only if course explicitly teaches compliance)\n`;
  }
  if (updateMode === "visual" || updateMode === "full") {
    categoryInstructions += `3. MISSING: Important topics absent from this course\n4. STRUCTURAL: Format issues (text-heavy, missing assessments)\n`;
  }

  parts.push({
    text: `Analyze course materials for "${topic}" in the ${sector} sector (${location}).

TASK: Identify what needs updating. DO NOT generate slides. Only report findings.

Categories: ${categoryInstructions}

Return 3-5 most impactful findings. Every claim must come from course materials or search results. Do not invent facts, dates, or statistics. If course creation date is unknown, say "undated". Focus on the course's primary subject — not tangential topics.

Set id to "finding-1", "finding-2", etc. category: "outdated"|"missing"|"compliance"|"structural". severity: "high"|"medium"|"low".`
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  category: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  sourceSnippet: { type: Type.STRING },
                  currentInfo: { type: Type.STRING },
                },
                required: ['id', 'category', 'title', 'description', 'severity'],
              },
            },
            searchQueries: { type: Type.ARRAY, items: { type: Type.STRING } },
            courseSummary: { type: Type.STRING },
          },
          required: ['findings', 'searchQueries', 'courseSummary'],
        },
      },
    });

    trackUsage(response, model, 'scanCourseFindings', startTime);
    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return {
      findings: parsed.findings || [],
      searchQueries: parsed.searchQueries || [],
      courseSummary: parsed.courseSummary || '',
    };
  } catch (error) {
    console.error('Direct scan findings error:', error);
    return { findings: [], searchQueries: [], courseSummary: 'Unable to analyze course content.' };
  }
}

export const generateDemoSlidesEnhanced = async (
  topic: string,
  sector: string,
  location: string,
  updateMode: UpdateMode,
  style: string,
  files: IngestedFile[],
  approvedFindings?: CourseFinding[],
  userContext?: string,
  designPreferences?: { audience?: string; feeling?: string; emphasis?: string }
): Promise<DemoResult> => {
  const startTime = Date.now();
  try {
    // Use guided generation if findings are provided
    const body = approvedFindings && approvedFindings.length > 0
      ? { topic, sector, location, updateMode, style, files, action: 'generate' as const, approvedFindings, userContext, designPreferences }
      : { topic, sector, location, updateMode, style, files, enhanced: true };

    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', { body })
    );
    if (error) throw error;
    const enhancedUsage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'generateDemoSlidesEnhanced (edge)', enhancedUsage?.promptTokenCount || 0, enhancedUsage?.candidatesTokenCount || 0, Date.now() - startTime);
    return data as DemoResult;
  } catch (err) {
    console.warn('Edge Function demo-slides (enhanced) failed, falling back to direct:', err);
    return generateDemoSlidesEnhancedDirect(topic, sector, location, updateMode, style, files);
  }
};

// ============================================
// Helper functions for slide parsing
// ============================================

function parseResponseToSlides(text: string, style: string): DemoSlideEnhanced[] {
  // Try to parse as JSON first (Gemini sometimes returns structured JSON)
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3).map((item: any, idx: number) => ({
          id: `slide-${idx + 1}`,
          before: {
            title: item.before?.title || item.originalTitle || `Section ${idx + 1} (Original)`,
            bullets: item.before?.bullets || item.originalBullets || ['Original content'],
            citationIds: []
          },
          after: {
            title: item.after?.title || item.updatedTitle || `Section ${idx + 1} (Updated)`,
            bullets: item.after?.bullets || item.updatedBullets || ['Updated content'],
            citationIds: item.after?.citationIds || item.citationIds || []
          },
          changesSummary: item.changesSummary || item.summary || 'Updated with current information.',
          visualStyle: {
            accentColor: ['#4f46e5', '#0ea5e9', '#10b981'][idx % 3],
            layout: 'split' as const
          }
        }));
      }
    }
  } catch {
    // Not valid JSON, fall through to text parsing
  }

  const slides: DemoSlideEnhanced[] = [];

  // Try multiple split patterns for different Gemini output formats
  const splitPatterns = [
    /(?:^|\n)#{1,3}\s*slide\s*\d+/gi,           // ### Slide 1
    /(?:^|\n)#{1,3}\s*\d+[\.\)]/gi,              // ### 1. or ### 1)
    /(?:^|\n)\*\*slide\s*\d+/gi,                  // **Slide 1
    /(?:^|\n)slide\s*\d+\s*[:\-]/gi,             // Slide 1: or Slide 1 -
    /(?:^|\n)---+/g,                              // --- separator lines
  ];

  let sections: string[] = [];
  for (const pattern of splitPatterns) {
    const result = text.split(pattern).filter(s => s.trim().length > 20);
    if (result.length >= 3) {
      sections = result;
      break;
    }
  }

  if (sections.length < 3) {
    const chunks = splitIntoChunks(text, 3);
    chunks.forEach((chunk, idx) => {
      slides.push(createSlideFromText(chunk, idx, style));
    });
  } else {
    sections.slice(0, 3).forEach((section, idx) => {
      slides.push(createSlideFromText(section, idx, style));
    });
  }

  return slides.length > 0 ? slides : createDefaultSlides(style);
}

function splitIntoChunks(text: string, count: number): string[] {
  const lines = text.split('\n').filter(l => l.trim());
  const chunkSize = Math.ceil(lines.length / count);
  const chunks: string[] = [];

  for (let i = 0; i < count; i++) {
    chunks.push(lines.slice(i * chunkSize, (i + 1) * chunkSize).join('\n'));
  }

  return chunks;
}

function createSlideFromText(text: string, index: number, style: string): DemoSlideEnhanced {
  // Try multiple before/after patterns
  const beforePatterns = [
    /(?:\*\*)?(?:before|original|outdated|old)(?:\*\*)?[:\s\-]*([\s\S]*?)(?=(?:\*\*)?(?:after|updated|new|current)(?:\*\*)?[:\s\-])/i,
    /(?:^|\n)(?:before|original)[:\s]*([\s\S]*?)(?:\n\n)/i,
  ];
  const afterPatterns = [
    /(?:\*\*)?(?:after|updated|new|current)(?:\*\*)?[:\s\-]*([\s\S]*?)(?=(?:\*\*)?(?:before|original|change|summary)|\s*$)/i,
    /(?:^|\n)(?:after|updated)[:\s]*([\s\S]*?)$/i,
  ];

  let beforeContent = '';
  let afterContent = '';

  for (const pattern of beforePatterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) { beforeContent = match[1]; break; }
  }
  for (const pattern of afterPatterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) { afterContent = match[1]; break; }
  }

  // Fallback: split the text in half
  if (!beforeContent) beforeContent = text.slice(0, text.length / 2);
  if (!afterContent) afterContent = text.slice(text.length / 2);

  const extractBullets = (content: string): string[] => {
    // Match numbered lists (1., 2.) and bullet lists (-, *, •)
    const bullets = content.match(/(?:^|\n)\s*(?:\d+[\.\)]\s*|[-•*]\s*)([^\n]+)/g) || [];
    if (bullets.length > 0) {
      return bullets
        .map(b => b.replace(/^\s*(?:\d+[\.\)]\s*|[-•*]\s*)/, '').trim())
        .filter(b => b.length > 5)
        .slice(0, 4);
    }
    // Fall back to sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 4).map(s => s.trim());
  };

  // Extract citations from the "after" section only
  const afterCitationMatches = afterContent.match(/\[(\d+)\]/g) || [];
  const citationIds = [...new Set(afterCitationMatches.map(m => parseInt(m.replace(/[\[\]]/g, ''))))];

  // Extract title: try markdown headers, bold text, or first meaningful line
  const titleMatch = text.match(/(?:^|\n)#{1,3}\s*([^\n]+)/);
  const boldTitleMatch = !titleMatch ? text.match(/\*\*([^*]{5,60})\*\*/) : null;
  const firstLineMatch = !titleMatch && !boldTitleMatch ? text.match(/^([^\n]{5,60})/) : null;
  const title = (titleMatch?.[1] || boldTitleMatch?.[1] || firstLineMatch?.[1] || `Section ${index + 1}`).replace(/[#*]/g, '').trim();

  const accentColors = ['#4f46e5', '#0ea5e9', '#10b981'];

  return {
    id: `slide-${index + 1}`,
    before: {
      title: `${title} (Original)`,
      bullets: extractBullets(beforeContent),
      citationIds: []
    },
    after: {
      title: `${title} (Updated)`,
      bullets: extractBullets(afterContent),
      citationIds
    },
    changesSummary: `Updated with current regulations and modern formatting.`,
    visualStyle: {
      accentColor: accentColors[index % accentColors.length],
      layout: 'split'
    }
  };
}

function createDefaultSlides(style: string): DemoSlideEnhanced[] {
  return [
    {
      id: 'slide-1',
      before: {
        title: 'Introduction (Original)',
        bullets: ['Generic overview from 2015', 'Outdated statistics', 'Missing current requirements'],
        citationIds: []
      },
      after: {
        title: 'Introduction (Updated)',
        bullets: ['Current industry overview [1]', 'Latest statistics from 2024 [2]', 'Compliance requirements updated'],
        citationIds: [1, 2]
      },
      changesSummary: 'Updated with current regulations and statistics.',
      visualStyle: { accentColor: '#4f46e5', layout: 'split' }
    },
    {
      id: 'slide-2',
      before: {
        title: 'Core Requirements (Original)',
        bullets: ['Old compliance checklist', 'Deprecated procedures', 'Missing safety protocols'],
        citationIds: []
      },
      after: {
        title: 'Core Requirements (Updated)',
        bullets: ['Current compliance checklist [3]', 'Modern procedures', 'Enhanced safety protocols [4]'],
        citationIds: [3, 4]
      },
      changesSummary: 'Aligned with latest regulatory requirements.',
      visualStyle: { accentColor: '#0ea5e9', layout: 'split' }
    },
    {
      id: 'slide-3',
      before: {
        title: 'Best Practices (Original)',
        bullets: ['Outdated methodologies', 'Legacy tools mentioned', 'No digital options'],
        citationIds: []
      },
      after: {
        title: 'Best Practices (Updated)',
        bullets: ['Modern methodologies [5]', 'Current tools and software', 'Digital-first approach'],
        citationIds: [5]
      },
      changesSummary: 'Modernized for current industry standards.',
      visualStyle: { accentColor: '#10b981', layout: 'split' }
    }
  ];
}

function createFallbackDemoResult(
  topic: string,
  sector: string,
  location: string,
  updateMode: UpdateMode,
  style: string
): DemoResult {
  return {
    slides: createDefaultSlides(style),
    citations: [
      { id: 1, title: 'Industry Standards Database', url: '#', snippet: 'Current standards reference', accessedDate: new Date().toISOString().split('T')[0] },
      { id: 2, title: 'Regulatory Commission', url: '#', snippet: 'Official regulatory guidance', accessedDate: new Date().toISOString().split('T')[0] },
      { id: 3, title: 'Compliance Framework', url: '#', snippet: 'Compliance requirements', accessedDate: new Date().toISOString().split('T')[0] },
      { id: 4, title: 'Safety Administration', url: '#', snippet: 'Safety protocols', accessedDate: new Date().toISOString().split('T')[0] },
      { id: 5, title: 'Best Practices Guide', url: '#', snippet: 'Industry best practices', accessedDate: new Date().toISOString().split('T')[0] }
    ],
    metadata: {
      sector,
      location,
      updateMode,
      generatedAt: new Date().toISOString(),
      searchQueries: [`${sector} regulations ${location}`, `${topic} compliance 2024`]
    }
  };
}

// --- LIVE API CLIENT HELPER (Gemini 2.5 Native Audio) ---
export const connectLiveParams = {
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: 'You are an expert Instructional Designer consultant. Help the user plan their course updates.',
    }
};
