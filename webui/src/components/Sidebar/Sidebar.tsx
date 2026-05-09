import React, { useState } from 'react';
import { SidebarItem } from './SidebarItem';
import { AgentsPanel } from './AgentsPanel';
import { TasksPanel } from './TasksPanel';
import { TeamsPanel } from './TeamsPanel';
import { FilesPanel } from './FilesPanel';
import { McpPanel } from './McpPanel';
import { HistoryPanel } from './HistoryPanel';
import { SettingsPanel } from './SettingsPanel';
import { DUCKHIVE_API_BASE } from '../../api/gateway';

interface SidebarProps {
  gatewayUrl?: string;
  width?: number;
}

type NavSection = 'agents' | 'tasks' | 'teams' | 'files' | 'mcp' | 'history' | 'settings';

const NAV_ITEMS: { id: NavSection; label: string; icon: string }[] = [
  { id: 'agents', label: 'Agents', icon: 'A' },
  { id: 'tasks', label: 'Tasks', icon: 'R' },
  { id: 'teams', label: 'Teams', icon: 'T' },
  { id: 'files', label: 'Files', icon: 'F' },
  { id: 'mcp', label: 'MCP', icon: 'M' },
  { id: 'history', label: 'History', icon: 'H' },
  { id: 'settings', label: 'Settings', icon: 'S' },
];

export function Sidebar({ gatewayUrl = DUCKHIVE_API_BASE, width = 220 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('agents');

  if (collapsed) {
    return (
      <aside style={{
        width: '48px',
        background: '#0d0d1a',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '4px',
      }}>
        {NAV_ITEMS.map(item => (
          <div
            key={item.id}
            onClick={() => { setCollapsed(false); setActiveSection(item.id); }}
            title={item.label}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: '8px',
              fontSize: '18px',
              background: activeSection === item.id ? 'rgba(255,215,0,0.1)' : 'transparent',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              if (activeSection !== item.id) {
                (e.target as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)';
              }
            }}
            onMouseLeave={e => {
              if (activeSection !== item.id) {
                (e.target as HTMLDivElement).style.background = 'transparent';
              }
            }}
          >
            {item.icon}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div
          onClick={() => setCollapsed(false)}
          title="Expand"
          style={{
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderRadius: '8px',
            fontSize: '16px',
          }}
          onMouseEnter={e => { (e.target as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={e => { (e.target as HTMLDivElement).style.background = 'transparent'; }}
        >
          ▶️
        </div>
      </aside>
    );
  }

  return (
    <aside style={{
      width: `${width}px`,
      minWidth: `${width}px`,
      background: '#0d0d1a',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Nav tabs */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '12px 8px 8px',
      }}>
        {NAV_ITEMS.map(item => (
          <SidebarItem
            key={item.id}
            label={item.label}
            active={activeSection === item.id}
            onClick={() => setActiveSection(item.id)}
            icon={<span style={{ fontSize: '14px' }}>{item.icon}</span>}
          />
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

      {/* Section content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '12px' }}>
        {activeSection === 'agents' && <AgentsPanel gatewayUrl={gatewayUrl} />}
        {activeSection === 'tasks' && <TasksPanel />}
        {activeSection === 'teams' && <TeamsPanel />}
        {activeSection === 'files' && <FilesPanel />}
        {activeSection === 'mcp' && <McpPanel />}
        {activeSection === 'history' && <HistoryPanel gatewayUrl={gatewayUrl} />}
        {activeSection === 'settings' && <SettingsPanel />}
      </div>

      {/* Collapse button */}
      <div style={{
        padding: '8px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div
          onClick={() => setCollapsed(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px',
            cursor: 'pointer',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#6b7280',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.target as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)';
            (e.target as HTMLDivElement).style.color = '#a0a0b0';
          }}
          onMouseLeave={e => {
            (e.target as HTMLDivElement).style.background = 'transparent';
            (e.target as HTMLDivElement).style.color = '#6b7280';
          }}
        >
          ◀️ Collapse
        </div>
      </div>
    </aside>
  );
}
