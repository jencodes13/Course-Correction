/**
 * Usage Tracker Service
 * Tracks Gemini API token usage per-call with localStorage persistence
 */

export interface UsageRecord {
  id: string;
  timestamp: number;
  model: string;
  functionName: string;
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
  estimatedCost: number;
  durationMs?: number;
}

export interface UsageSummary {
  totalCalls: number;
  totalPromptTokens: number;
  totalResponseTokens: number;
  totalTokens: number;
  totalEstimatedCost: number;
  byModel: Record<string, {
    calls: number;
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    estimatedCost: number;
  }>;
  recentCalls: UsageRecord[];
}

// Pricing per 1M tokens (as of early 2025 - update as needed)
// These are estimates - check Google's pricing page for current rates
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-3-pro-preview': { input: 1.25, output: 5.00 },
  'gemini-3-flash-preview': { input: 0.075, output: 0.30 },
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.5-flash-image': { input: 0.075, output: 0.30 },
  'gemini-2.5-flash-native-audio-preview-12-2025': { input: 0.075, output: 0.30 },
  // Default fallback
  'default': { input: 0.10, output: 0.40 },
};

const STORAGE_KEY = 'coursecorrect_usage_records';
const MAX_RECORDS = 500; // Keep last 500 calls

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getRecords(): UsageRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecords(records: UsageRecord[]): void {
  // Keep only the most recent records
  const trimmed = records.slice(-MAX_RECORDS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function calculateCost(model: string, promptTokens: number, responseTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (responseTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Record a Gemini API call
 */
export function recordUsage(
  model: string,
  functionName: string,
  promptTokens: number,
  responseTokens: number,
  durationMs?: number
): UsageRecord {
  const record: UsageRecord = {
    id: generateId(),
    timestamp: Date.now(),
    model,
    functionName,
    promptTokens,
    responseTokens,
    totalTokens: promptTokens + responseTokens,
    estimatedCost: calculateCost(model, promptTokens, responseTokens),
    durationMs,
  };

  const records = getRecords();
  records.push(record);
  saveRecords(records);

  // Dispatch custom event for real-time updates
  window.dispatchEvent(new CustomEvent('usage-update', { detail: record }));

  return record;
}

/**
 * Get usage summary
 */
export function getUsageSummary(): UsageSummary {
  const records = getRecords();

  const byModel: UsageSummary['byModel'] = {};
  let totalPromptTokens = 0;
  let totalResponseTokens = 0;
  let totalEstimatedCost = 0;

  for (const record of records) {
    totalPromptTokens += record.promptTokens;
    totalResponseTokens += record.responseTokens;
    totalEstimatedCost += record.estimatedCost;

    if (!byModel[record.model]) {
      byModel[record.model] = {
        calls: 0,
        promptTokens: 0,
        responseTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      };
    }
    byModel[record.model].calls++;
    byModel[record.model].promptTokens += record.promptTokens;
    byModel[record.model].responseTokens += record.responseTokens;
    byModel[record.model].totalTokens += record.promptTokens + record.responseTokens;
    byModel[record.model].estimatedCost += record.estimatedCost;
  }

  return {
    totalCalls: records.length,
    totalPromptTokens,
    totalResponseTokens,
    totalTokens: totalPromptTokens + totalResponseTokens,
    totalEstimatedCost,
    byModel,
    recentCalls: records.slice(-50).reverse(), // Last 50, newest first
  };
}

/**
 * Get all records (for export/detailed view)
 */
export function getAllRecords(): UsageRecord[] {
  return getRecords().reverse(); // Newest first
}

/**
 * Clear all usage records
 */
export function clearUsageRecords(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('usage-update', { detail: null }));
}

/**
 * Export usage data as JSON
 */
export function exportUsageData(): string {
  const summary = getUsageSummary();
  const allRecords = getAllRecords();
  return JSON.stringify({ summary, records: allRecords }, null, 2);
}

/**
 * Get usage for a specific time period
 */
export function getUsageForPeriod(startTime: number, endTime: number = Date.now()): UsageRecord[] {
  return getRecords().filter(r => r.timestamp >= startTime && r.timestamp <= endTime);
}

/**
 * Get today's usage
 */
export function getTodayUsage(): UsageSummary {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayRecords = getUsageForPeriod(startOfDay.getTime());

  const byModel: UsageSummary['byModel'] = {};
  let totalPromptTokens = 0;
  let totalResponseTokens = 0;
  let totalEstimatedCost = 0;

  for (const record of todayRecords) {
    totalPromptTokens += record.promptTokens;
    totalResponseTokens += record.responseTokens;
    totalEstimatedCost += record.estimatedCost;

    if (!byModel[record.model]) {
      byModel[record.model] = {
        calls: 0,
        promptTokens: 0,
        responseTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      };
    }
    byModel[record.model].calls++;
    byModel[record.model].promptTokens += record.promptTokens;
    byModel[record.model].responseTokens += record.responseTokens;
    byModel[record.model].totalTokens += record.promptTokens + record.responseTokens;
    byModel[record.model].estimatedCost += record.estimatedCost;
  }

  return {
    totalCalls: todayRecords.length,
    totalPromptTokens,
    totalResponseTokens,
    totalTokens: totalPromptTokens + totalResponseTokens,
    totalEstimatedCost,
    byModel,
    recentCalls: todayRecords.reverse(),
  };
}
