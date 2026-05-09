import React, { useState, useEffect } from 'react';
import { SidebarItem } from './SidebarItem';
import { DUCKHIVE_API_BASE, listSessions } from '../../api/gateway';

interface HistoryEntry {
  id: string;
  title: string;
  timestamp: string | number;
  model?: string;
}

export function HistoryPanel({ gatewayUrl = DUCKHIVE_API_BASE }: { gatewayUrl?: string }) {
  const [sessions, setSessions] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    listSessions()
      .then(data => setSessions(data.map(session => ({
        id: session.id,
        title: session.title,
        timestamp: session.updatedAt,
      }))))
      .catch(() => setSessions([]));
  }, [gatewayUrl]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div>
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        color: '#6b7280',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        padding: '8px 12px 4px',
      }}>
        History
      </div>
      {sessions.length === 0 && (
        <div style={{ padding: '8px 12px', fontSize: '12px', color: '#6b7280' }}>
          No recent sessions
        </div>
      )}
      {sessions.slice(0, 20).map(session => (
        <SidebarItem
          key={session.id}
          label={session.title}
          onClick={() => {}}
          icon={<span style={{ fontSize: '11px', opacity: 0.5 }}>S</span>}
        />
      ))}
    </div>
  );
}
