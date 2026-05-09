import { useGateway } from '../context/GatewayContext';

/**
 * Hook for gateway connection state and data.
 * Returns health, agents, tools, MCP servers from GatewayContext.
 */
export function useGatewayConnection() {
  const ctx = useGateway();
  return ctx;
}