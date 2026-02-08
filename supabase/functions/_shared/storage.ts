// Shared storage utilities for Edge Functions
// Downloads files from Supabase Storage using the service role key

import { getSupabaseClient } from "./auth.ts";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

/**
 * Download a file from Supabase Storage using the service role key.
 */
export async function downloadFromStorage(
  bucket: string,
  storagePath: string
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const supabase = getSupabaseClient(); // service role — bypasses RLS

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(storagePath);

  if (error) {
    throw new Error(`Storage download failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`No data returned for ${storagePath}`);
  }

  const bytes = new Uint8Array(await data.arrayBuffer());

  // Infer MIME type from extension
  const ext = storagePath.split(".").pop()?.toLowerCase() || "";
  const mimeType = MIME_MAP[ext] || "application/octet-stream";

  return { bytes, mimeType };
}
