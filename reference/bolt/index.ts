import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ENHANCED: Two-part system prompt with clear differentiation
const BASE_SYSTEM_PROMPT = `You are an expert course designer specializing in modernizing educational content by integrating new knowledge into existing coursework.

YOUR ROLE:
You will receive TWO separate inputs:
1. EXISTING COURSEWORK: The original/outdated course materials
2. NEW KNOWLEDGE: Additional information, updates, or supplementary materials to integrate

YOUR MISSION:
- Analyze both the existing coursework and new knowledge separately
- Identify gaps, outdated information, and areas for enhancement in the existing course
- Strategically integrate the new knowledge into appropriate sections
- Preserve the original course structure and flow while enhancing it
- Clearly differentiate between preserved, updated, and newly added content

CRITICAL RULES:
- Do NOT replace good existing content unnecessarily
- Do NOT add information that isn't in either input
- Do NOT make assumptions about how to connect the materials
- DO identify where new knowledge fills gaps or updates outdated sections
- DO maintain the pedagogical structure of the original course
- DO indicate which sections are new, updated, or preserved`;

async function callGroqModel(
  systemPrompt: string,
  userMessage: string,
  responseFormat?: { type: string },
  temperature: number = 0.3
) {
  const groqApiKey = Deno.env.get("GROQ_API_KEY");

  if (!groqApiKey) {
    throw new Error("GROQ API key not configured");
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ];

  const params: Record<string, unknown> = {
    model: "qwen2.5-72b-instruct",
    messages: messages,
    temperature: temperature,
    max_tokens: 4000
  };

  if (responseFormat) {
    params.response_format = responseFormat;
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq API error:", errorText);
    throw new Error("AI service failed");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ENHANCED: Now analyzes both inputs and identifies gaps
async function analyzeStructure(existingCoursework: string, newKnowledge: string) {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

Your task: Perform a comprehensive analysis of both the existing coursework and new knowledge materials.

You must:
1. Extract the structure of the existing course (topics, objectives, concepts)
2. Identify what new topics/concepts are in the new knowledge materials
3. Perform gap analysis: what's missing or outdated in the existing course
4. Suggest integration strategy: where new knowledge should be added

Output detailed JSON with analysis of both inputs and integration recommendations.`;

  const userMessage = `Analyze these materials and provide a structured breakdown with integration strategy:

═══════════════════════════════════════
EXISTING COURSEWORK (What students currently have):
═══════════════════════════════════════
${existingCoursework.substring(0, 6000)}

═══════════════════════════════════════
NEW KNOWLEDGE MATERIALS (What should be added/integrated):
═══════════════════════════════════════
${newKnowledge.substring(0, 6000)}

Return a JSON object with:
{
  "existing_course_analysis": {
    "main_topics": ["list of current topics"],
    "learning_objectives": ["current objectives"],
    "key_concepts": ["concepts already covered"],
    "difficulty_level": "beginner|intermediate|advanced",
    "strengths": ["what works well in existing course"],
    "gaps": ["what's missing or outdated"]
  },
  "new_knowledge_analysis": {
    "new_topics": ["topics not in existing course"],
    "new_concepts": ["new concepts to introduce"],
    "updates_to_existing": ["topics that update existing content"],
    "supplementary_info": ["additional supporting information"]
  },
  "integration_strategy": {
    "sections_to_preserve": ["which parts of existing course are still good"],
    "sections_to_update": ["which parts need updating with new knowledge"],
    "sections_to_add": ["completely new sections to add"],
    "recommended_structure": ["suggested new outline with integrated content"]
  },
  "estimated_duration": "Updated hours to complete"
}`;

  const response = await callGroqModel(systemPrompt, userMessage, { type: "json_object" });
  return JSON.parse(response);
}

// ENHANCED: Now shows what's preserved, updated, and new
async function generatePdfContent(
  existingCoursework: string, 
  newKnowledge: string, 
  structure: Record<string, unknown>
) {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

Your task: Create an enhanced course document that intelligently integrates new knowledge into the existing coursework.

Requirements:
- Preserve good existing content (mark sections as [PRESERVED])
- Update outdated sections with new information (mark as [UPDATED])
- Add entirely new sections where needed (mark as [NEW])
- Maintain logical flow and structure
- Write clear, educational prose with proper transitions
- Include a "What's New" summary at the beginning

Format: Use clear section markers to show what changed.`;

  const userMessage = `Create an enhanced course document by intelligently integrating the new knowledge.

═══════════════════════════════════════
EXISTING COURSEWORK:
═══════════════════════════════════════
${existingCoursework}

═══════════════════════════════════════
NEW KNOWLEDGE TO INTEGRATE:
═══════════════════════════════════════
${newKnowledge}

═══════════════════════════════════════
ANALYSIS & INTEGRATION STRATEGY:
═══════════════════════════════════════
${JSON.stringify(structure, null, 2)}

Create a complete enhanced course document with:

1. WHAT'S NEW IN THIS VERSION
   - Summary of updates and additions
   - List of new topics added
   - List of sections updated

2. COURSE OVERVIEW
   - Enhanced learning objectives (combining old + new)
   - Prerequisites
   - Expected outcomes

3. MAIN CONTENT SECTIONS
   For each section, intelligently:
   - Preserve existing content that's still relevant
   - Update sections with new information where applicable
   - Add new sections for new topics
   - Mark each part as [PRESERVED], [UPDATED], or [NEW]

4. COURSE SUMMARY
   - Key takeaways from integrated content
   - Next steps for learners

5. ASSESSMENT GUIDELINES
   - Cover both existing and new material

Write in clear, engaging prose. Use section markers to show changes.`;

  return await callGroqModel(systemPrompt, userMessage, undefined, 0.4);
}

// ENHANCED: Quiz tests both old and new knowledge
async function generateQuiz(
  existingCoursework: string, 
  newKnowledge: string, 
  structure: Record<string, unknown>
) {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

Your task: Create a comprehensive quiz that tests understanding of BOTH the existing coursework AND the newly integrated knowledge.

Requirements:
- Include questions from the original course content
- Add questions specifically testing new knowledge
- Mark each question with a tag indicating if it tests [EXISTING], [NEW], or [INTEGRATED] knowledge
- Ensure balanced coverage across all topics
- Include a mix of difficulty levels
- Test understanding, not just memorization`;

  const userMessage = `Create a comprehensive quiz that tests both existing and new knowledge.

═══════════════════════════════════════
EXISTING COURSEWORK:
═══════════════════════════════════════
${existingCoursework}

═══════════════════════════════════════
NEW KNOWLEDGE:
═══════════════════════════════════════
${newKnowledge}

═══════════════════════════════════════
CONTENT ANALYSIS:
═══════════════════════════════════════
${JSON.stringify(structure, null, 2)}

Generate JSON with this structure:
{
  "quiz_title": "Course Assessment - Enhanced Edition",
  "total_questions": 20,
  "coverage": {
    "existing_content_questions": 8,
    "new_content_questions": 8,
    "integrated_questions": 4
  },
  "questions": [
    {
      "id": 1,
      "content_source": "existing|new|integrated",
      "type": "multiple_choice",
      "question": "Question text",
      "options": ["A) option", "B) option", "C) option", "D) option"],
      "correct_answer": "A",
      "explanation": "Why correct, referencing which material",
      "difficulty": "easy|medium|hard",
      "topic": "topic name"
    }
  ]
}

Create 20 questions:
- 8 testing existing course knowledge
- 8 testing new knowledge added
- 4 testing integrated understanding (requires both old + new)

Mix: 12 multiple choice, 5 true/false, 3 short answer`;

  const response = await callGroqModel(systemPrompt, userMessage, { type: "json_object" }, 0.2);
  return JSON.parse(response);
}

// ENHANCED: Slideshow highlights what's new
async function generateSlideshow(
  existingCoursework: string, 
  newKnowledge: string, 
  structure: Record<string, unknown>
) {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

Your task: Create a slideshow outline that presents the enhanced course, clearly highlighting new and updated content.

Requirements:
- Start with a "What's New" slide showing updates
- Use visual indicators for new vs. updated content
- Maintain flow from existing to new material
- Include slides that bridge old and new concepts
- Suggest visuals that illustrate new additions`;

  const userMessage = `Create a slideshow outline for the enhanced course.

═══════════════════════════════════════
EXISTING COURSEWORK:
═══════════════════════════════════════
${existingCoursework}

═══════════════════════════════════════
NEW KNOWLEDGE:
═══════════════════════════════════════
${newKnowledge}

═══════════════════════════════════════
INTEGRATION ANALYSIS:
═══════════════════════════════════════
${JSON.stringify(structure, null, 2)}

For each slide provide:
SLIDE [NUMBER]: [Title] [TAG: EXISTING|NEW|UPDATED]
- Content: [key points]
- Visual Suggestion: [diagram/chart/graphic description]
- Speaker Notes: [what to say, noting if content is new]
- Duration: [minutes]
- Transition Notes: [how this connects to previous slide]

Create 25-35 slides:
- Slide 1: Title
- Slide 2: "What's New in This Course"
- Slides 3-4: Enhanced Course Overview
- Main content slides (mark each as existing/new/updated)
- Bridge slides connecting old and new concepts
- Summary highlighting integrated knowledge`;

  return await callGroqModel(systemPrompt, userMessage, undefined, 0.4);
}

// ENHANCED: Video script with smooth integration narrative
async function generateVideoScript(
  existingCoursework: string, 
  newKnowledge: string, 
  structure: Record<string, unknown>
) {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

Your task: Write an engaging video script that presents the enhanced course with a natural narrative flow.

Requirements:
- Open by acknowledging this is an enhanced/updated version
- Smoothly transition between existing and new content
- Use phrases like "building on what we know..." when adding new knowledge
- Include [VISUAL] cues showing both old diagrams and new additions
- Create excitement about the new knowledge being added
- Natural, conversational tone that doesn't feel like two separate courses glued together`;

  const userMessage = `Write a video script for the enhanced course that smoothly integrates new knowledge.

═══════════════════════════════════════
EXISTING COURSEWORK:
═══════════════════════════════════════
${existingCoursework}

═══════════════════════════════════════
NEW KNOWLEDGE TO INTEGRATE:
═══════════════════════════════════════
${newKnowledge}

═══════════════════════════════════════
INTEGRATION STRATEGY:
═══════════════════════════════════════
${JSON.stringify(structure, null, 2)}

Script format:
[INTRO - 0:00-1:30]
[VISUAL: Show title card with "Enhanced Edition" badge]
Welcome back! If you've seen the previous version of this course, you're in for some exciting updates. We've integrated new knowledge that will deepen your understanding...

[SECTION 1: Topic Name - 1:30-5:00]
[VISUAL: Show familiar diagram, then zoom to highlight new elements]
Let's start with the fundamentals you may know... [existing content]
Now, here's where it gets interesting with our new insights... [new content]
See how these connect? [integration]

Include:
- Engaging intro acknowledging updates (1.5 min)
- Main content with smooth transitions (varying per section)
- "Building on this..." transitions when adding new knowledge
- Examples showing integration (1-2 min)
- Summary of original + new knowledge (2 min)
- Outro encouraging exploration of new topics (30 sec)

Write naturally, as if teaching a class that's getting exciting new material.`;

  return await callGroqModel(systemPrompt, userMessage, undefined, 0.5);
}

async function updateJobProgress(
  supabase: any,
  jobId: string,
  progress: number,
  message: string,
  status: string = "processing"
) {
  await supabase
    .from("transformation_jobs")
    .update({
      status,
      progress,
      message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

// ENHANCED: Now requires both inputs
async function transformCourseFull(
  supabase: any, 
  jobId: string, 
  existingCoursework: string,
  newKnowledge: string
) {
  try {
    await updateJobProgress(supabase, jobId, 15, "Analyzing existing coursework and new knowledge...");
    const structure = await analyzeStructure(existingCoursework, newKnowledge);

    await updateJobProgress(supabase, jobId, 35, "Generating enhanced PDF content...");
    const pdfContent = await generatePdfContent(existingCoursework, newKnowledge, structure);

    await updateJobProgress(supabase, jobId, 55, "Creating comprehensive quiz...");
    const quiz = await generateQuiz(existingCoursework, newKnowledge, structure);

    await updateJobProgress(supabase, jobId, 75, "Building enhanced slideshow...");
    const slideshowOutline = await generateSlideshow(existingCoursework, newKnowledge, structure);

    await updateJobProgress(supabase, jobId, 90, "Writing integrated video script...");
    const videoScript = await generateVideoScript(existingCoursework, newKnowledge, structure);

    const outputs = {
      pdf_content: pdfContent,
      quiz: quiz,
      slideshow_outline: slideshowOutline,
      video_script: videoScript,
      structure: structure,
      change_summary: {
        sections_preserved: structure.integration_strategy?.sections_to_preserve || [],
        sections_updated: structure.integration_strategy?.sections_to_update || [],
        sections_added: structure.integration_strategy?.sections_to_add || [],
      }
    };

    await supabase
      .from("generated_content")
      .upsert({
        project_id: (await supabase.from("transformation_jobs").select("project_id").eq("id", jobId).single()).data?.project_id,
        slides_data: outputs,
        generated_at: new Date().toISOString(),
      });

    await supabase
      .from("transformation_jobs")
      .update({
        status: "completed",
        progress: 100,
        message: "Transformation complete!",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return outputs;
  } catch (error) {
    console.error("Transformation error:", error);
    await supabase
      .from("transformation_jobs")
      .update({
        status: "failed",
        error: error.message || "Transformation failed",
        message: `Error: ${error.message}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    throw error;
  }
}

const FILE_SIZE_LIMITS = {
  free: 50 * 1024 * 1024,
  premium: 500 * 1024 * 1024,
};

const CONTENT_LENGTH_LIMITS = {
  free: 100000,
  premium: 1000000,
};

async function getUserTier(supabase: any, projectId: string | null): Promise<'free' | 'premium'> {
  if (!projectId) {
    return 'free';
  }

  const { data } = await supabase
    .from('projects')
    .select('user_tier')
    .eq('id', projectId)
    .maybeSingle();

  return data?.user_tier || 'free';
}

// ENHANCED: Now handles two separate file inputs
async function processFileUpload(formData: FormData, supabase: any, fileKey: string) {
  const file = formData.get(fileKey) as File;
  const projectId = formData.get("project_id") as string | null;

  if (!file) {
    return null; // Allow missing files for optional new_knowledge
  }

  const userTier = await getUserTier(supabase, projectId);
  const maxFileSize = FILE_SIZE_LIMITS[userTier];
  const maxContentLength = CONTENT_LENGTH_LIMITS[userTier];

  if (file.size > maxFileSize) {
    const maxSizeMB = Math.floor(maxFileSize / (1024 * 1024));
    if (userTier === 'free') {
      throw new Error(`File size exceeds free tier limit of ${maxSizeMB}MB. Upgrade to premium for up to 500MB files.`);
    } else {
      throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let extractedText = "";

  if (file.type === "text/plain") {
    const decoder = new TextDecoder();
    extractedText = decoder.decode(uint8Array);
  } else if (file.type === "application/pdf") {
    extractedText = `[PDF Content from ${file.name}]\n\nThis is placeholder text extraction. In production, implement PDF parsing using a library like pdf-parse.`;
  } else if (file.type.includes("word") || file.name.endsWith(".docx")) {
    extractedText = `[Word Document Content from ${file.name}]\n\nThis is placeholder text extraction.`;
  } else if (file.type.includes("presentation") || file.name.endsWith(".pptx") || file.name.endsWith(".ppt")) {
    extractedText = `[Presentation Content from ${file.name}]\n\nThis is placeholder text extraction.`;
  } else {
    extractedText = `[${file.type} file: ${file.name}]\n\nUnsupported file type for text extraction.`;
  }

  if (extractedText.length < 50) {
    throw new Error(`Content from ${file.name} too short (minimum 50 characters)`);
  }

  if (extractedText.length > maxContentLength) {
    const maxLengthK = Math.floor(maxContentLength / 1000);
    if (userTier === 'free') {
      throw new Error(`Content from ${file.name} too long (maximum ${maxLengthK}k characters for free tier). Upgrade to premium.`);
    } else {
      throw new Error(`Content from ${file.name} too long (maximum ${maxLengthK}k characters)`);
    }
  }

  return {
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    extracted_text: extractedText,
    extracted_length: extractedText.length,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (path === "/api/health" || path === "/api") {
      return new Response(
        JSON.stringify({ 
          status: "healthy", 
          message: "Enhanced Course Transformer API - Dual Input Version", 
          timestamp: new Date().toISOString(),
          features: ["dual_input", "gap_analysis", "change_tracking"]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ENHANCED: New endpoint for dual-input upload
    if (path === "/api/upload-dual" && req.method === "POST") {
      const formData = await req.formData();
      
      const existingFile = await processFileUpload(formData, supabase, "existing_coursework");
      const newFile = await processFileUpload(formData, supabase, "new_knowledge");

      if (!existingFile) {
        throw new Error("Existing coursework file is required");
      }

      return new Response(JSON.stringify({
        existing_coursework: existingFile,
        new_knowledge: newFile || { message: "No new knowledge file provided" }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ENHANCED: Transform endpoint now expects two inputs
    if (path === "/api/transform" && req.method === "POST") {
      const formData = await req.formData();
      
      const existingFile = await processFileUpload(formData, supabase, "existing_coursework");
      const newFile = await processFileUpload(formData, supabase, "new_knowledge");

      if (!existingFile) {
        throw new Error("Existing coursework file is required");
      }

      const projectId = formData.get("project_id") as string | null;

      const { data: job, error: jobError } = await supabase
        .from("transformation_jobs")
        .insert({
          project_id: projectId,
          status: "processing",
          progress: 0,
          message: "Starting enhanced transformation...",
          filename: existingFile.file_name,
          course_materials: existingFile.extracted_text,
          new_knowledge_materials: newFile?.extracted_text || "",
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Pass both inputs to transformation
      transformCourseFull(
        supabase, 
        job.id, 
        existingFile.extracted_text,
        newFile?.extracted_text || ""
      );

      return new Response(
        JSON.stringify({ 
          job_id: job.id, 
          message: "Enhanced transformation started",
          inputs: {
            existing_coursework: existingFile.file_name,
            new_knowledge: newFile?.file_name || "none"
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/api/status/") && req.method === "GET") {
      const jobId = path.split("/").pop();
      const { data: job, error } = await supabase
        .from("transformation_jobs")
        .select("id, status, progress, message, created_at, completed_at, error")
        .eq("id", jobId)
        .maybeSingle();

      if (error || !job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(job), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith("/api/result/") && req.method === "GET") {
      const jobId = path.split("/").pop();
      const { data: job, error: jobError } = await supabase
        .from("transformation_jobs")
        .select("*, project_id")
        .eq("id", jobId)
        .maybeSingle();

      if (jobError || !job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (job.status !== "completed") {
        return new Response(
          JSON.stringify({ error: `Job not completed. Status: ${job.status}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: content } = await supabase
        .from("generated_content")
        .select("slides_data")
        .eq("project_id", job.project_id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({ 
          job_id: jobId, 
          outputs: content?.slides_data, 
          completed_at: job.completed_at 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ENHANCED: Analyze endpoint with dual input
    if (path === "/api/course/analyze" && req.method === "POST") {
      const { existing_coursework, new_knowledge } = await req.json();
      const structure = await analyzeStructure(
        existing_coursework, 
        new_knowledge || ""
      );

      return new Response(
        JSON.stringify({ structure }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ENHANCED: Transform endpoint with dual input
    if (path === "/api/course/transform" && req.method === "POST") {
      const { existing_coursework, new_knowledge, project_id } = await req.json();

      if (!existing_coursework) {
        throw new Error("existing_coursework is required");
      }

      const { data: job, error: jobError } = await supabase
        .from("transformation_jobs")
        .insert({
          project_id: project_id,
          status: "processing",
          progress: 0,
          message: "Starting enhanced transformation...",
          filename: "direct-input.txt",
          course_materials: existing_coursework,
          new_knowledge_materials: new_knowledge || "",
        })
        .select()
        .single();

      if (jobError) throw jobError;

      transformCourseFull(supabase, job.id, existing_coursework, new_knowledge || "");

      return new Response(
        JSON.stringify({ 
          success: true, 
          job_id: job.id, 
          message: "Enhanced transformation started" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path === "/api/project/create" && req.method === "POST") {
      const { user_id, name } = await req.json();
      const { data, error } = await supabase
        .from("projects")
        .insert({ user_id, name, status: "draft" })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith("/api/project/") && path.endsWith("/files") && req.method === "GET") {
      const projectId = path.split("/")[3];
      const { data, error } = await supabase
        .from("uploaded_files")
        .select("*")
        .eq("project_id", projectId);

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith("/api/project/") && req.method === "GET") {
      const projectId = path.split("/")[3];
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/api/preferences/save" && req.method === "POST") {
      const { project_id, theme_selection, emphasis_topics, exclude_topics, custom_instructions } = await req.json();

      const { data, error } = await supabase
        .from("user_preferences")
        .upsert({
          project_id,
          theme_selection: theme_selection || "",
          emphasis_topics: emphasis_topics || [],
          exclude_topics: exclude_topics || [],
          custom_instructions: custom_instructions || "",
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});