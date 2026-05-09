import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  getAgents,
  getHealth,
  getMcpServers,
  getRunEvents,
  getSystemStatus,
  getTools,
  listRuns,
  runAction,
  subscribeToEvents,
  type AgentInfo,
  type AgentRun,
  type AgentRunEvent,
  type GatewayHealth,
  type McpServerInfo,
  type SystemStatus,
  type ToolInfo,
} from '../api/gateway';

interface GatewayContextValue {
  connected: boolean;
  health: GatewayHealth | null;
  agents: AgentInfo[];
  tools: ToolInfo[];
  mcpServers: McpServerInfo[];
  runs: AgentRun[];
  eventsByRun: Record<string, AgentRunEvent[]>;
  status: SystemStatus | null;
  selectedRunId: string | null;
  selectedRun: AgentRun | null;
  selectRun: (runId: string | null) => void;
  controlRun: (runId: string, action: 'pause' | 'resume' | 'stop' | 'approve' | 'recover') => Promise<void>;
  refresh: () => void;
}

const GatewayContext = createContext<GatewayContextValue>({
  connected: false,
  health: null,
  agents: [],
  tools: [],
  mcpServers: [],
  runs: [],
  eventsByRun: {},
  status: null,
  selectedRunId: null,
  selectedRun: null,
  selectRun: () => {},
  controlRun: async () => {},
  refresh: () => {},
});

export function GatewayProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerInfo[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [eventsByRun, setEventsByRun] = useState<Record<string, AgentRunEvent[]>>({});
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [h, a, t, m, r, s] = await Promise.all([
      getHealth(),
      getAgents(),
      getTools(),
      getMcpServers(),
      listRuns(),
      getSystemStatus(),
    ]);
    setHealth(h);
    setAgents(a);
    setTools(t);
    setMcpServers(m);
    setRuns(r);
    setStatus(s);
    setSelectedRunId(prev => prev ?? r[0]?.id ?? null);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    return subscribeToEvents(
      event => {
        setEventsByRun(prev => ({
          ...prev,
          [event.runId]: [...(prev[event.runId] ?? []), event].slice(-100),
        }));
        void listRuns().then(next => {
          setRuns(next);
          if (!selectedRunId && next[0]) setSelectedRunId(next[0].id);
        });
      },
      snapshot => {
        setRuns(snapshot);
        setSelectedRunId(prev => prev ?? snapshot[0]?.id ?? null);
      },
    );
  }, []);

  useEffect(() => {
    if (!selectedRunId || eventsByRun[selectedRunId]) return;
    void getRunEvents(selectedRunId).then(events => {
      setEventsByRun(prev => ({ ...prev, [selectedRunId]: events }));
    });
  }, [selectedRunId, eventsByRun]);

  const controlRun = useCallback(async (
    runId: string,
    action: 'pause' | 'resume' | 'stop' | 'approve' | 'recover',
  ) => {
    const updated = await runAction(runId, action);
    const next = await listRuns();
    setRuns(updated ? next.map(run => run.id === updated.id ? updated : run) : next);
  }, []);

  const connected = health?.status !== 'offline';
  const selectedRun = runs.find(run => run.id === selectedRunId) ?? null;

  return (
    <GatewayContext.Provider value={{
      connected,
      health,
      agents,
      tools,
      mcpServers,
      runs,
      eventsByRun,
      status,
      selectedRunId,
      selectedRun,
      selectRun: setSelectedRunId,
      controlRun,
      refresh,
    }}>
      {children}
    </GatewayContext.Provider>
  );
}

export function useGateway() {
  return useContext(GatewayContext);
}
