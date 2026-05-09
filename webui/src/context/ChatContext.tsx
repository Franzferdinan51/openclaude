import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { sendChat, createSession, listSessions, getSession, type ChatMessage, type SessionInfo } from '../api/gateway';

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface ChatContextValue {
  sessions: SessionInfo[];
  activeSession: string | null;
  activeRunId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  createSession: (title?: string) => Promise<string | null>;
  setActiveSession: (id: string) => void;
  sendMessage: (content: string) => Promise<void>;
  cancelLoading: () => void;
  clearMessages: () => void;
  loadSessions: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue>({
  sessions: [],
  activeSession: null,
  activeRunId: null,
  messages: [],
  isLoading: false,
  createSession: async () => null,
  setActiveSession: () => {},
  sendMessage: async () => {},
  cancelLoading: () => {},
  clearMessages: () => {},
  loadSessions: async () => {},
});

export function ChatProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSession, setActiveSessionState] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // FIX: useRef to always get current messages (avoids stale closure in sendMessage)
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const loadSessions = useCallback(async () => {
    const list = await listSessions();
    setSessions(list);
  }, []);

  const createNewSession = useCallback(async (title?: string): Promise<string | null> => {
    const s = await createSession(title);
    if (s) {
      setSessions(prev => [s, ...prev]);
      setActiveSessionState(s.id);
      setActiveRunId(s.runId ?? null);
      setMessages([]);
    }
    return s?.id ?? null;
  }, []);

  const setActiveSession = useCallback(async (id: string) => {
    setActiveSessionState(id);
    const data = await getSession(id);
    setMessages(data?.messages ?? []);
    setActiveRunId(data?.runId ?? null);
  }, []);

  const cancelLoading = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsLoading(false);
  }, []);

  // FIX: use messagesRef.current instead of stale `messages` from closure
  const sendMessage = useCallback(async (content: string) => {
    if (isLoading) return;
    
    const userMsg: ChatMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const allMessages = [...messagesRef.current, userMsg];

    try {
      const reply = await sendChat(allMessages, { stream: false, sessionId: activeSession ?? undefined });

      if (reply?.choices?.[0]?.message) {
        const assistantMsg = reply.choices[0].message as ChatMessage;
        setMessages(prev => [...prev, assistantMsg]);
        setActiveRunId(reply.runId ?? reply.session?.runId ?? null);
        if (reply.session) {
          setActiveSessionState(reply.session.id);
          setSessions(prev => {
            const without = prev.filter(session => session.id !== reply.session!.id);
            return [reply.session!, ...without];
          });
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Chat error:', error);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [activeSession, isLoading]); // depends on isLoading to prevent concurrent sends

  const clearMessages = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setMessages([]);
    setIsLoading(false);
  }, []);

  return (
    <ChatContext.Provider value={{
      sessions, activeSession, activeRunId, messages, isLoading,
      createSession: createNewSession, setActiveSession, sendMessage, cancelLoading, clearMessages, loadSessions,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
