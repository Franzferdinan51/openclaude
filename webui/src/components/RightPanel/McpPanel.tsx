import React, { useState, useEffect } from 'react';
import { getMcpServers, type McpServerInfo } from '../../api/gateway';

const STATUS_COLORS = {
  connected: '#22c55e',
  disconnected: '#6b7280',
  error: '#ef4444',
};

const STATUS_LABELS = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Error',
};

export function McpPanel() {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMcpServers().then(data => {
      setServers(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '12px' }}>
      {loading ? (
        <LoadingSpinner />
      ) : servers.length === 0 ? (
        <EmptyState icon="🔌" message="No MCP servers connected" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {servers.map(server => (
            <div key={server.id} style={{
              padding: '10px 12px',
              background: 'var(--color-surface-elevated)',
              borderRadius: 8,
              border: `1px solid ${server.status === 'connected' ? 'var(--color-border)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {server.name}
                </span>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: STATUS_COLORS[server.status],
                  boxShadow: server.status === 'connected'
                    ? `0 0 4px ${STATUS_COLORS[server.status]}`
                    : 'none',
                }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: STATUS_COLORS[server.status],
                  background: `${STATUS_COLORS[server.status]}20`,
                  padding: '1px 6px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {STATUS_LABELS[server.status]}
                </span>
                {server.status === 'connected' && (
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    {server.tools} tools
                  </span>
                )}
              </div>

              {server.url && (
                <div style={{ fontSize: 9, color: 'var(--color-text-dim)', wordBreak: 'break-all' as const }}>
                  {server.url}
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