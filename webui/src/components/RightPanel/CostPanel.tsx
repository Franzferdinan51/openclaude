import React, { useState, useEffect } from 'react';
import { getCostStats, type CostStats } from '../../api/gateway';
import { getSystemStatus, type SystemStatus } from '../../api/status';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Meter({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{value.toFixed(0)}%</span>
      </div>
      <div style={{
        height: 4,
        background: 'var(--color-surface-elevated)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

export function CostPanel() {
  const [cost, setCost] = useState<CostStats | null>(null);
  const [sys, setSys] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCostStats(), getSystemStatus()]).then(([c, s]) => {
      setCost(c);
      setSys(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '12px' }}>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Token usage */}
          <div style={{
            padding: '10px',
            background: 'var(--color-surface-elevated)',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            marginBottom: 12,
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 8,
            }}>
              💰 Token Usage
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <MetricBox label="Prompt" value={formatNumber(cost?.promptTokens ?? 0)} color="#3b82f6" />
              <MetricBox label="Completion" value={formatNumber(cost?.completionTokens ?? 0)} color="#8b5cf6" />
            </div>
            <div style={{ marginTop: 8 }}>
              <MetricBox label="Total" value={formatNumber(cost?.totalTokens ?? 0)} color="#22c55e" fullWidth />
            </div>
            {cost?.estimatedCost !== undefined && (
              <div style={{
                marginTop: 8,
                padding: '6px 8px',
                background: 'rgba(34,197,94,0.1)',
                borderRadius: 6,
                fontSize: 12,
                color: '#22c55e',
                fontWeight: 600,
                textAlign: 'center',
              }}>
                ~${cost.estimatedCost.toFixed(4)} estimated
              </div>
            )}
          </div>

          {/* System status */}
          {sys && (
            <div style={{
              padding: '10px',
              background: 'var(--color-surface-elevated)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              marginBottom: 12,
            }}>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 8,
              }}>
                🖥️ System
              </div>

              <Meter label="CPU" value={sys.cpu} color="#f59e0b" />
              <Meter label="RAM" value={sys.memory} color="#3b82f6" />
              <Meter label="Disk" value={sys.disk} color="#8b5cf6" />

              <div style={{ fontSize: 10, color: 'var(--color-text-dim)', textAlign: 'center', marginTop: 4 }}>
                {sys.memoryUsed.toFixed(1)}GB / {sys.memoryTotal.toFixed(0)}GB RAM
                {' · '}
                {sys.diskUsed.toFixed(0)}GB / {sys.diskTotal.toFixed(0)}GB Disk
              </div>
            </div>
          )}

          {/* Period info */}
          {cost?.period && (
            <div style={{ fontSize: 10, color: 'var(--color-text-dim)', textAlign: 'center' }}>
              Period: {cost.period}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricBox({ label, value, color, fullWidth }: { label: string; value: string; color: string; fullWidth?: boolean }) {
  return (
    <div style={{
      padding: '6px 8px',
      background: 'var(--color-surface)',
      borderRadius: 6,
      textAlign: 'center',
      gridColumn: fullWidth ? '1 / -1' : undefined,
    }}>
      <div style={{ fontSize: 9, color: 'var(--color-text-dim)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 12 }}>Loading...</div>;
}