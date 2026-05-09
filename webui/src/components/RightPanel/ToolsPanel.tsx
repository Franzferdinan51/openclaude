import React, { useState, useEffect } from 'react';
import { getTools, type ToolInfo } from '../../api/gateway';

const CATEGORY_COLORS: Record<string, string> = {
  desktop: '#3b82f6',
  android: '#22c55e',
  shell: '#ef4444',
  file: '#f59e0b',
  web: '#8b5cf6',
  memory: '#06b6d4',
  agent: '#ec4899',
  cron: '#14b8a6',
  voice: '#f97316',
  other: '#6b7280',
};

export function ToolsPanel() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getTools().then(data => {
      setTools(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = tools.filter(t =>
    t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.description.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ marginBottom: 10 }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search tools..."
          style={{
            width: '100%',
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-elevated)',
            color: 'var(--color-text)',
            fontSize: 12,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔧" message={filter ? 'No tools match your search' : 'No tools available'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(tool => (
            <div key={tool.name} style={{
              padding: '8px 10px',
              background: 'var(--color-surface-elevated)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              cursor: 'default',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                  {tool.name}
                </span>
                {tool.dangerous && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#ef4444',
                    background: 'rgba(239,68,68,0.15)',
                    padding: '1px 5px',
                    borderRadius: 4,
                    letterSpacing: '0.5px',
                  }}>DANGER</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                {tool.description || 'No description'}
              </div>
              {tool.category && (
                <div style={{ marginTop: 4 }}>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: CATEGORY_COLORS[tool.category] || CATEGORY_COLORS.other,
                    background: `${CATEGORY_COLORS[tool.category] || CATEGORY_COLORS.other}20`,
                    padding: '1px 6px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {tool.category}
                  </span>
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
  return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 12 }}>
      Loading...
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 12 }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      {message}
    </div>
  );
}