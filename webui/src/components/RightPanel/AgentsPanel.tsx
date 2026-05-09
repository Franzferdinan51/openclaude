import React, { useState, useEffect } from 'react';
import { getAgents, type AgentInfo } from '../../api/gateway';

const STATUS_COLORS = {
  online: '#22c55e',
  busy: '#f59e0b',
  offline: '#6b7280',
};

const STATUS_LABELS = {
  online: 'Online',
  busy: 'Busy',
  offline: 'Offline',
};

export function AgentsPanel() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgents().then(data => {
      setAgents(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '12px' }}>
      {loading ? (
        <LoadingSpinner />
      ) : agents.length === 0 ? (
        <EmptyState icon="🤖" message="No agents registered" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {agents.map(agent => (
            <div key={agent.id} style={{
              padding: '10px 12px',
              background: 'var(--color-surface-elevated)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {agent.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {agent.status === 'busy' && (
                    <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>working...</span>
                  )}
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: STATUS_COLORS[agent.status],
                    boxShadow: agent.status !== 'offline'
                      ? `0 0 4px ${STATUS_COLORS[agent.status]}`
                      : 'none',
                    flexShrink: 0,
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: STATUS_COLORS[agent.status],
                  background: `${STATUS_COLORS[agent.status]}20`,
                  padding: '1px 6px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {STATUS_LABELS[agent.status]}
                </span>
                {agent.model && (
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    {agent.model}
                  </span>
                )}
              </div>

              {agent.capabilities && agent.capabilities.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginTop: 6 }}>
                  {agent.capabilities.slice(0, 4).map(cap => (
                    <span key={cap} style={{
                      fontSize: 9,
                      color: 'var(--color-text-dim)',
                      background: 'var(--color-surface)',
                      padding: '1px 5px',
                      borderRadius: 3,
                      border: '1px solid var(--color-border)',
                    }}>
                      {cap}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 12 }}>Loading...</div>;
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 12 }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      {message}
    </div>
  );
}