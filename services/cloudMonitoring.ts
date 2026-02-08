/**
 * Google Cloud Monitoring Service
 * Fetches real Gemini API usage metrics from Google Cloud Monitoring
 * via the cloud-metrics Supabase Edge Function.
 */

import { supabase } from "./supabaseClient";

export interface CloudMethodUsage {
  method: string;
  count: number;
}

export interface CloudDailyUsage {
  date: string;
  count: number;
}

export interface CloudResponseCode {
  code: string;
  count: number;
}

export interface CloudMetricsData {
  source: "google_cloud_monitoring";
  projectId: string;
  timeRange: { start: string; end: string; daysBack: number };
  totalRequests: number;
  errorCount: number;
  successRate: string;
  byMethod: CloudMethodUsage[];
  byResponseCode: CloudResponseCode[];
  dailyUsage: CloudDailyUsage[];
}

/**
 * Fetch real API metrics from Google Cloud Monitoring
 * via the cloud-metrics Edge Function.
 */
export async function fetchCloudMetrics(
  daysBack = 30
): Promise<CloudMetricsData | null> {
  try {
    const { data, error } = await supabase.functions.invoke("cloud-metrics", {
      body: { daysBack },
    });

    if (error) {
      console.warn("Cloud metrics Edge Function error:", error);
      return null;
    }

    return data as CloudMetricsData;
  } catch (err) {
    console.warn("Failed to fetch cloud metrics:", err);
    return null;
  }
}

/** Friendly label for API method names */
export function formatMethodName(method: string): string {
  const labels: Record<string, string> = {
    GenerateContent: "Generate Content",
    StreamGenerateContent: "Stream Content",
    CreateFile: "File Upload",
    CountTokens: "Count Tokens",
    GetFile: "Get File",
    ListFiles: "List Files",
    DeleteFile: "Delete File",
  };
  return labels[method] || method;
}
