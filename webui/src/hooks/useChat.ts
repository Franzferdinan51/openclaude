import { useChat } from '../context/ChatContext';

/**
 * Hook for chat operations — send messages, manage sessions.
 */
export function useChatOps() {
  return useChat();
}