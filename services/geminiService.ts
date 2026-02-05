import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisMetrics, RegulatoryUpdate, VisualTransformation, ProjectConfig, IngestedFile, DemoSlide, GeneratedUseCase } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * 1. Multimodal Analysis (Text + Images + Video)
 * Uses gemini-3-pro-preview for deep understanding of complex inputs.
 */
export const analyzeCourseContent = async (text: string, files: IngestedFile[], config: ProjectConfig): Promise<AnalysisMetrics> => {
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
      model: 'gemini-3-pro-preview',
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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `What is the specific government body or code authority responsible for professional training regulations in ${location}?`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });
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
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // responseMimeType: "application/json" is often incompatible with tools in some preview models depending on the strictness,
        // but let's try to instruct structured output via text if schema fails with tools.
        // For safety with Search Grounding, we will parse the text manually or ask for JSON string.
      }
    });

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
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            // config: { responseMimeType: "image/png" } // Not strictly needed, we look for inlineData
        });

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
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
        // Guess mime type from header or just assume PDF/Image for now as generic data
        // For simplicity in this demo function, let's treat it as text extraction or image depending on prefix
        // But for Gemini API, we pass inlineData.
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
        model: 'gemini-3-flash-preview', // Good balance of speed and reasoning for this demo
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
 *
 * @param batchSize - Number of use cases to generate (default 8)
 * @returns Array of GeneratedUseCase objects
 */
export const generateCreativeUseCases = async (batchSize: number = 8): Promise<GeneratedUseCase[]> => {
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
            model: 'gemini-3-flash-preview',
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

        return JSON.parse(response.text || "[]") as GeneratedUseCase[];
    } catch (e) {
        console.error("Use Case Gen Error", e);
        return [];
    }
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