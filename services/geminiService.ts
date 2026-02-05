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
 * 1. Multimodal Analysis (Text + Images + Video)
 * Uses gemini-3-pro-preview for deep understanding of complex inputs.
 */
export const analyzeCourseContent = async (text: string, files: IngestedFile[], config: ProjectConfig): Promise<AnalysisMetrics> => {
  const startTime = Date.now();
  const model = 'gemini-3-pro-preview';

  try {
    const parts: any[] = [];

    // Add Text
    if (text) parts.push({ text: `Course Text Content: ${text}` });

    // Add Files (Images/Video)
    files.forEach(file => {
      // Remove data URL prefix for API
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

    // gemini-3-pro-preview is required for Video Understanding and Complex Image Analysis
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
};

/**
 * 2. Maps Grounding (Authority Identification)
 * Uses gemini-2.5-flash to find the correct local authority.
 */
export const identifyLocalAuthority = async (location: string): Promise<string> => {
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

    // Extract text directly, maps grounding chunks are usually appended or referenced
    return response.text || location;
  } catch (e) {
    console.error("Maps Grounding Error", e);
    return location;
  }
};

/**
 * 3. Search Grounding (Regulatory Update)
 * Uses gemini-3-flash-preview with Google Search to get live facts.
 */
export const performRegulatoryUpdate = async (content: string, domainContext: string, location: string): Promise<RegulatoryUpdate[]> => {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  try {
    // First, try to get local context if a location is provided
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

    // Clean up response text to find JSON
    const text = response.text || "[]";
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as RegulatoryUpdate[];
    }

    // Fallback if search results break JSON structure
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
};

/**
 * 4. Image Generation / Editing
 * Uses gemini-2.5-flash-image (Nano Banana).
 */
export const generateAsset = async (prompt: string, base64Image?: string): Promise<string | null> => {
    const startTime = Date.now();
    const model = 'gemini-2.5-flash-image';

    try {
        const parts: any[] = [];

        // If editing an existing image
        if (base64Image) {
            parts.push({
                inlineData: {
                    mimeType: "image/png",
                    data: base64Image.split(',')[1]
                }
            });
            parts.push({ text: `Edit this image: ${prompt}` });
        } else {
            // If generating from scratch
            parts.push({ text: `Generate an image: ${prompt}` });
        }

        const response = await ai.models.generateContent({
            model,
            contents: { parts },
        });

        trackUsage(response, model, 'generateAsset', startTime);

        // Extract image from response
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
};

/**
 * Visual Analysis
 */
export const performVisualTransformation = async (content: string, theme: string): Promise<VisualTransformation[]> => {
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
};

/**
 * 5. Demo Slide Generation
 * Generates 3 initial slides for the free trial flow.
 */
export const generateDemoSlides = async (topic: string, location: string, style: string, fileData?: string): Promise<DemoSlide[]> => {
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
      // Fallback
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
};

/**
 * 6. Landing Page Use Case Generator
 * Generates creative use cases for the infinite grid.
 * Uses gemini-3-flash-preview for low latency.
 */
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

/**
 * 7. Sector Inference from Content
 * Analyzes uploaded files and/or topic to determine the industry sector.
 * Returns confidence level and flags ambiguity if multiple sectors detected.
 */
export const inferSectorFromContent = async (
  topic: string,
  files: IngestedFile[]
): Promise<InferredSector> => {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  try {
    const parts: any[] = [];

    // Add files for analysis
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

/**
 * 8. Enhanced Demo Slide Generation with Search Grounding
 * Generates before/after slides with real regulatory citations from Google Search.
 */
export const generateDemoSlidesEnhanced = async (
  topic: string,
  sector: string,
  location: string,
  updateMode: UpdateMode,
  style: string,
  files: IngestedFile[]
): Promise<DemoResult> => {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  try {
    const parts: any[] = [];

    // Add files for context
    files.forEach(file => {
      const base64Data = file.data.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: base64Data
        }
      });
    });

    // Build context-aware prompt based on update mode
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

    // Use search grounding to get real regulatory data
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    trackUsage(response, model, 'generateDemoSlidesEnhanced', startTime);

    // Extract grounding metadata for citations
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const citations: Citation[] = [];

    if (groundingMetadata?.groundingChunks) {
      groundingMetadata.groundingChunks.forEach((chunk: any, idx: number) => {
        if (chunk.web) {
          citations.push({
            id: idx + 1,
            title: chunk.web.title || `Source ${idx + 1}`,
            url: chunk.web.uri || '',
            snippet: '', // Extracted from groundingSupports if available
            accessedDate: new Date().toISOString().split('T')[0]
          });
        }
      });
    }

    // Extract search queries used
    const searchQueries = groundingMetadata?.webSearchQueries || [];

    // Parse the response text into structured slides
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
    // Return fallback with placeholder content
    return createFallbackDemoResult(topic, sector, location, updateMode, style);
  }
};

/**
 * Helper: Parse free-form response into structured slides
 */
function parseResponseToSlides(text: string, style: string): DemoSlideEnhanced[] {
  // Try to extract structured content from the response
  // The response may be semi-structured text, so we parse intelligently

  const slides: DemoSlideEnhanced[] = [];
  const slideRegex = /(?:slide\s*\d+|#{1,3}\s*slide)/gi;
  const sections = text.split(slideRegex).filter(s => s.trim());

  // If we can't parse, create structured placeholders
  if (sections.length < 3) {
    // Fall back to creating 3 slides from the full text
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
  // Extract before/after content using common patterns
  const beforeMatch = text.match(/(?:before|original|outdated|old)[:\s]*([\s\S]*?)(?:after|updated|new|current|$)/i);
  const afterMatch = text.match(/(?:after|updated|new|current)[:\s]*([\s\S]*?)(?:before|$)/i);

  // Extract bullet points
  const extractBullets = (content: string): string[] => {
    const bullets = content.match(/[-•*]\s*([^\n]+)/g) || [];
    if (bullets.length > 0) {
      return bullets.map(b => b.replace(/^[-•*]\s*/, '').trim()).slice(0, 4);
    }
    // Fall back to sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 4).map(s => s.trim());
  };

  // Extract citations from text [1], [2], etc.
  const citationMatches = text.match(/\[(\d+)\]/g) || [];
  const citationIds = [...new Set(citationMatches.map(m => parseInt(m.replace(/[\[\]]/g, ''))))];

  const beforeContent = beforeMatch?.[1] || text.slice(0, text.length / 2);
  const afterContent = afterMatch?.[1] || text.slice(text.length / 2);

  // Generate title from content
  const titleMatch = text.match(/(?:^|\n)#+\s*([^\n]+)|(?:title|topic)[:\s]*([^\n]+)/i);
  const title = titleMatch?.[1] || titleMatch?.[2] || `Section ${index + 1}`;

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
// We export the connect method to be used in the component
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
