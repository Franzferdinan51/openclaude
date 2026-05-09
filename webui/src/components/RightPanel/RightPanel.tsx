import React from 'react';
import { Bot, Coins, Hammer, MemoryStick, Network, type LucideIcon } from 'lucide-react';
import { ToolsPanel } from './ToolsPanel';
import { AgentsPanel } from './AgentsPanel';
import { McpPanel } from './McpPanel';
import { MemoryPanel } from './MemoryPanel';
import { CostPanel } from './CostPanel';
import { QuickActions, SystemStatus } from './QuickActions';

type Tab = 'tools' | 'agents' | 'mcp' | 'memory' | 'cost';

const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'tools', label: 'Tools', icon: Hammer },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'mcp', label: 'MCP', icon: Network },
  { id: 'memory', label: 'Memory', icon: MemoryStick },
  { id: 'cost', label: 'Cost', icon: Coins },
];

interface RightPanelProps {
  onClearChat?: () => void;
}

export function RightPanel({ onClearChat }: RightPanelProps) {
  const [activeTab, setActiveTab] = React.useState<Tab>('tools');

  return (
    <aside className="right-panel">
      <div className="rp-tabs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`rp-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              <Icon size={15} />
            </button>
          );
        })}
      </div>

      <div className="rp-content">
        {activeTab === 'tools' && <ToolsPanel />}
        {activeTab === 'agents' && <AgentsPanel />}
        {activeTab === 'mcp' && <McpPanel />}
        {activeTab === 'memory' && <MemoryPanel />}
        {activeTab === 'cost' && <CostPanel />}
      </div>

      <QuickActions onClearChat={onClearChat} />
      <SystemStatus />
    </aside>
  );
}
