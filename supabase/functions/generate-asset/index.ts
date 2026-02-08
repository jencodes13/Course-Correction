// Edge Function: Generate Asset
// Uses Gemini 2.5 Flash Image for AI image generation

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth, trackApiUsage, getSupabaseClient } from "../_shared/auth.ts";
import { generateImage } from "../_shared/gemini.ts";

interface AssetRequest {
  prompt: string;
  baseImage?: string; // Optional base64 image for editing
  projectId?: string; // Optional project to associate with
  transformationId?: string; // Optional transformation to link
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Require authentication
    const auth = await requireAuth(req);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body: AssetRequest = await req.json();

    if (!body.prompt) {
      return errorResponse("Prompt is required", 400);
    }

    // Generate the image
    const imageDataUrl = await generateImage(body.prompt, body.baseImage);

    // Track API usage
    await trackApiUsage(auth.userId, "generate-asset", "gemini-2.5-flash-image");

    // If projectId is provided, save to storage and database
    if (body.projectId) {
      const supabase = getSupabaseClient();

      // Convert data URL to blob
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      // Generate unique filename
      const filename = `${auth.userId}/${body.projectId}/${crypto.randomUUID()}.png`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("generated-assets")
        .upload(filename, binaryData, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        // Still return the image even if storage fails
        return jsonResponse({ imageUrl: imageDataUrl });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("generated-assets")
        .getPublicUrl(filename);

      // Save to database
      await supabase.from("generated_assets").insert({
        project_id: body.projectId,
        transformation_id: body.transformationId,
        prompt: body.prompt,
        storage_path: filename,
        model_used: "gemini-2.5-flash-image",
      });

      return jsonResponse({
        imageUrl: publicUrl,
        storagePath: filename,
      });
    }

    // Return just the data URL if no project
    return jsonResponse({ imageUrl: imageDataUrl });

  } catch (error) {
    console.error("Asset generation error:", error);
    return errorResponse("Asset generation failed. Please try again.", 500);
  }
});
