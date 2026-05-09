import React, { useState, useEffect } from 'react';
import { SidebarItem } from './SidebarItem';

interface AgentInfo {
  id: string;
  name: string;
  status: 'online' | 'busy' | 'offline';
  model?: string;
  capabilities?: string[];
}

const DEFAULT_AGENTS: AgentInfo[] = [
  { id: 'duckbot', name: 'DuckBot', status: 'online', model: 'MiniMax M2.7' },
  { id: 'orchestrator', name: 'Orchestrator', status: 'online', model: 'Qwen 3.6+' },
  { id: 'council', name: 'AI Council', status: 'online', model: 'Qwen 3.6+' },
  { id: 'meta', name: 'Meta-Agent', status: 'offline', model: 'Qwen 3.6+' },
];

const STATUS_COLORS: Record<AgentInfo['status'], string> = {
  online: '#22c55e',
  busy: '#f59e0b',
  offline: '#6b7280',
};

export function AgentsPanel({ gatewayUrl = 'http://localhost:18789' }: { gatewayUrl?: string }) {
  const [agents, setAgents] = useState<AgentInfo[]>(DEFAULT_AGENTS);

  useEffect(() => {
    fetch(`${gatewayUrl}/api/mesh/agents`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAgents(data);
      })
      .catch(() => { /* use defaults */ });
  }, [gatewayUrl]);

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
        Agents
      </div>
      {agents.map(agent => (
        <SidebarItem
          key={agent.id}
          label={agent.name}
          badge={agent.status === 'busy' ? '...' : undefined}
          onClick={() => {}}
          icon={
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: STATUS_COLORS[agent.status],
              boxShadow: agent.status !== 'offline' ? `0 0 4px ${STATUS_COLORS[agent.status]}` : 'none',
            }} />
          }
        />
      ))}
    </div>
  );
}
