// CORS headers for Edge Functions
// Restricts origins to production domain + localhost for dev

const ALLOWED_ORIGINS: string[] = [];

// Production origin from env (set via Supabase secrets: ALLOWED_ORIGIN=https://yourdomain.com)
const prodOrigin = Deno.env.get("ALLOWED_ORIGIN");
if (prodOrigin) {
  ALLOWED_ORIGINS.push(prodOrigin);
}

// Always allow localhost for development
ALLOWED_ORIGINS.push("http://localhost:5173");
ALLOWED_ORIGINS.push("http://localhost:3000");
ALLOWED_ORIGINS.push("http://127.0.0.1:5173");
ALLOWED_ORIGINS.push("http://127.0.0.1:3000");

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.some((allowed) => origin === allowed)) {
    return origin;
  }
  // If no ALLOWED_ORIGIN env var is set (hackathon mode), allow all origins
  // but log a warning so it's visible in logs
  if (!prodOrigin && origin) {
    console.warn(`CORS: No ALLOWED_ORIGIN set, allowing origin: ${origin}`);
    return origin;
  }
  // Default: return first allowed origin (won't match, request will fail CORS)
  return ALLOWED_ORIGINS[0] || "";
}

function getCorsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-bypass-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function handleCors(req: Request): Response | null {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}

export function jsonResponse(data: unknown, status = 200, req?: Request): Response {
  // Use dynamic CORS headers if request is available, otherwise use permissive headers
  const headers: Record<string, string> = req
    ? getCorsHeaders(req)
    : {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      };

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(message: string, status = 500, req?: Request): Response {
  return jsonResponse({ error: message }, status, req);
}

// Legacy export for backwards compatibility — used by Edge Functions that
// spread corsHeaders directly. This will be the permissive fallback;
// functions should migrate to using getCorsHeaders(req) instead.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
