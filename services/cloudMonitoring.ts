/**
 * Google Cloud Monitoring Service
 *
 * NOTE: This service requires a backend/server-side execution.
 * The service account credentials cannot be exposed in the browser.
 *
 * To use this:
 * 1. Create an API endpoint (e.g., Vercel serverless function, Express route)
 * 2. Move this code to the backend
 * 3. Call the backend endpoint from the frontend
 *
 * For now, this serves as documentation and ready-to-use code for when
 * you set up a backend.
 */

// Service account config - MOVE TO BACKEND, DO NOT EXPOSE IN BROWSER
const SERVICE_ACCOUNT = {
  projectId: 'gen-lang-client-0033591157',
  clientEmail: 'dashboard-monitor@gen-lang-client-0033591157.iam.gserviceaccount.com',
  // Private key would go here - NEVER expose in client code
};

/**
 * Metrics available for Gemini API via Cloud Monitoring:
 *
 * 1. serviceruntime.googleapis.com/api/request_count
 *    - Number of API calls
 *    - Labels: api_method, response_code, credential_id
 *
 * 2. aiplatform.googleapis.com/prediction/online/response_latencies
 *    - Response latency distribution (if using Vertex AI)
 *
 * 3. For standard Gemini API (not Vertex), the response.usageMetadata
 *    in each API call is the most accurate source of token counts.
 */

export interface CloudMetricsData {
  requestCount: number;
  errorRate: number;
  latencyP50: number;
  latencyP99: number;
  lastUpdated: Date;
}

/**
 * Example backend implementation (Node.js):
 *
 * ```typescript
 * import { google } from 'googleapis';
 *
 * const monitoring = google.monitoring('v3');
 *
 * async function getApiRequestCount(projectId: string, startTime: Date, endTime: Date) {
 *   const auth = new google.auth.GoogleAuth({
 *     keyFile: './gen-lang-client-0033591157-39158ccc7615.json',
 *     scopes: ['https://www.googleapis.com/auth/monitoring.read'],
 *   });
 *
 *   const authClient = await auth.getClient();
 *   google.options({ auth: authClient });
 *
 *   const response = await monitoring.projects.timeSeries.list({
 *     name: `projects/${projectId}`,
 *     filter: 'metric.type="serviceruntime.googleapis.com/api/request_count"',
 *     interval: {
 *       startTime: startTime.toISOString(),
 *       endTime: endTime.toISOString(),
 *     },
 *     aggregation: {
 *       alignmentPeriod: '3600s',
 *       perSeriesAligner: 'ALIGN_SUM',
 *     },
 *   });
 *
 *   return response.data.timeSeries;
 * }
 * ```
 */

/**
 * Frontend function to fetch from your backend API
 */
export async function fetchCloudMetrics(
  backendUrl: string,
  timeRange: { start: Date; end: Date }
): Promise<CloudMetricsData | null> {
  try {
    const response = await fetch(`${backendUrl}/api/cloud-metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: SERVICE_ACCOUNT.projectId,
        startTime: timeRange.start.toISOString(),
        endTime: timeRange.end.toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch cloud metrics:', error);
    return null;
  }
}

/**
 * Alternative: Use the Monitoring API directly via REST (for backend)
 *
 * Endpoint: https://monitoring.googleapis.com/v3/projects/{project_id}/timeSeries
 *
 * Required headers:
 * - Authorization: Bearer {access_token}
 *
 * Query parameters:
 * - filter: metric.type="serviceruntime.googleapis.com/api/request_count"
 * - interval.startTime: ISO timestamp
 * - interval.endTime: ISO timestamp
 */

export const MONITORING_API_DOCS = {
  endpoint: 'https://monitoring.googleapis.com/v3/projects/{PROJECT_ID}/timeSeries',
  documentation: 'https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list',
  relevantMetrics: [
    'serviceruntime.googleapis.com/api/request_count',
    'serviceruntime.googleapis.com/api/request_latencies',
    'serviceruntime.googleapis.com/api/error_count',
  ],
};
