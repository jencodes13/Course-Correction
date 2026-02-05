import React, { useState, useEffect } from 'react';
import { Activity, ChevronUp } from 'lucide-react';
import { getUsageSummary, UsageSummary } from '../services/usageTracker';

// Design tokens
const T = {
  bg: '#0c0b09',
  surface: 'rgba(255,248,230,0.04)',
  border: 'rgba(255,248,230,0.08)',
  borderHover: 'rgba(255,248,230,0.14)',
  text: '#f5f0e0',
  textMuted: 'rgba(245,240,224,0.5)',
  textDim: 'rgba(245,240,224,0.3)',
  accent: '#c8956c',
  accentMuted: 'rgba(200,149,108,0.15)',
  green: '#6abf8a',
  sans: "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif",
  mono: "'SF Mono', 'Fira Code', monospace",
};

interface UsageWidgetProps {
  onClick: () => void;
}

const UsageWidget: React.FC<UsageWidgetProps> = ({ onClick }) => {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasNewActivity, setHasNewActivity] = useState(false);

  useEffect(() => {
    setSummary(getUsageSummary());

    const handleUpdate = () => {
      setSummary(getUsageSummary());
      setHasNewActivity(true);
      setTimeout(() => setHasNewActivity(false), 2000);
    };

    window.addEventListener('usage-update', handleUpdate);
    return () => window.removeEventListener('usage-update', handleUpdate);
  }, []);

  const formatCost = (cost: number) => {
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(2)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: T.bg,
        border: `1px solid ${isHovered ? T.borderHover : T.border}`,
        borderRadius: 12,
        cursor: 'pointer',
        fontFamily: T.sans,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transition: 'all 0.2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Activity indicator */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: hasNewActivity ? T.accentMuted : T.surface,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.3s ease',
      }}>
        <Activity
          size={14}
          style={{
            color: hasNewActivity ? T.accent : T.textMuted,
            transition: 'color 0.3s ease',
          }}
        />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{
            fontSize: 9,
            color: T.textDim,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 1,
          }}>
            Tokens
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.text,
            fontFamily: T.mono,
          }}>
            {formatTokens(summary?.totalTokens || 0)}
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: T.border }} />

        <div style={{ textAlign: 'left' }}>
          <div style={{
            fontSize: 9,
            color: T.textDim,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 1,
          }}>
            Cost
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.accent,
            fontFamily: T.mono,
          }}>
            {formatCost(summary?.totalEstimatedCost || 0)}
          </div>
        </div>
      </div>

      {/* Expand icon */}
      <ChevronUp
        size={14}
        style={{
          color: T.textDim,
          marginLeft: 4,
          transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
          transition: 'transform 0.2s ease',
        }}
      />
    </button>
  );
};

export default UsageWidget;
