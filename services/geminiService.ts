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
  DemoSlideEnhanced
} from "../types";
import { recordUsage } from "./usageTracker";
import { supabase } from "./supabaseClient";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

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

    files.forEach(file => {
      const base64Data = file.data.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: base64Data
        }
      });
    });

    const prompt = `
      Analyze this course material.

      Context:
      - Goal: ${config.goal}
      - Audience: ${config.targetAudience}
      - Location: ${config.location || "General/Global"}
      - Standards: ${config.standardsContext}

      Determine freshness (0-100) and engagement (0-100).
      Identify 3 specific issues for each.
      Provide a summary.
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
  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('analyze-course', { body: { text, files, config } })
    );
    if (error) throw error;
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

  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('jurisdiction-lookup', { body: { location } })
    );
    if (error) throw error;
    return (data as any)?.authority || (data as any)?.result || location;
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
  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('regulatory-update', { body: { content, domainContext, location } })
    );
    if (error) throw error;
    if (Array.isArray(data)) return data as RegulatoryUpdate[];
    return (data as any)?.updates || [];
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
    try {
        const { data, error } = await withRetry(() =>
            supabase.functions.invoke('generate-asset', { body: { prompt, baseImage: base64Image } })
        );
        if (error) throw error;
        return (data as any)?.imageUrl || (data as any)?.image || null;
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
    try {
        const { data, error } = await withRetry(() =>
            supabase.functions.invoke('visual-transform', { body: { content, theme } })
        );
        if (error) throw error;
        if (Array.isArray(data)) return data as VisualTransformation[];
        return (data as any)?.transformations || [];
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
  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', { body: { topic, location, style, fileData } })
    );
    if (error) throw error;
    if (Array.isArray(data)) return data as DemoSlide[];
    return (data as any)?.slides || [];
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
  const model = 'gemini-3-flash-preview';

  try {
    const parts: any[] = [];

    files.forEach(file => {
      const base64Data = file.data.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: base64Data
        }
      });
    });

    const prompt = `
      Analyze the provided content and determine the industry sector for this training material.

      ${topic ? `Topic provided by user: "${topic}"` : 'No topic provided - infer from files only.'}

      IMPORTANT: Focus on regulated/safety-critical industries:
      - Healthcare (HIPAA, patient safety, infection control)
      - Construction/Trades (OSHA, fall protection, tool safety)
      - Manufacturing (lockout/tagout, machine guarding)
      - Food Service (FDA, allergens, food safety)
      - Transportation/Logistics (DOT, FMCSA, hazmat)
      - Aviation (FAA, maintenance, safety protocols)
      - Finance (SEC, compliance, AML)
      - Energy (NERC, safety, environmental)
      - Legal (ethics, compliance, professional conduct)

      Determine:
      1. The primary sector this content belongs to
      2. Your confidence level (high/medium/low)
      3. If the content spans multiple unrelated sectors, flag as ambiguous
      4. List any alternative sectors that could apply
      5. Brief reasoning for your determination
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
            sector: {
              type: Type.STRING,
              description: "Primary industry sector (e.g., 'Healthcare', 'Construction', 'Manufacturing')"
            },
            confidence: {
              type: Type.STRING,
              description: "Confidence level: 'high', 'medium', or 'low'"
            },
            alternatives: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Other sectors that could apply"
            },
            reasoning: {
              type: Type.STRING,
              description: "Brief explanation of why this sector was chosen"
            },
            isAmbiguous: {
              type: Type.BOOLEAN,
              description: "True if content spans multiple unrelated sectors"
            },
            detectedTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key topics/subjects detected in the content"
            }
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

  } catch (error) {
    console.error("Sector Inference Error:", error);
    return {
      sector: 'General',
      confidence: 'low',
      reasoning: 'Error during analysis. Please specify sector manually.',
      isAmbiguous: true,
      alternatives: ['Healthcare', 'Construction', 'Manufacturing', 'Transportation']
    };
  }
};

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

    files.forEach(file => {
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
        FOR REGULATORY UPDATES:
        - Search for current ${sector} regulations in ${location}
        - Find specific code numbers, effective dates, and official sources
        - Identify outdated information and provide corrected versions
        - Include numbered citations [1], [2], etc. for each fact
      `;
    }
    if (updateMode === 'visual' || updateMode === 'full') {
      modeInstructions += `
        FOR VISUAL UPDATES:
        - Transform text-heavy content into engaging formats
        - Suggest modern layouts (timelines, accordions, cards)
        - Recommend visual hierarchy improvements
      `;
    }

    const prompt = `
      You are CourseCorrect, an AI that modernizes training materials.

      CONTEXT:
      - Topic: "${topic}"
      - Industry Sector: ${sector}
      - Location: ${location}
      - Update Type: ${updateMode}
      - Visual Style: ${style}

      ${modeInstructions}

      TASK:
      Create exactly 3 slides showing BEFORE and AFTER content.

      For each slide:
      1. Show the ORIGINAL outdated content (what a 2015-era course might say)
      2. Show the UPDATED modern content with current regulations/facts
      3. Use numbered citations [1], [2] etc. for any regulatory claims
      4. Summarize what changed and why

      ${files.length > 0 ? 'Base your content on the uploaded materials.' : 'Create realistic example content for this sector.'}

      YOU MUST USE GOOGLE SEARCH to find real, current regulations for ${sector} in ${location}.
      Include specific code numbers, dates, and official sources.
    `;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    trackUsage(response, model, 'generateDemoSlidesEnhanced', startTime);

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

    const responseText = response.text || '';
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

export const generateDemoSlidesEnhanced = async (
  topic: string,
  sector: string,
  location: string,
  updateMode: UpdateMode,
  style: string,
  files: IngestedFile[]
): Promise<DemoResult> => {
  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: { topic, sector, location, updateMode, style, files, enhanced: true }
      })
    );
    if (error) throw error;
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
