import React, { useState, useEffect } from 'react';
import { X, Activity, Zap, DollarSign, Clock, ChevronDown, ChevronUp, Download, Trash2, RefreshCw, Cloud, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import {
  getUsageSummary,
  getTodayUsage,
  getAllRecords,
  clearUsageRecords,
  exportUsageData,
  UsageSummary,
  UsageRecord
} from '../services/usageTracker';
import { fetchCloudMetrics, formatMethodName, CloudMetricsData } from '../services/cloudMonitoring';

// Design tokens matching LandingPage
const T = {
  bg: '#0c0b09',
  bgWarm: '#13120e',
  bgCard: '#1a1914',
  surface: 'rgba(255,248,230,0.04)',
  surfaceHover: 'rgba(255,248,230,0.07)',
  border: 'rgba(255,248,230,0.08)',
  borderHover: 'rgba(255,248,230,0.14)',
  text: '#f5f0e0',
  textMuted: 'rgba(245,240,224,0.5)',
  textDim: 'rgba(245,240,224,0.3)',
  accent: '#c8956c',
  accentMuted: 'rgba(200,149,108,0.15)',
  green: '#6abf8a',
  greenMuted: 'rgba(106,191,138,0.12)',
  greenBorder: 'rgba(106,191,138,0.25)',
  red: '#c27056',
  redMuted: 'rgba(194,112,86,0.12)',
  sans: "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif",
  mono: "'SF Mono', 'Fira Code', monospace",
};

// Model color mapping
const MODEL_COLORS: Record<string, string> = {
  'gemini-3-pro-preview': '#8b5cf6',
  'gemini-3-flash-preview': '#3b82f6',
  'gemini-2.5-flash': '#10b981',
  'gemini-2.5-flash-image': '#f59e0b',
  'gemini-2.5-flash-native-audio-preview-12-2025': '#ec4899',
};

interface UsageDashboardProps {
  onClose: () => void;
}

const UsageDashboard: React.FC<UsageDashboardProps> = ({ onClose }) => {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [todaySummary, setTodaySummary] = useState<UsageSummary | null>(null);
  const [allRecords, setAllRecords] = useState<UsageRecord[]>([]);
  const [showAllCalls, setShowAllCalls] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'models' | 'cloud'>('overview');
  const [cloudMetrics, setCloudMetrics] = useState<CloudMetricsData | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const refreshData = () => {
    setSummary(getUsageSummary());
    setTodaySummary(getTodayUsage());
    setAllRecords(getAllRecords());
  };

  const refreshCloudMetrics = async () => {
    setCloudLoading(true);
    setCloudError(null);
    try {
      const data = await fetchCloudMetrics(30);
      setCloudMetrics(data);
      if (!data) setCloudError('Cloud metrics unavailable');
    } catch (err) {
      setCloudError('Failed to fetch cloud metrics');
    } finally {
      setCloudLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    refreshCloudMetrics();

    // Listen for real-time updates
    const handleUpdate = () => refreshData();
    window.addEventListener('usage-update', handleUpdate);
    return () => window.removeEventListener('usage-update', handleUpdate);
  }, []);

  const handleExport = () => {
    const data = exportUsageData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coursecorrect-usage-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (confirm('Clear all usage records? This cannot be undone.')) {
      clearUsageRecords();
      refreshData();
    }
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getModelColor = (model: string) => MODEL_COLORS[model] || T.accent;

  if (!summary) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      fontFamily: T.sans,
    }}>
      <div style={{
        width: '90%', maxWidth: 800, maxHeight: '85vh',
        background: T.bg, border: `1px solid ${T.border}`,
        borderRadius: 16, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: T.accentMuted, border: `1px solid rgba(200,149,108,0.2)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={18} style={{ color: T.accent }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>API Usage Dashboard</div>
              <div style={{ fontSize: 11, color: T.textDim }}>Track your Gemini API consumption</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={refreshData} style={{
              padding: '8px', borderRadius: 8, border: `1px solid ${T.border}`,
              background: T.surface, color: T.textMuted, cursor: 'pointer',
            }}>
              <RefreshCw size={14} />
            </button>
            <button onClick={handleExport} style={{
              padding: '8px', borderRadius: 8, border: `1px solid ${T.border}`,
              background: T.surface, color: T.textMuted, cursor: 'pointer',
            }}>
              <Download size={14} />
            </button>
            <button onClick={handleClear} style={{
              padding: '8px', borderRadius: 8, border: `1px solid ${T.border}`,
              background: T.redMuted, color: T.red, cursor: 'pointer',
            }}>
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} style={{
              padding: '8px', borderRadius: 8, border: `1px solid ${T.border}`,
              background: T.surface, color: T.textMuted, cursor: 'pointer',
            }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 3, padding: '12px 24px',
          borderBottom: `1px solid ${T.border}`,
        }}>
          {(['overview', 'calls', 'models', 'cloud'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 16px', borderRadius: 8,
              border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: activeTab === tab ? 600 : 500,
              fontFamily: T.sans,
              background: activeTab === tab ? (tab === 'cloud' ? 'rgba(59,130,246,0.15)' : T.accentMuted) : 'transparent',
              color: activeTab === tab ? (tab === 'cloud' ? '#60a5fa' : T.accent) : T.textDim,
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {tab === 'cloud' && <Cloud size={12} />}
              {tab === 'cloud' ? 'Google Cloud' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <StatCard
                  icon={Zap}
                  label="Total Calls"
                  value={summary.totalCalls.toString()}
                  subValue={`${todaySummary?.totalCalls || 0} today`}
                />
                <StatCard
                  icon={Activity}
                  label="Total Tokens"
                  value={formatTokens(summary.totalTokens)}
                  subValue={`${formatTokens(todaySummary?.totalTokens || 0)} today`}
                />
                <StatCard
                  icon={DollarSign}
                  label="Est. Cost"
                  value={formatCost(summary.totalEstimatedCost)}
                  subValue={`${formatCost(todaySummary?.totalEstimatedCost || 0)} today`}
                  highlight
                />
                <StatCard
                  icon={Clock}
                  label="Avg Response"
                  value={summary.recentCalls.length > 0
                    ? formatDuration(
                        summary.recentCalls.reduce((acc, r) => acc + (r.durationMs || 0), 0) /
                        summary.recentCalls.filter(r => r.durationMs).length
                      )
                    : '-'
                  }
                  subValue="last 50 calls"
                />
              </div>

              {/* Google Cloud Verified Banner */}
              {cloudMetrics && (
                <div style={{
                  background: 'rgba(59,130,246,0.08)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 12, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(59,130,246,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Cloud size={16} style={{ color: '#60a5fa' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa' }}>
                      Google Cloud Verified
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>
                      {cloudMetrics.totalRequests} total API calls ({cloudMetrics.successRate}% success rate) — last {cloudMetrics.timeRange.daysBack} days
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('cloud')} style={{
                    fontSize: 11, color: '#60a5fa', background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6,
                    padding: '4px 10px', cursor: 'pointer', fontFamily: T.sans,
                  }}>
                    Details
                  </button>
                </div>
              )}

              {/* Token Breakdown */}
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 12, padding: 16,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 12 }}>
                  Token Breakdown
                </div>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4 }}>Input Tokens</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: T.mono }}>
                      {formatTokens(summary.totalPromptTokens)}
                    </div>
                  </div>
                  <div style={{ width: 1, background: T.border }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4 }}>Output Tokens</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: T.mono }}>
                      {formatTokens(summary.totalResponseTokens)}
                    </div>
                  </div>
                  <div style={{ width: 1, background: T.border }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4 }}>Input/Output Ratio</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.accent, fontFamily: T.mono }}>
                      {summary.totalResponseTokens > 0
                        ? (summary.totalPromptTokens / summary.totalResponseTokens).toFixed(1)
                        : '-'
                      }:1
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Calls Preview */}
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 12, padding: 16,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Recent Calls</div>
                  <button onClick={() => setActiveTab('calls')} style={{
                    fontSize: 11, color: T.accent, background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: T.sans,
                  }}>
                    View all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {summary.recentCalls.slice(0, 5).map(record => (
                    <CallRow key={record.id} record={record} compact />
                  ))}
                  {summary.recentCalls.length === 0 && (
                    <div style={{ fontSize: 12, color: T.textDim, textAlign: 'center', padding: 20 }}>
                      No API calls recorded yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calls' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allRecords.map(record => (
                <CallRow key={record.id} record={record} />
              ))}
              {allRecords.length === 0 && (
                <div style={{
                  fontSize: 13, color: T.textDim, textAlign: 'center',
                  padding: 40, background: T.surface, borderRadius: 12,
                }}>
                  No API calls recorded yet. Use the app to see usage data here.
                </div>
              )}
            </div>
          )}

          {activeTab === 'models' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(summary.byModel).map(([model, data]: [string, { calls: number; promptTokens: number; responseTokens: number; totalTokens: number; estimatedCost: number }]) => (
                <div key={model} style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 12, padding: 16,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: getModelColor(model),
                    }} />
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: T.text,
                      fontFamily: T.mono,
                    }}>
                      {model}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 2 }}>Calls</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{data.calls}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 2 }}>Input</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                        {formatTokens(data.promptTokens)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 2 }}>Output</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                        {formatTokens(data.responseTokens)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 2 }}>Est. Cost</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.accent }}>
                        {formatCost(data.estimatedCost)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {Object.keys(summary.byModel).length === 0 && (
                <div style={{
                  fontSize: 13, color: T.textDim, textAlign: 'center',
                  padding: 40, background: T.surface, borderRadius: 12,
                }}>
                  No model usage data yet
                </div>
              )}
            </div>
          )}

          {activeTab === 'cloud' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Cloud header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Cloud size={18} style={{ color: '#60a5fa' }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Google Cloud Monitoring</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>
                      Real API metrics from your GCP project
                    </div>
                  </div>
                </div>
                <button onClick={refreshCloudMetrics} disabled={cloudLoading} style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: '1px solid rgba(59,130,246,0.2)',
                  background: 'rgba(59,130,246,0.08)',
                  color: '#60a5fa', cursor: cloudLoading ? 'wait' : 'pointer',
                  fontSize: 11, fontFamily: T.sans,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {cloudLoading ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
                  Refresh
                </button>
              </div>

              {cloudLoading && !cloudMetrics && (
                <div style={{
                  padding: 40, textAlign: 'center',
                  background: T.surface, borderRadius: 12,
                }}>
                  <Loader size={20} style={{ color: '#60a5fa', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 13, color: T.textMuted }}>Fetching metrics from Google Cloud...</div>
                </div>
              )}

              {cloudError && !cloudMetrics && (
                <div style={{
                  padding: 24, textAlign: 'center',
                  background: T.redMuted, border: `1px solid rgba(194,112,86,0.2)`,
                  borderRadius: 12,
                }}>
                  <AlertTriangle size={20} style={{ color: T.red, margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 13, color: T.red, marginBottom: 4 }}>{cloudError}</div>
                  <div style={{ fontSize: 11, color: T.textDim }}>
                    Make sure the GOOGLE_SERVICE_ACCOUNT_KEY secret is set and the cloud-metrics Edge Function is deployed.
                  </div>
                </div>
              )}

              {cloudMetrics && (
                <>
                  {/* Summary stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{
                      background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
                      borderRadius: 12, padding: 14,
                    }}>
                      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 6 }}>Total API Calls</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#60a5fa', fontFamily: T.mono }}>
                        {cloudMetrics.totalRequests}
                      </div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
                        Last {cloudMetrics.timeRange.daysBack} days
                      </div>
                    </div>
                    <div style={{
                      background: T.greenMuted, border: `1px solid ${T.greenBorder}`,
                      borderRadius: 12, padding: 14,
                    }}>
                      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 6 }}>Success Rate</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: T.green, fontFamily: T.mono }}>
                        {cloudMetrics.successRate}%
                      </div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
                        {cloudMetrics.errorCount} errors
                      </div>
                    </div>
                    <div style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: 12, padding: 14,
                    }}>
                      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 6 }}>API Methods</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: T.mono }}>
                        {cloudMetrics.byMethod.length}
                      </div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
                        Distinct endpoints used
                      </div>
                    </div>
                  </div>

                  {/* By Method breakdown */}
                  <div style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 12, padding: 16,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 12 }}>
                      Calls by API Method
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {cloudMetrics.byMethod.map(({ method, count }) => {
                        const maxCount = cloudMetrics.byMethod[0]?.count || 1;
                        const pct = (count / maxCount) * 100;
                        return (
                          <div key={method} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 140, fontSize: 12, color: T.text,
                              fontFamily: T.mono, flexShrink: 0,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {formatMethodName(method)}
                            </div>
                            <div style={{ flex: 1, height: 20, background: T.border, borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{
                                width: `${pct}%`, height: '100%',
                                background: 'rgba(59,130,246,0.4)',
                                borderRadius: 4,
                                transition: 'width 0.3s ease',
                              }} />
                            </div>
                            <div style={{
                              width: 40, fontSize: 12, fontWeight: 600, color: '#60a5fa',
                              fontFamily: T.mono, textAlign: 'right', flexShrink: 0,
                            }}>
                              {count}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Daily Usage */}
                  {cloudMetrics.dailyUsage.length > 0 && (
                    <div style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: 12, padding: 16,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 12 }}>
                        Daily API Calls
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                        {cloudMetrics.dailyUsage.map(({ date, count }) => {
                          const maxDay = Math.max(...cloudMetrics.dailyUsage.map(d => d.count));
                          const heightPct = maxDay > 0 ? (count / maxDay) * 100 : 0;
                          return (
                            <div key={date} style={{
                              flex: 1, display: 'flex', flexDirection: 'column',
                              alignItems: 'center', gap: 4,
                            }}>
                              <div style={{
                                fontSize: 9, color: '#60a5fa', fontFamily: T.mono,
                                opacity: count > 0 ? 1 : 0,
                              }}>
                                {count}
                              </div>
                              <div style={{
                                width: '100%', maxWidth: 32,
                                height: Math.max(heightPct, 2),
                                background: count > 0 ? 'rgba(59,130,246,0.4)' : T.border,
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.3s ease',
                              }} />
                              <div style={{
                                fontSize: 8, color: T.textDim, fontFamily: T.mono,
                                whiteSpace: 'nowrap',
                              }}>
                                {date.slice(5)} {/* MM-DD */}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Response Codes */}
                  {cloudMetrics.byResponseCode.length > 0 && (
                    <div style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: 12, padding: 16,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 12 }}>
                        Response Codes
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {cloudMetrics.byResponseCode.map(({ code, count }) => {
                          const isSuccess = code.startsWith('2');
                          return (
                            <div key={code} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '8px 14px', borderRadius: 8,
                              background: isSuccess ? T.greenMuted : T.redMuted,
                              border: `1px solid ${isSuccess ? T.greenBorder : 'rgba(194,112,86,0.2)'}`,
                            }}>
                              {isSuccess
                                ? <CheckCircle size={12} style={{ color: T.green }} />
                                : <AlertTriangle size={12} style={{ color: T.red }} />
                              }
                              <span style={{
                                fontSize: 12, fontWeight: 600, fontFamily: T.mono,
                                color: isSuccess ? T.green : T.red,
                              }}>
                                {code}
                              </span>
                              <span style={{ fontSize: 12, color: T.textMuted }}>
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Data Source info */}
                  <div style={{
                    fontSize: 10, color: T.textDim, textAlign: 'center',
                    padding: '8px 0',
                  }}>
                    Source: Google Cloud Monitoring API — Project {cloudMetrics.projectId}
                    {' — '}
                    {new Date(cloudMetrics.timeRange.start).toLocaleDateString()} to {new Date(cloudMetrics.timeRange.end).toLocaleDateString()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
function StatCard({ icon: Icon, label, value, subValue, highlight }: {
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={14} style={{ color: highlight ? T.accent : T.textDim }} />
        <span style={{ fontSize: 11, color: T.textDim, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700, fontFamily: T.mono,
        color: highlight ? T.accent : T.text,
      }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>{subValue}</div>
      )}
    </div>
  );
}

// Call Row Component
const CallRow: React.FC<{ record: UsageRecord; compact?: boolean }> = ({ record, compact }) => {
  const getModelColor = (model: string) => MODEL_COLORS[model] || T.accent;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    if (compact) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: compact ? '8px 0' : '12px 14px',
      background: compact ? 'transparent' : T.surface,
      border: compact ? 'none' : `1px solid ${T.border}`,
      borderBottom: compact ? `1px solid ${T.border}` : undefined,
      borderRadius: compact ? 0 : 10,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: getModelColor(record.model),
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: T.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {record.functionName}
        </div>
        {!compact && (
          <div style={{
            fontSize: 10, color: T.textDim, fontFamily: T.mono,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {record.model}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: T.text, fontFamily: T.mono }}>
          {record.promptTokens.toLocaleString()} / {record.responseTokens.toLocaleString()}
        </div>
        <div style={{ fontSize: 10, color: T.textDim }}>
          {formatTime(record.timestamp)}
        </div>
      </div>
      {!compact && (
        <div style={{
          fontSize: 11, fontWeight: 600, color: T.accent,
          fontFamily: T.mono, flexShrink: 0, width: 60, textAlign: 'right',
        }}>
          ${record.estimatedCost.toFixed(4)}
        </div>
      )}
    </div>
  );
};

export default UsageDashboard;
