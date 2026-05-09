import React, { useState } from 'react';
import { SidebarItem } from './SidebarItem';

interface TeamInfo {
  id: string;
  name: string;
  agents: number;
  status: 'active' | 'idle' | 'stopped';
}

const DEFAULT_TEAMS: TeamInfo[] = [
  { id: 'research', name: 'Research Team', agents: 3, status: 'idle' },
  { id: 'build', name: 'Build Team', agents: 4, status: 'idle' },
  { id: 'council', name: 'Council Team', agents: 46, status: 'active' },
  { id: 'debug', name: 'Debug Team', agents: 2, status: 'idle' },
];

const STATUS_COLORS: Record<TeamInfo['status'], string> = {
  active: '#22c55e',
  idle: '#f59e0b',
  stopped: '#6b7280',
};

export function TeamsPanel() {
  const [teams] = useState<TeamInfo[]>(DEFAULT_TEAMS);

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
        Teams
      </div>
      {teams.map(team => (
        <SidebarItem
          key={team.id}
          label={team.name}
          badge={team.agents}
          onClick={() => {}}
          icon={
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: STATUS_COLORS[team.status],
            }} />
          }
        />
      ))}
    </div>
  );
}
