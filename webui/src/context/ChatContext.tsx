import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { sendChat, createSession, listSessions, getSession, type ChatMessage, type SessionInfo } from '../api/gateway';
// Simple ID generator (no external dep needed)
function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface ChatContextValue {
  sessions: SessionInfo[];
  activeSession: string | null;
  messages: ChatMessage[];
  loading: boolean;
  createSession: (title?: string) => Promise<string | null>;
  setActiveSession: (id: string) => void;
  sendMessage: (content: string) => Promise<void>;
  loadSessions: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue>({
  sessions: [],
  activeSession: null,
  messages: [],
  loading: false,
  createSession: async () => null,
  setActiveSession: () => {},
  sendMessage: async () => {},
  loadSessions: async () => {},
});

export function ChatProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSession, setActiveSessionState] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    const list = await listSessions();
    setSessions(list);
  }, []);

  const createNewSession = useCallback(async (title?: string): Promise<string | null> => {
    const s = await createSession(title);
    if (s) {
      setSessions(prev => [s, ...prev]);
      setActiveSessionState(s.id);
      setMessages([]);
    }
    return s?.id ?? null;
  }, []);

  const setActiveSession = useCallback(async (id: string) => {
    setActiveSessionState(id);
    const data = await getSession(id);
    setMessages(data?.messages ?? []);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const allMessages = [...messages, userMsg];
    const reply = await sendChat(allMessages);

    setLoading(false);
    if (reply?.choices?.[0]?.message) {
      const assistantMsg = reply.choices[0].message as ChatMessage;
      setMessages(prev => [...prev, assistantMsg]);
    }
  }, [messages]);

  return (
    <ChatContext.Provider value={{
      sessions, activeSession, messages, loading,
      createSession: createNewSession, setActiveSession, sendMessage, loadSessions,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}