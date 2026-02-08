// Supabase Client for CourseCorrect
// Handles authentication, database operations, and storage

import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase credentials not configured. Backend features will be unavailable.");
}

// Create the Supabase client
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder"
);

// ============================================
// AUTHENTICATION
// ============================================

export async function signUp(email: string, password: string, fullName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
}

// ============================================
// PROJECTS
// ============================================

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  goal: "regulatory" | "visual" | "full";
  target_audience?: string;
  standards_context?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  status: "draft" | "analyzing" | "reviewed" | "exported";
  created_at: string;
  updated_at: string;
}

export async function createProject(project: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }
  return data;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ============================================
// FILE UPLOADS
// ============================================

export interface UploadedFile {
  id: string;
  project_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  raw_content?: string;
  created_at: string;
}

export async function uploadFile(
  projectId: string,
  file: File,
  rawContent?: string
): Promise<UploadedFile> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // Generate storage path
  const ext = file.name.split(".").pop();
  const storagePath = `${user.id}/${projectId}/${crypto.randomUUID()}.${ext}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("course-files")
    .upload(storagePath, file);

  if (uploadError) throw uploadError;

  // Save metadata to database
  const { data, error } = await supabase
    .from("uploaded_files")
    .insert({
      project_id: projectId,
      name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
      raw_content: rawContent,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProjectFiles(projectId: string): Promise<UploadedFile[]> {
  const { data, error } = await supabase
    .from("uploaded_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getFileUrl(storagePath: string): Promise<string> {
  const { data } = supabase.storage
    .from("course-files")
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

export async function deleteFile(id: string, storagePath: string): Promise<void> {
  // Delete from storage
  await supabase.storage.from("course-files").remove([storagePath]);

  // Delete from database
  const { error } = await supabase
    .from("uploaded_files")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ============================================
// SMART FILE UPLOAD — routes small files inline, large files to storage
// ============================================

import type { IngestedFile } from "../types";

const INLINE_SIZE_THRESHOLD = 4 * 1024 * 1024; // 4MB — below this, use base64 inline

/**
 * Upload a file to Supabase Storage for the demo flow (no auth required).
 * Uses the anon key with the `demo/` path prefix.
 * Returns the storage path for later retrieval by Edge Functions.
 */
export async function uploadDemoFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ storagePath: string; sizeBytes: number }> {
  const sessionId = crypto.randomUUID().slice(0, 8);
  const ext = file.name.split(".").pop() || "bin";
  const storagePath = `demo/${sessionId}/${crypto.randomUUID()}.${ext}`;

  // Use XHR for progress tracking (Supabase SDK doesn't expose upload progress)
  const storageUrl = `${SUPABASE_URL}/storage/v1/object/course-files/${storagePath}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", storageUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ storagePath, sizeBytes: file.size });
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(file);
  });
}

/**
 * Process a file for the demo upload pipeline.
 * - Small files (< 4MB): read as base64 data URL (inline, fast)
 * - Large files (>= 4MB): upload to Supabase Storage, return storage path
 */
export async function processFileForUpload(
  file: File,
  onProgress?: (progress: number) => void
): Promise<IngestedFile> {
  // Small files: read as base64 inline (faster, no storage round-trip)
  if (file.size <= INLINE_SIZE_THRESHOLD) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      reader.onload = (e) => {
        onProgress?.(100);
        resolve({
          name: file.name,
          type: file.type,
          data: e.target?.result as string,
          sizeBytes: file.size,
        });
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  }

  // Large files: upload to Supabase Storage
  const { storagePath, sizeBytes } = await uploadDemoFile(file, onProgress);
  return { name: file.name, type: file.type, storagePath, sizeBytes };
}

// ============================================
// ANALYSES
// ============================================

export interface Analysis {
  id: string;
  project_id: string;
  freshness_score: number;
  engagement_score: number;
  freshness_issues: Array<{
    description: string;
    severity: "low" | "medium" | "high";
    location?: string;
  }>;
  engagement_issues: Array<{
    description: string;
    severity: "low" | "medium" | "high";
    location?: string;
  }>;
  summary: string;
  model_used: string;
  created_at: string;
}

export async function saveAnalysis(analysis: Omit<Analysis, "id" | "created_at">): Promise<Analysis> {
  const { data, error } = await supabase
    .from("analyses")
    .insert(analysis)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProjectAnalysis(projectId: string): Promise<Analysis | null> {
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

// ============================================
// REGULATORY UPDATES
// ============================================

export interface RegulatoryUpdate {
  id: string;
  project_id: string;
  original_text: string;
  updated_text: string;
  citation?: string;
  reason?: string;
  source_url?: string;
  status: "pending" | "accepted" | "rejected";
  section_id?: string;
  created_at: string;
  reviewed_at?: string;
}

export async function saveRegulatoryUpdates(
  projectId: string,
  updates: Array<Omit<RegulatoryUpdate, "id" | "project_id" | "created_at" | "reviewed_at">>
): Promise<RegulatoryUpdate[]> {
  const { data, error } = await supabase
    .from("regulatory_updates")
    .insert(updates.map((u) => ({ ...u, project_id: projectId })))
    .select();

  if (error) throw error;
  return data || [];
}

export async function getProjectRegulatoryUpdates(projectId: string): Promise<RegulatoryUpdate[]> {
  const { data, error } = await supabase
    .from("regulatory_updates")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateRegulatoryStatus(
  id: string,
  status: "accepted" | "rejected"
): Promise<void> {
  const { error } = await supabase
    .from("regulatory_updates")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// ============================================
// VISUAL TRANSFORMATIONS
// ============================================

export interface VisualTransformation {
  id: string;
  project_id: string;
  section_id?: string;
  original_type: string;
  suggested_type: string;
  visual_description: string;
  image_prompt?: string;
  generated_image_path?: string;
  content: object;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  reviewed_at?: string;
}

export async function saveVisualTransformations(
  projectId: string,
  transformations: Array<Omit<VisualTransformation, "id" | "project_id" | "created_at" | "reviewed_at">>
): Promise<VisualTransformation[]> {
  const { data, error } = await supabase
    .from("visual_transformations")
    .insert(transformations.map((t) => ({ ...t, project_id: projectId })))
    .select();

  if (error) throw error;
  return data || [];
}

export async function getProjectVisualTransformations(projectId: string): Promise<VisualTransformation[]> {
  const { data, error } = await supabase
    .from("visual_transformations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateVisualTransformationStatus(
  id: string,
  status: "accepted" | "rejected"
): Promise<void> {
  const { error } = await supabase
    .from("visual_transformations")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// ============================================
// EXPORTS
// ============================================

export interface Export {
  id: string;
  project_id: string;
  format: "scorm_1.2" | "scorm_2004" | "xapi";
  storage_path?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export async function createExport(projectId: string, format: Export["format"]): Promise<Export> {
  const { data, error } = await supabase
    .from("exports")
    .insert({ project_id: projectId, format })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProjectExports(projectId: string): Promise<Export[]> {
  const { data, error } = await supabase
    .from("exports")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getExportDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("exports")
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
}

// ============================================
// EDGE FUNCTION CALLS
// ============================================

async function callEdgeFunction<T>(
  functionName: string,
  body: object
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    body,
  });

  if (error) throw error;
  return data as T;
}

export async function analyzeContent(
  text?: string,
  files?: Array<{ name: string; type: string; data: string }>,
  config?: {
    goal?: string;
    targetAudience?: string;
    standardsContext?: string;
    location?: string;
  }
) {
  return callEdgeFunction<Analysis>("analyze-course", { text, files, config });
}

export async function getRegulatoryUpdates(
  content: string,
  domainContext?: string,
  location?: string
) {
  return callEdgeFunction<{ updates: RegulatoryUpdate[] }>("regulatory-update", {
    content,
    domainContext,
    location,
  });
}

export async function getVisualTransformations(content: string, theme?: string) {
  return callEdgeFunction<{ transformations: VisualTransformation[] }>(
    "visual-transform",
    { content, theme }
  );
}

export async function generateAsset(
  prompt: string,
  baseImage?: string,
  projectId?: string,
  transformationId?: string
) {
  return callEdgeFunction<{ imageUrl: string; storagePath?: string }>(
    "generate-asset",
    { prompt, baseImage, projectId, transformationId }
  );
}
