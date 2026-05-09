import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Message, Session } from '../../types'
import { SessionTabs } from './SessionTabs'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'

const DASHBOARD_BASE = 'http://localhost:3001'
const API_ENDPOINT = `${DASHBOARD_BASE}/api/chat`

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function createEmptySession(): Session {
  return {
    id: generateId(),
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

interface ChatAreaProps {
  className?: string
}

export function ChatArea({ className = '' }: ChatAreaProps) {
  const [sessions, setSessions] = useState<Session[]>([createEmptySession()])
  const [activeSessionId, setActiveSessionId] = useState(sessions[0].id)
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]

  const updateSession = useCallback((id: string, updater: (s: Session) => Session) => {
    setSessions(prev => prev.map(s => s.id === id ? updater(s) : s))
  }, [])

  const sendMessage = async (content: string, attachments?: File[]) => {
    if (!content.trim() || isLoading) return

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      type: 'user'
    }

    // Add user message immediately
    updateSession(activeSessionId, s => ({
      ...s,
      messages: [...s.messages, userMessage],
      updatedAt: Date.now()
    }))

    setIsLoading(true)

    // Add progress indicator
    const progressMsg: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      type: 'progress'
    }
    updateSession(activeSessionId, s => ({
      ...s,
      messages: [...s.messages, progressMsg]
    }))

    // Track assistant message for incremental updates
    let assistantMessageId = progressMsg.id
    let accumulatedContent = ''
    const CHUNK_BATCH_MS = 50 // Only re-render every 50ms to avoid flooding React
    let lastBatchUpdate = Date.now()
    let pendingContent = ''

    try {
      // Build messages for API
      const currentMessages = sessions.find(s => s.id === activeSessionId)?.messages || []
      const apiMessages = currentMessages
        .filter(m => m.role !== 'user' || m.id === userMessage.id)
        .filter(m => m.type !== 'tool_result')
        .map(m => ({ role: m.role, content: m.content }))

      // Replace progress msg with actual assistant msg
      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'assistant'
      }
      assistantMessageId = assistantMsg.id

      updateSession(activeSessionId, s => ({
        ...s,
        messages: [
          ...s.messages.filter(m => m.id !== progressMsg.id),
          assistantMsg
        ]
      }))

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          model: 'MiniMax-M2.7',
          stream: false // Use non-streaming for simplicity - the API doesn't reliably stream
        }),
        signal: abortController.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      // Update with the actual response
      const responseContent = data.choices?.[0]?.message?.content || 'No response'
      accumulatedContent = responseContent

      updateSession(activeSessionId, s => ({
        ...s,
        messages: s.messages.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: responseContent }
            : m
        )
      }))

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Cancelled - just remove the progress/assistant message
        updateSession(activeSessionId, s => ({
          ...s,
          messages: s.messages.filter(m => m.id !== assistantMessageId && m.id !== progressMsg.id)
        }))
      } else {
        const errorMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Request failed'}`,
          timestamp: Date.now(),
          type: 'error'
        }
        updateSession(activeSessionId, s => ({
          ...s,
          messages: s.messages.map(m =>
            m.id === assistantMessageId || m.id === progressMsg.id ? errorMsg : m
          )
        }))
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }

  const handleNewSession = () => {
    const newSess = createEmptySession()
    setSessions(prev => [...prev, newSess])
    setActiveSessionId(newSess.id)
  }

  const handleCloseSession = (id: string) => {
    if (sessions.length === 1) return
    const index = sessions.findIndex(s => s.id === id)
    const newSessions = sessions.filter(s => s.id !== id)
    setSessions(newSessions)
    if (activeSessionId === id) {
      const newIndex = Math.min(index, newSessions.length - 1)
      setActiveSessionId(newSessions[newIndex].id)
    }
  }

  return (
    <div className={`chat-area ${className}`}>
      <SessionTabs
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
        onCloseSession={handleCloseSession}
      />
      <MessageList messages={activeSession.messages} />
      <InputBar 
        onSendMessage={sendMessage} 
        onCancel={isLoading ? handleCancel : undefined}
        disabled={false} // Always allow typing - we handle loading state with cancel
        isLoading={isLoading}
      />
    </div>
  )
}
