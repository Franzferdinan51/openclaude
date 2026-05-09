import React from 'react';
import { ToolsPanel } from './ToolsPanel';
import { AgentsPanel } from './AgentsPanel';
import { McpPanel } from './McpPanel';
import { MemoryPanel } from './MemoryPanel';
import { CostPanel } from './CostPanel';
import { useGateway } from '../../context/GatewayContext';

type Tab = 'tools' | 'agents' | 'mcp' | 'memory' | 'cost';

export function RightPanel() {
  const [activeTab, setActiveTab] = React.useState<Tab>('tools');
  const { connected } = useGateway();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'tools', label: '🔧' },
    { id: 'agents', label: '🤖' },
    { id: 'mcp', label: '🔌' },
    { id: 'memory', label: '🧠' },
    { id: 'cost', label: '💰' },
  ];

  return (
    <aside className="right-panel" style={{ width: 320, flexShrink: 0 }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        flexShrink: 0,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #FFD700' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '15px',
              color: activeTab === tab.id ? '#FFD700' : '#6b7280',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Connection badge */}
      <div style={{
        padding: '6px 16px',
        fontSize: '11px',
        color: connected ? '#22c55e' : '#ef4444',
        background: connected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        borderBottom: '1px solid var(--color-border)',
        textAlign: 'center' as const,
        fontWeight: 500,
      }}>
        ● {connected ? 'Gateway Connected' : 'Gateway Offline'}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'tools' && <ToolsPanel />}
        {activeTab === 'agents' && <AgentsPanel />}
        {activeTab === 'mcp' && <McpPanel />}
        {activeTab === 'memory' && <MemoryPanel />}
        {activeTab === 'cost' && <CostPanel />}
      </div>
    </aside>
  );
}