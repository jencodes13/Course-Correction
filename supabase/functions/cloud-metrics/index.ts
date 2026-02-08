// Edge Function: Cloud Metrics
// Queries Google Cloud Monitoring API for real Gemini API usage data
// Uses service account JWT auth (key stored in GOOGLE_SERVICE_ACCOUNT_KEY secret)

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

// --- JWT / Google Auth helpers ---

function base64urlEncode(data: string | ArrayBuffer): string {
  let base64: string;
  if (typeof data === "string") {
    base64 = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  // Import the private key
  const der = pemToDer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Create JWT
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64urlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/monitoring.read",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const signatureInput = `${header}.${claimSet}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signatureInput)
  );

  const jwt = `${signatureInput}.${base64urlEncode(signature)}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${tokenResponse.status} ${errText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// --- Cloud Monitoring query ---

interface TimeSeriesPoint {
  interval: { startTime: string; endTime: string };
  value: { int64Value?: string; doubleValue?: number };
}

interface TimeSeries {
  metric: { labels: Record<string, string>; type: string };
  resource: { labels: Record<string, string> };
  points: TimeSeriesPoint[];
}

async function queryTimeSeries(
  accessToken: string,
  projectId: string,
  filter: string,
  startTime: string,
  endTime: string,
  alignmentPeriod = "86400s",
  aligner = "ALIGN_SUM"
): Promise<TimeSeries[]> {
  const params = new URLSearchParams({
    filter,
    "interval.startTime": startTime,
    "interval.endTime": endTime,
    "aggregation.alignmentPeriod": alignmentPeriod,
    "aggregation.perSeriesAligner": aligner,
  });

  const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Monitoring API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.timeSeries || [];
}

// --- Main handler ---

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Read service account key from secret
    const saKeyJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!saKeyJson) {
      return errorResponse("GOOGLE_SERVICE_ACCOUNT_KEY secret not set", 500);
    }

    const saKey = JSON.parse(saKeyJson);
    const projectId = saKey.project_id;

    // Parse request body for time range (optional)
    let daysBack = 30;
    try {
      const body = await req.json();
      if (body.daysBack && typeof body.daysBack === "number") {
        daysBack = Math.min(Math.max(body.daysBack, 1), 90);
      }
    } catch {
      // No body or invalid JSON — use default 30 days
    }

    const endTime = new Date().toISOString();
    const startTime = new Date(
      Date.now() - daysBack * 24 * 60 * 60 * 1000
    ).toISOString();

    // Get access token
    const accessToken = await getAccessToken(
      saKey.client_email,
      saKey.private_key
    );

    // Query request counts (daily granularity)
    const requestSeries = await queryTimeSeries(
      accessToken,
      projectId,
      'metric.type="serviceruntime.googleapis.com/api/request_count"',
      startTime,
      endTime,
      "86400s",
      "ALIGN_SUM"
    );

    // Process into structured response
    let totalRequests = 0;
    const byMethod: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const byResponseCode: Record<string, number> = {};

    for (const ts of requestSeries) {
      const method = (ts.resource.labels.method || "unknown").split(".").pop() || "unknown";
      const responseCode = ts.metric.labels.response_code || "unknown";

      for (const point of ts.points) {
        const count = parseInt(point.value.int64Value || "0", 10);
        totalRequests += count;

        // By method
        byMethod[method] = (byMethod[method] || 0) + count;

        // By day
        const day = point.interval.endTime.slice(0, 10);
        byDay[day] = (byDay[day] || 0) + count;

        // By response code
        byResponseCode[responseCode] = (byResponseCode[responseCode] || 0) + count;
      }
    }

    // Sort daily data
    const dailyUsage = Object.entries(byDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate error count
    const errorCount = Object.entries(byResponseCode)
      .filter(([code]) => !code.startsWith("2"))
      .reduce((sum, [, count]) => sum + count, 0);

    return jsonResponse({
      source: "google_cloud_monitoring",
      projectId,
      timeRange: { start: startTime, end: endTime, daysBack },
      totalRequests,
      errorCount,
      successRate:
        totalRequests > 0
          ? ((totalRequests - errorCount) / totalRequests * 100).toFixed(1)
          : "100.0",
      byMethod: Object.entries(byMethod)
        .map(([method, count]) => ({ method, count }))
        .sort((a, b) => b.count - a.count),
      byResponseCode: Object.entries(byResponseCode)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count),
      dailyUsage,
    });
  } catch (error) {
    console.error("Cloud metrics error:", error);
    return errorResponse(
      `Cloud metrics failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
});
