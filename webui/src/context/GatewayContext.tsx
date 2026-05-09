import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getHealth, getAgents, getTools, getMcpServers, type GatewayHealth, type AgentInfo, type ToolInfo, type McpServerInfo } from '../api/gateway';

interface GatewayContextValue {
  connected: boolean;
  health: GatewayHealth | null;
  agents: AgentInfo[];
  tools: ToolInfo[];
  mcpServers: McpServerInfo[];
  refresh: () => void;
}

const GatewayContext = createContext<GatewayContextValue>({
  connected: false,
  health: null,
  agents: [],
  tools: [],
  mcpServers: [],
  refresh: () => {},
});

export function GatewayProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerInfo[]>([]);

  const refresh = useCallback(async () => {
    const [h, a, t, m] = await Promise.all([
      getHealth(),
      getAgents(),
      getTools(),
      getMcpServers(),
    ]);
    setHealth(h);
    setAgents(a);
    setTools(t);
    setMcpServers(m);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const connected = health?.status !== 'offline';

  return (
    <GatewayContext.Provider value={{ connected, health, agents, tools, mcpServers, refresh }}>
      {children}
    </GatewayContext.Provider>
  );
}

export function useGateway() {
  return useContext(GatewayContext);
}