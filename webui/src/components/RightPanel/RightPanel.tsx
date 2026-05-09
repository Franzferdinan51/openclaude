import React from 'react';
import { ToolsPanel } from './ToolsPanel';
import { AgentsPanel } from './AgentsPanel';
import { McpPanel } from './McpPanel';
import { MemoryPanel } from './MemoryPanel';
import { CostPanel } from './CostPanel';
import { useGateway } from '../../context/GatewayContext';

type Tab = 'tools' | 'agents' | 'mcp' | 'memory' | 'cost';

const tabs: { id: Tab; label: string }[] = [
  { id: 'tools', label: '🔧' },
  { id: 'agents', label: '🤖' },
  { id: 'mcp', label: '🔌' },
  { id: 'memory', label: '🧠' },
  { id: 'cost', label: '💰' },
];

export function RightPanel() {
  const [activeTab, setActiveTab] = React.useState<Tab>('tools');
  const { connected } = useGateway();

  return (
    <aside className="right-panel">
      {/* Tab bar */}
      <div className="rp-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`rp-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Connection badge */}
      <div className={`connection-badge ${connected ? '' : 'offline'}`}>
        {connected ? 'Gateway Connected' : 'Gateway Offline'}
      </div>

      {/* Tab content */}
      <div className="rp-content">
        {activeTab === 'tools' && <ToolsPanel />}
        {activeTab === 'agents' && <AgentsPanel />}
        {activeTab === 'mcp' && <McpPanel />}
        {activeTab === 'memory' && <MemoryPanel />}
        {activeTab === 'cost' && <CostPanel />}
      </div>
    </aside>
  );
}
