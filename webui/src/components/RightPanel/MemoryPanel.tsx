import React, { useState, useCallback } from 'react';
import { searchMemory, getMemoryStats, type MemoryEntry } from '../../api/gateway';

export function MemoryPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [stats, setStats] = useState<{ total: number; types: Record<string, number> } | null>(null);

  // Load stats on mount
  React.useEffect(() => {
    getMemoryStats().then(setStats).catch(() => {});
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchMemory(q);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  return (
    <div style={{ padding: '12px' }}>
      {/* Stats summary */}
      {stats && (
        <div style={{
          padding: '8px 10px',
          background: 'rgba(6,182,212,0.1)',
          border: '1px solid rgba(6,182,212,0.2)',
          borderRadius: 8,
          marginBottom: 10,
          fontSize: 11,
          color: '#06b6d4',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>🧠 Memory Stats</div>
          <div>{stats.total} total memories</div>
          {Object.entries(stats.types).slice(0, 3).map(([type, count]) => (
            <div key={type} style={{ color: 'rgba(6,182,212,0.7)', fontSize: 10 }}>
              {type}: {count}
            </div>
          ))}
        </div>
      )}

      {/* Search form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search memories..."
            style={{
              width: '100%',
              padding: '6px 32px 6px 10px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-elevated)',
              color: 'var(--color-text)',
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--color-text-muted)',
            }}
          >
            🔍
          </button>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <LoadingSpinner />
      ) : results.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map((entry, i) => (
            <div key={entry.id || i} style={{
              padding: '8px 10px',
              background: 'var(--color-surface-elevated)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--color-text)', lineHeight: 1.4 }}>
                {entry.content}
              </div>
              {entry.type && (
                <div style={{ marginTop: 4 }}>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: '#06b6d4',
                    background: 'rgba(6,182,212,0.15)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                  }}>
                    {entry.type}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : searched ? (
        <EmptyState icon="🔍" message="No results found" />
      ) : (
        <EmptyState icon="🧠" message="Search your memory/knowledge base" />
      )}
    </div>
  );
}

function LoadingSpinner() {
  return <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 12 }}>Searching...</div>;
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 12 }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      {message}
    </div>
  );
}