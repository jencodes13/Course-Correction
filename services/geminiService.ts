import { GoogleGenAI, Type, Modality } from "@google/genai";
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
  FindingsScanResult,
  GeneratedTheme,
  ThemeOption,
  VerificationResult,
  CourseSummaryResult,
} from "../types";
import { recordUsage } from "./usageTracker";
import { supabase } from "./supabaseClient";

// Optional rate-limit bypass for development/admin (set in .env.local, never in production build)
const bypassHeaders: Record<string, string> = {};
const bypassKey = import.meta.env.VITE_RATE_LIMIT_BYPASS_KEY;
if (bypassKey) {
  bypassHeaders['x-bypass-key'] = bypassKey;
}

// Gemini Client — only used as fallback in development when Edge Functions fail.
// In production builds, the key is never bundled; all calls go through Edge Functions.
const directApiKey = import.meta.env.DEV ? String(import.meta.env.VITE_GEMINI_API_KEY || '') : '';
let ai: GoogleGenAI;
try {
  ai = new GoogleGenAI({ apiKey: directApiKey || 'placeholder' });
} catch {
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
      supabase.functions.invoke('demo-slides', { body: { topic, location, style, fileData }, headers: bypassHeaders })
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
// 8. Sector Inference from Content (local keyword matching — no AI call)
// ============================================

const SECTOR_KEYWORDS: [string[], string, string[]][] = [
  [['aws', 'cloud', 'azure', 'gcp', 'ec2', 's3', 'lambda', 'kubernetes', 'docker', 'devops', 'saas', 'iaas', 'solutions architect', 'certified cloud'], 'Cloud Computing', ['AWS Solutions Architect', 'Cloud Infrastructure', 'DevOps']],
  [['cyber', 'security', 'penetration', 'firewall', 'encryption', 'soc', 'siem', 'malware', 'phishing', 'zero trust'], 'Cybersecurity', ['Network Security', 'Threat Analysis', 'Incident Response']],
  [['software', 'programming', 'javascript', 'python', 'react', 'api', 'database', 'frontend', 'backend', 'fullstack', 'agile', 'scrum'], 'Software Engineering', ['Software Development', 'Web Technologies', 'API Design']],
  [['data science', 'machine learning', 'artificial intelligence', 'deep learning', 'neural', 'nlp', 'analytics', 'big data', 'tensorflow', 'pytorch'], 'Data Science & AI', ['Machine Learning', 'Data Analytics', 'AI Models']],
  [['it ', 'information technology', 'networking', 'cisco', 'comptia', 'server', 'active directory', 'helpdesk', 'itil'], 'Information Technology', ['IT Infrastructure', 'Network Administration', 'Technical Support']],
  [['healthcare', 'hipaa', 'medical', 'clinical', 'patient', 'nursing', 'hospital', 'ehr', 'pharmaceutical', 'cpr', 'first aid'], 'Healthcare', ['Patient Safety', 'HIPAA Compliance', 'Clinical Procedures']],
  [['construction', 'osha', 'fall protection', 'scaffold', 'excavation', 'hard hat', 'building code', 'ppe', 'safety harness'], 'Construction', ['OSHA Standards', 'Safety Protocols', 'Building Codes']],
  [['manufacturing', 'lockout', 'tagout', 'machine guard', 'lean', 'six sigma', 'quality control', 'iso 9001'], 'Manufacturing', ['Safety Procedures', 'Quality Control', 'Lean Manufacturing']],
  [['food', 'servsafe', 'fda', 'haccp', 'allergen', 'sanitation', 'kitchen', 'food safety'], 'Food Service', ['Food Safety', 'FDA Regulations', 'Sanitation Protocols']],
  [['finance', 'banking', 'investment', 'accounting', 'audit', 'sox', 'aml', 'kyc', 'fintech', 'financial', 'cfp', 'certified financial', 'wealth management', 'retirement', 'estate planning', 'fiduciary', 'portfolio', 'securities', 'mutual fund', 'annuity', 'tax planning', 'financial planning', 'cfa', 'series 7', 'series 65', 'finra', 'sec ', 'broker', 'advisor'], 'Finance & Banking', ['Financial Compliance', 'Risk Management', 'Banking Regulations']],
  [['transport', 'logistics', 'dot', 'fmcsa', 'cdl', 'trucking', 'freight', 'shipping', 'supply chain'], 'Transportation & Logistics', ['DOT Compliance', 'Fleet Safety', 'Supply Chain']],
  [['aviation', 'faa', 'pilot', 'aircraft', 'airspace', 'flight', 'airline'], 'Aviation', ['FAA Regulations', 'Flight Safety', 'Aircraft Maintenance']],
  [['energy', 'utility', 'electric', 'power plant', 'solar', 'wind', 'oil', 'gas', 'pipeline', 'renewable'], 'Energy & Utilities', ['Energy Safety', 'Power Systems', 'Utility Compliance']],
  [['legal', 'compliance', 'regulation', 'law', 'governance', 'gdpr', 'privacy', 'attorney'], 'Legal & Compliance', ['Regulatory Framework', 'Compliance Standards', 'Legal Requirements']],
  [['insurance', 'underwriting', 'actuary', 'claims', 'policyholder', 'premium', 'deductible', 'liability insurance', 'risk assessment'], 'Insurance', ['Insurance Regulations', 'Risk Assessment', 'Claims Processing']],
  [['real estate', 'property', 'mortgage', 'realtor', 'housing', 'commercial property'], 'Real Estate', ['Property Management', 'Real Estate Law', 'Market Analysis']],
  [['education', 'teaching', 'curriculum', 'instructional design', 'elearning', 'lms', 'classroom', 'pedagogy'], 'Education & Training', ['Curriculum Development', 'Instructional Design', 'Learning Management']],
  [['hr', 'human resource', 'onboarding', 'recruitment', 'employee', 'workplace', 'talent'], 'Human Resources', ['Employee Relations', 'Recruitment', 'Workplace Policy']],
  [['telecom', 'wireless', '5g', 'network', 'fiber', 'broadband', 'mobile'], 'Telecommunications', ['Network Infrastructure', 'Wireless Technologies', 'Telecom Standards']],
  [['pharma', 'drug', 'fda approval', 'clinical trial', 'gmp', 'pharmacology', 'biotech', 'vaccine', 'dosage'], 'Pharmaceuticals', ['Drug Development', 'FDA Compliance', 'Clinical Trials']],
];

export const inferSectorFromContent = async (
  topic: string,
  files: IngestedFile[]
): Promise<InferredSector> => {
  // Build text from topic + filenames for keyword matching
  const fileContext = files.map(f => f.name).join(', ');
  const textToMatch = [topic, fileContext].filter(Boolean).join(' ').toLowerCase();

  let bestSector = '';
  let bestTopics: string[] = [];
  let bestScore = 0;
  for (const [keywords, sector, topics] of SECTOR_KEYWORDS) {
    const score = keywords.filter(kw => textToMatch.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestSector = sector;
      bestTopics = topics;
    }
  }

  if (bestScore >= 2) {
    return {
      sector: bestSector,
      confidence: bestScore >= 3 ? 'high' : 'medium',
      reasoning: `Matched ${bestScore} keyword${bestScore > 1 ? 's' : ''} for ${bestSector}.`,
      isAmbiguous: false,
      detectedTopics: bestTopics,
      alternatives: [],
    };
  }

  // Weak or no keyword match — use Gemini via edge function to read actual file content
  try {
    const { data, error } = await supabase.functions.invoke('demo-slides', {
      body: { inferSector: true, topic, files },
      headers: bypassHeaders,
    });
    if (!error && data?.sector) {
      return {
        sector: data.sector,
        confidence: data.confidence || 'medium',
        reasoning: data.reasoning || 'Identified by AI analysis of course content.',
        isAmbiguous: data.isAmbiguous ?? false,
        detectedTopics: data.detectedTopics || [],
        alternatives: data.alternatives || [],
      };
    }
  } catch (err) {
    console.warn('Edge function sector inference failed, using keyword fallback:', err);
  }

  // If keyword had a weak (1) match, use it rather than a blind default
  if (bestScore === 1) {
    return {
      sector: bestSector,
      confidence: 'low',
      reasoning: `Weak match (1 keyword) for ${bestSector}. Please verify.`,
      isAmbiguous: true,
      detectedTopics: bestTopics,
      alternatives: ['Finance & Banking', 'Healthcare', 'Construction', 'Information Technology'],
    };
  }

  // True fallback — no matches at all, don't assume IT
  return {
    sector: '',
    confidence: 'low',
    reasoning: 'Could not identify industry automatically.',
    isAmbiguous: true,
    alternatives: ['Finance & Banking', 'Healthcare', 'Construction', 'Information Technology', 'Cloud Computing']
  };
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
// Study Guide Generation (AI-powered)
// ============================================

export interface StudyGuideSection {
  title: string;
  summary: string;
  keyPoints: string[];
  takeaway: string;
}

export interface StudyGuideResult {
  sections: StudyGuideSection[];
}

export const generateStudyGuide = async (
  topic: string,
  sector: string,
  files: IngestedFile[]
): Promise<StudyGuideResult> => {
  const startTime = Date.now();

  const apiFiles = files
    .map(f => {
      if (f.storagePath) return { name: f.name, type: f.type, storagePath: f.storagePath };
      if (f.data && f.data.length <= 4 * 1024 * 1024) return f;
      return null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  try {
    console.log('[generateStudyGuide] Calling edge function with', { topic, sector, fileCount: apiFiles.length });
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: { topic, sector, files: apiFiles, action: 'generateStudyGuide' },
        headers: bypassHeaders,
      })
    );
    if (error) {
      console.error('[generateStudyGuide] Edge function error:', error);
      throw error;
    }
    console.log('[generateStudyGuide] Raw response data:', JSON.stringify(data).slice(0, 500));
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'generateStudyGuide (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
    return { sections: (data as any).sections || [] };
  } catch (err) {
    console.warn('[generateStudyGuide] Edge function failed, falling back to direct:', err);
    return generateStudyGuideDirect(topic, sector, files);
  }
};

// Study Guide — Direct API Fallback
async function generateStudyGuideDirect(
  topic: string,
  sector: string,
  files: IngestedFile[]
): Promise<StudyGuideResult> {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  try {
    const parts: any[] = [];
    const hasFiles = files.length > 0;

    files.forEach(file => {
      if (!file.data) return;
      const base64Data = file.data.split(',')[1] || file.data;
      parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
    });

    parts.push({
      text: `Create a comprehensive study guide ${hasFiles ? 'for this course material' : 'for a course on this topic'}.

<user_content>
Topic: "${topic}"
Industry: ${sector}
</user_content>

TASK: Generate 8-12 well-structured sections for a study guide ${hasFiles ? 'based on the uploaded course materials' : `about "${topic}" in the ${sector} sector. Use your knowledge of this subject to create educational content.`}.

For each section provide:
- title: A clear, descriptive heading for the section
- summary: One sentence describing what this section covers
- keyPoints: 3-5 key points, each a COMPLETE, SPECIFIC sentence that teaches something. Include specific facts, numbers, tools, processes, or concepts${hasFiles ? ' from the course' : ''}.
- takeaway: One sentence capturing the single most important concept from this section

CRITICAL CONSTRAINTS (follow exactly):
- Every key point MUST be a complete, meaningful sentence — NOT a keyword list, NOT a word dump
- ${hasFiles ? 'Extract REAL content, facts, and concepts from the uploaded documents' : 'Use accurate, current knowledge about this subject to create educational content'}
- Each key point should teach something specific and actionable
- Sections should follow a logical learning progression
- If the materials are about a certification, organize by exam domains/objectives
- If a section covers tools or services, name them specifically
- Do NOT generate generic filler like "Understanding the basics of cloud computing"
- DO generate specific content like "Amazon S3 provides 11 9s (99.999999999%) of data durability across multiple Availability Zones"`
    });

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user' as const, parts }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  takeaway: { type: Type.STRING },
                },
                required: ['title', 'summary', 'keyPoints', 'takeaway'],
              },
            },
          },
          required: ['sections'],
        },
        maxOutputTokens: 8192,
      },
    });

    trackUsage(response, model, 'generateStudyGuideDirect', startTime);
    const parsed = JSON.parse(response.text || '{}');
    return { sections: parsed.sections || [] };
  } catch (error) {
    console.error('[generateStudyGuideDirect] Failed:', error);
    return { sections: [] };
  }
}

// ============================================
// AI Slide Content Generation
// ============================================

export interface GeneratedSlide {
  title: string;
  subtitle?: string;
  bullets: string[];
  keyFact?: string;
  layoutSuggestion: string;
  sourceContext?: string;
  imageUrl?: string; // Infographic image URL (populated after generation)
}

export interface SlideContentResult {
  slides: GeneratedSlide[];
  dataVerification?: {
    totalSourcePages: number;
    pagesReferenced: number;
    coveragePercentage: number;
    missingTopics?: string[];
  };
  disclaimer?: string;
}

export const generateSlideContent = async (
  topic: string,
  sector: string,
  files: IngestedFile[],
  themePreferences?: { name: string; description: string },
): Promise<SlideContentResult> => {
  const startTime = Date.now();

  const apiFiles = files
    .map(f => {
      if (f.storagePath) return { name: f.name, type: f.type, storagePath: f.storagePath };
      if (f.data && f.data.length <= 4 * 1024 * 1024) return f;
      return null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  try {
    console.log('[generateSlideContent] Calling edge function with', { topic, sector, fileCount: apiFiles.length });
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: { topic, sector, files: apiFiles, action: 'generateSlideContent', themePreferences },
        headers: bypassHeaders,
      })
    );
    if (error) {
      console.error('[generateSlideContent] Edge function error:', error);
      throw error;
    }
    console.log('[generateSlideContent] Raw response data:', JSON.stringify(data).slice(0, 500));
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'generateSlideContent (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
    return {
      slides: (data as any).slides || [],
      dataVerification: (data as any).dataVerification,
      disclaimer: (data as any).disclaimer || undefined,
    };
  } catch (err) {
    console.warn('[generateSlideContent] Edge function failed, falling back to direct:', err);
    return generateSlideContentDirect(topic, sector, files, themePreferences);
  }
};

// Slide Content — Direct API Fallback
async function generateSlideContentDirect(
  topic: string,
  sector: string,
  files: IngestedFile[],
  themePreferences?: { name: string; description: string },
): Promise<SlideContentResult> {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  try {
    const parts: any[] = [];
    const hasFiles = files.length > 0;

    files.forEach(file => {
      if (!file.data) return;
      const base64Data = file.data.split(',')[1] || file.data;
      parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
    });

    parts.push({
      text: `Create a 10-15 slide presentation deck ${hasFiles ? 'from this course material' : 'for a course on this topic'}.

<user_content>
Topic: "${topic}"
Industry: ${sector}
</user_content>

TASK: Generate structured slide content. Each slide should have a clear purpose and contain specific, fact-rich content ${hasFiles ? 'extracted from the uploaded materials' : `about "${topic}" in the ${sector} sector`}.

For each slide provide:
- title: A clear, engaging slide title
- subtitle: Optional subtitle or section label
- bullets: 3-5 specific, fact-rich bullet points. Each must contain a concrete detail, number, process name, or technical term.
- keyFact: The single most important stat or fact on this slide (a number, percentage, or 2-4 word metric). Leave empty if no standout stat.
- layoutSuggestion: One of "hero" (for intro/impact slides), "two-column" (for comparisons), "stats-highlight" (for data-heavy), "comparison" (for before/after), "timeline" (for sequential processes)
- sourceContext: Brief note on what part of the source material this slide covers

After generating slides, provide dataVerification:
- totalSourcePages: Total pages in the uploaded material (estimate if not a PDF)
- pagesReferenced: How many source pages contributed to slides
- coveragePercentage: Percentage of source material covered (0-100)
- missingTopics: Important topics from the source that were NOT included in the slides

CRITICAL CONSTRAINTS (follow exactly):
- ${hasFiles ? 'Extract REAL content from the uploaded materials — do not invent facts' : 'Use accurate, current knowledge about this subject'}
- Every bullet must contain a specific fact, number, tool name, or technical detail — NOT generic statements
- Vary layoutSuggestion across slides — do not use the same layout for every slide
- First slide should use "hero" layout
- Include a mix of conceptual, technical, and applied content
- Do NOT generate generic filler like "Understanding the basics"
- DO generate specific content like "Amazon S3 provides 11 9s (99.999999999%) of data durability"
- If the source material contains a copyright notice, disclaimer, or distribution restriction, extract it verbatim into the disclaimer field`
    });

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user' as const, parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                  keyFact: { type: Type.STRING },
                  layoutSuggestion: { type: Type.STRING },
                  sourceContext: { type: Type.STRING },
                },
              },
            },
            dataVerification: {
              type: Type.OBJECT,
              properties: {
                totalSourcePages: { type: Type.NUMBER },
                pagesReferenced: { type: Type.NUMBER },
                coveragePercentage: { type: Type.NUMBER },
                missingTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            disclaimer: { type: Type.STRING },
          },
          required: ['slides'],
        },
        maxOutputTokens: 8192,
      },
    });

    trackUsage(response, model, 'generateSlideContentDirect', startTime);
    const parsed = JSON.parse(response.text || '{}');
    return {
      slides: parsed.slides || [],
      dataVerification: parsed.dataVerification,
      disclaimer: parsed.disclaimer || undefined,
    };
  } catch (error) {
    console.error('[generateSlideContentDirect] Failed:', error);
    return { slides: [] };
  }
}

// Quiz Questions — Direct API Fallback
async function generateQuizQuestionsDirect(
  topic: string,
  sector: string,
  files: IngestedFile[],
  studyGuideSections?: StudyGuideSection[]
): Promise<QuizResult> {
  const startTime = Date.now();
  const model = 'gemini-3-flash-preview';

  try {
    const parts: any[] = [];
    const hasFiles = files.length > 0;
    const hasStudyGuide = studyGuideSections && studyGuideSections.length > 0;

    files.forEach(file => {
      if (!file.data) return;
      const base64Data = file.data.split(',')[1] || file.data;
      parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
    });

    let studyGuideContext = '';
    if (hasStudyGuide) {
      studyGuideContext = '\n\nSTUDY GUIDE SECTIONS (generate questions covering these topics):\n' +
        studyGuideSections!.map((s, i) =>
          `${i + 1}. ${s.title}: ${s.keyPoints.join('; ')}`
        ).join('\n');
    }

    parts.push({
      text: `Create an exam-prep quiz ${hasFiles ? 'based on this course material' : 'for a course on this topic'}.

<user_content>
Topic: "${topic}"
Industry: ${sector}
</user_content>

TASK: ${hasStudyGuide ? 'Generate questions that test the key concepts from the study guide sections below.' : hasFiles ? 'Scan the course materials and identify the most important concepts, services, and facts that would appear on the certification exam or final assessment.' : `Create quiz questions about "${topic}" in the ${sector} sector based on common exam topics and key concepts.`} Generate 10-15 multiple-choice questions testing these high-value topics.
${studyGuideContext}

Every question must have:
- id: Sequential number starting at 1
- type: Always "multiple-choice"
- topic: A short label (2-4 words) identifying the specific subject area being tested (e.g. "AWS ECS", "VPC Networking", "IAM Policies", "S3 Storage Classes", "Fall Protection", "HIPAA Privacy Rule"). This appears as a tag on the question card.
- question: A clear, specific question
- options: Exactly 4 answer choices
- correctAnswer: Must EXACTLY match one of the 4 options
- explanation: 1-2 sentences explaining WHY this is correct and what makes the distractors wrong

CRITICAL CONSTRAINTS (follow exactly):
- Focus on what matters for the exam: key services, core concepts, common gotchas, best practices
- Questions should test real understanding, not just vocabulary recognition
- Distractors must be plausible — use real service names, real concepts, real numbers that are close but wrong
- Range from basic recall ("Which service does X?") to scenario-based application ("A company needs to... which solution?")
- topic labels should be specific: "EC2 Auto Scaling" not just "AWS", "OSHA 1910.134" not just "Safety"
- ${hasFiles ? 'Every question must relate directly to content in the uploaded course materials' : 'Every question must relate directly to key concepts and common exam topics for this subject'}
- Do NOT generate questions about tangential topics not covered in the ${hasFiles ? 'course' : 'subject area'}
- Explanations should teach — help the student understand the concept, not just confirm the answer
- Assign sequential id values starting at 1`
    });

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user' as const, parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  type: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['id', 'type', 'topic', 'question', 'options', 'correctAnswer', 'explanation'],
              },
            },
          },
          required: ['questions'],
        },
        maxOutputTokens: 8192,
      },
    });

    trackUsage(response, model, 'generateQuizQuestionsDirect', startTime);
    const parsed = JSON.parse(response.text || '{}');
    return { questions: parsed.questions || [] };
  } catch (error) {
    console.error('[generateQuizQuestionsDirect] Failed:', error);
    return { questions: [] };
  }
}

// ============================================
// Infographic Slide Selection (Gemini Reasoning)
// ============================================

export interface InfographicSelection {
  selectedSlideIndex: number;
  reasoning: string;
  imagePrompt: string;
}

export const selectInfographicSlide = async (
  slides: GeneratedSlide[],
  topic: string,
  sector: string,
): Promise<InfographicSelection> => {
  const startTime = Date.now();

  try {
    console.log('[selectInfographicSlide] Asking Gemini to pick best slide for infographic...');
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: {
          topic,
          sector,
          action: 'selectInfographicSlide',
          slides: slides.map(s => ({ title: s.title, bullets: s.bullets, keyFact: s.keyFact })),
        },
        headers: bypassHeaders,
      })
    );
    if (error) {
      console.error('[selectInfographicSlide] Edge function error:', error);
      throw error;
    }
    console.log('[selectInfographicSlide] Result:', data);
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'selectInfographicSlide (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
    return {
      selectedSlideIndex: (data as any).selectedSlideIndex ?? 2,
      reasoning: (data as any).reasoning || '',
      imagePrompt: (data as any).imagePrompt || `Create a clean, modern infographic about ${topic}`,
    };
  } catch (err) {
    console.error('[selectInfographicSlide] Failed:', err);
    // Fallback: pick slide index 2 (or 1 if fewer slides)
    return {
      selectedSlideIndex: Math.min(2, slides.length - 1),
      reasoning: 'Fallback selection',
      imagePrompt: `Create a clean, modern infographic about ${topic} in the ${sector} sector. Use a professional color scheme with clear labels and icons.`,
    };
  }
};

// ============================================
// Quiz Generation (AI-powered)
// ============================================

export interface QuizQuestion {
  id: number;
  type: 'multiple-choice';
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizResult {
  questions: QuizQuestion[];
}

export const generateQuizQuestions = async (
  topic: string,
  sector: string,
  files: IngestedFile[],
  studyGuideSections?: StudyGuideSection[]
): Promise<QuizResult> => {
  const startTime = Date.now();

  const apiFiles = files
    .map(f => {
      if (f.storagePath) return { name: f.name, type: f.type, storagePath: f.storagePath };
      if (f.data && f.data.length <= 4 * 1024 * 1024) return f;
      return null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  try {
    console.log('[generateQuizQuestions] Calling edge function with', { topic, sector, fileCount: apiFiles.length, hasStudyGuide: !!(studyGuideSections && studyGuideSections.length > 0) });
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: { topic, sector, files: apiFiles, action: 'generateQuiz', studyGuideSections },
        headers: bypassHeaders,
      })
    );
    if (error) {
      console.error('[generateQuizQuestions] Edge function error:', error);
      throw error;
    }
    console.log('[generateQuizQuestions] Raw response data:', JSON.stringify(data).slice(0, 500));
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'generateQuizQuestions (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
    return { questions: (data as any).questions || [] };
  } catch (err) {
    console.warn('[generateQuizQuestions] Edge function failed, falling back to direct:', err);
    return generateQuizQuestionsDirect(topic, sector, files, studyGuideSections);
  }
};

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
        body: { topic, sector, location, updateMode, files: scanFiles, action: 'scan' },
        headers: bypassHeaders,
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

Return 3-5 most impactful findings. Every claim must come from course materials or search results. Do not invent facts, dates, or statistics. If course creation date is unknown, say "undated". Focus on the course's primary subject — not tangential topics. At most 1 finding about exam structure changes (blueprint, format, passing score). The majority must be about actual course content — outdated facts, deprecated practices, or missing topics.

Set id to "finding-1", "finding-2", etc. category: "outdated"|"missing"|"compliance"|"structural". severity: "high"|"medium"|"low".`
  });

  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
      lastError = error;
      console.warn(`Direct scan attempt ${attempt}/${maxAttempts} failed:`, error);

      // Don't retry on 4xx client errors
      const status = (error as any)?.status || (error as any)?.httpStatusCode;
      if (status && status >= 400 && status < 500) break;

      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError;
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
      supabase.functions.invoke('demo-slides', { body, headers: bypassHeaders })
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
// 10. Theme Generation for Design Mode
// ============================================

export const generatePresentationTheme = async (
  questionnaire: {
    brandPersonality?: string;
    audience?: string;
    desiredFeeling?: string;
    primaryColor?: string;
  }
): Promise<GeneratedTheme> => {
  const startTime = Date.now();
  const fallbackTheme: GeneratedTheme = {
    primaryColor: '#2563eb',
    secondaryColor: '#60a5fa',
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
    mutedTextColor: '#94a3b8',
    fontSuggestion: 'Inter',
    layoutStyle: 'geometric',
    designReasoning: 'A clean, professional default palette.',
  };

  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: {
          topic: 'theme-generation',
          action: 'generateTheme',
          themeQuestionnaire: questionnaire,
        },
        headers: bypassHeaders,
      })
    );
    if (error) throw error;
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'generatePresentationTheme (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);

    return {
      primaryColor: (data as any).primaryColor || fallbackTheme.primaryColor,
      secondaryColor: (data as any).secondaryColor || fallbackTheme.secondaryColor,
      backgroundColor: (data as any).backgroundColor || fallbackTheme.backgroundColor,
      textColor: (data as any).textColor || fallbackTheme.textColor,
      mutedTextColor: (data as any).mutedTextColor || fallbackTheme.mutedTextColor,
      fontSuggestion: (data as any).fontSuggestion || fallbackTheme.fontSuggestion,
      layoutStyle: (data as any).layoutStyle || fallbackTheme.layoutStyle,
      designReasoning: (data as any).designReasoning || fallbackTheme.designReasoning,
    };
  } catch (err) {
    console.warn('Edge Function theme generation failed, using fallback:', err);
    return fallbackTheme;
  }
};

// ============================================
// 11. AI Theme Options Generation (6 diverse palettes)
// ============================================

const FALLBACK_THEME_OPTIONS: ThemeOption[] = [
  {
    name: 'Clean & Light',
    description: 'Airy and modern with warm white space and teal accents',
    backgroundColor: '#fafaf9', textColor: '#1c1917', primaryColor: '#0d9488',
    secondaryColor: '#5eead4', mutedTextColor: '#78716c', fontSuggestion: 'Inter', layoutStyle: 'minimal',
  },
  {
    name: 'Midnight Bold',
    description: 'High-contrast dark navy with bright amber highlights',
    backgroundColor: '#0f172a', textColor: '#f8fafc', primaryColor: '#f59e0b',
    secondaryColor: '#fbbf24', mutedTextColor: '#94a3b8', fontSuggestion: 'Space Grotesk', layoutStyle: 'bold',
  },
  {
    name: 'Warm Sunset',
    description: 'Inviting cream tones with warm red energy',
    backgroundColor: '#fef3c7', textColor: '#451a03', primaryColor: '#dc2626',
    secondaryColor: '#f97316', mutedTextColor: '#92400e', fontSuggestion: 'DM Sans', layoutStyle: 'organic',
  },
  {
    name: 'Ocean Professional',
    description: 'Deep blue authority with cool sky blue accents',
    backgroundColor: '#0c4a6e', textColor: '#e0f2fe', primaryColor: '#38bdf8',
    secondaryColor: '#7dd3fc', mutedTextColor: '#7dd3fc', fontSuggestion: 'IBM Plex Sans', layoutStyle: 'structured',
  },
  {
    name: 'Forest & Gold',
    description: 'Rich green prestige with gold accent flourishes',
    backgroundColor: '#14532d', textColor: '#f0fdf4', primaryColor: '#eab308',
    secondaryColor: '#a3e635', mutedTextColor: '#86efac', fontSuggestion: 'Playfair Display', layoutStyle: 'editorial',
  },
  {
    name: 'Neon Tech',
    description: 'Edgy dark zinc with vibrant purple glow',
    backgroundColor: '#18181b', textColor: '#e4e4e7', primaryColor: '#a855f7',
    secondaryColor: '#c084fc', mutedTextColor: '#71717a', fontSuggestion: 'Outfit', layoutStyle: 'geometric',
  },
];

export const generateThemeOptions = async (
  sector: string,
  contentSummary: string
): Promise<ThemeOption[]> => {
  const startTime = Date.now();

  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: {
          topic: contentSummary || 'course materials',
          sector,
          action: 'generateThemeOptions',
        },
        headers: bypassHeaders,
      })
    );
    if (error) throw error;

    const themes = (data as any)?.themes;
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'generateThemeOptions (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);

    if (Array.isArray(themes) && themes.length >= 4) {
      return themes.slice(0, 6).map((t: any) => ({
        name: t.name || 'Theme',
        description: t.description || '',
        backgroundColor: t.backgroundColor || '#ffffff',
        textColor: t.textColor || '#1e293b',
        primaryColor: t.primaryColor || '#2563eb',
        secondaryColor: t.secondaryColor || '#60a5fa',
        mutedTextColor: t.mutedTextColor || '#94a3b8',
        fontSuggestion: t.fontSuggestion || 'Inter',
        layoutStyle: t.layoutStyle || 'geometric',
      }));
    }
    throw new Error('Insufficient themes returned');
  } catch (err) {
    console.warn('Theme options generation failed, using fallbacks:', err);
    return FALLBACK_THEME_OPTIONS;
  }
};

// ============================================
// 12. Font Options Generation (Design Mode)
// ============================================

const FALLBACK_FONT_OPTIONS = ['Inter', 'Poppins', 'Space Grotesk', 'DM Sans', 'Playfair Display'];

export const generateFontOptions = async (
  sector: string,
  contentSummary: string,
  themeCharacter: string
): Promise<string[]> => {
  const startTime = Date.now();

  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: {
          topic: contentSummary || 'course materials',
          sector,
          action: 'generateFontOptions',
          themeCharacter,
        },
        headers: bypassHeaders,
      })
    );
    if (error) throw error;

    const fonts = (data as any)?.fonts;
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'generateFontOptions (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);

    if (Array.isArray(fonts) && fonts.length >= 3) {
      return fonts.slice(0, 5);
    }
    throw new Error('Insufficient fonts returned');
  } catch (err) {
    console.warn('Font options generation failed, using fallbacks:', err);
    return FALLBACK_FONT_OPTIONS;
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

// ============================================
// 13. Verify Findings (Search Grounding)
// ============================================

export const verifyFindings = async (
  approvedFindings: CourseFinding[],
  sector: string,
  location: string,
): Promise<VerificationResult> => {
  const startTime = Date.now();

  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: {
          topic: 'verification',
          sector,
          location,
          action: 'verify' as const,
          approvedFindings: approvedFindings.map(f => ({
            id: f.id,
            category: f.category,
            title: f.title,
            description: f.description,
            severity: f.severity,
            sourceSnippet: f.sourceSnippet,
            currentInfo: f.currentInfo,
          })),
        },
        headers: bypassHeaders,
      })
    );
    if (error) throw error;
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'verifyFindings (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
    return {
      findings: (data as any).findings || [],
      searchQueries: (data as any).searchQueries || [],
      verifiedAt: (data as any).verifiedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Verify findings failed:', err);
    return {
      findings: [],
      searchQueries: [],
      verifiedAt: new Date().toISOString(),
    };
  }
};

// ============================================
// 14. Generate Course Summary
// ============================================

export const generateCourseSummary = async (
  topic: string,
  sector: string,
  files: IngestedFile[],
): Promise<CourseSummaryResult> => {
  const startTime = Date.now();

  const apiFiles = files
    .map(f => {
      if (f.storagePath) return { name: f.name, type: f.type, storagePath: f.storagePath };
      if (f.data && f.data.length <= 4 * 1024 * 1024) return f;
      return null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('demo-slides', {
        body: {
          topic,
          sector,
          files: apiFiles,
          action: 'generateCourseSummary' as const,
        },
        headers: bypassHeaders,
      })
    );
    if (error) throw error;
    const usage = (data as any)?._usage;
    recordUsage('gemini-3-flash-preview', 'generateCourseSummary (edge)', usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, Date.now() - startTime);
    return {
      courseTitle: (data as any).courseTitle || topic || 'Unknown Course',
      learningObjectives: (data as any).learningObjectives || [],
      keyTopics: (data as any).keyTopics || [],
      difficulty: (data as any).difficulty || 'intermediate',
      estimatedDuration: (data as any).estimatedDuration || 'Unknown',
      moduleCount: (data as any).moduleCount || 0,
      summary: (data as any).summary || '',
    };
  } catch (err) {
    console.warn('Course summary generation failed:', err);
    return {
      courseTitle: topic || 'Unknown Course',
      learningObjectives: [],
      keyTopics: [],
      difficulty: 'intermediate',
      estimatedDuration: 'Unknown',
      moduleCount: 0,
      summary: 'Unable to generate course summary.',
    };
  }
};

// --- LIVE API CLIENT HELPER (Gemini 2.5 Native Audio) ---
export const connectLiveParams = {
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: 'You are an expert Instructional Designer consultant. Help the user plan their course updates.',
    }
};
