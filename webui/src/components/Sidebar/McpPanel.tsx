import React, { useState, useEffect } from 'react';
import { SidebarItem } from './SidebarItem';

interface McpServer {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: number;
}

const DEFAULT_MCP: McpServer[] = [
  { id: 'browseros', name: 'BrowserOS MCP', status: 'connected', tools: 29 },
  { id: 'mesh', name: 'Mesh API', status: 'connected', tools: 12 },
  { id: 'openhue', name: 'OpenHue', status: 'disconnected', tools: 0 },
];

export function McpPanel() {
  const [servers, setServers] = useState<McpServer[]>(DEFAULT_MCP);

  useEffect(() => {
    fetch('http://localhost:18789/api/mcp/servers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setServers(data);
      })
      .catch(() => { /* use defaults */ });
  }, []);

  const STATUS_COLORS: Record<McpServer['status'], string> = {
    connected: '#22c55e',
    disconnected: '#6b7280',
    error: '#ef4444',
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
        MCP Servers
      </div>
      {servers.map(server => (
        <SidebarItem
          key={server.id}
          label={server.name}
          badge={server.status === 'connected' ? server.tools : undefined}
          onClick={() => {}}
          icon={
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: STATUS_COLORS[server.status],
              boxShadow: server.status === 'connected' ? `0 0 4px ${STATUS_COLORS[server.status]}` : 'none',
            }} />
          }
        />
      ))}
    </div>
  );
}
