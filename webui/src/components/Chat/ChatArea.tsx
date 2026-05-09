import React, { useState, useEffect, useCallback } from 'react'
import { Message, Session } from '../../types'
import { SessionTabs } from './SessionTabs'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'

const GATEWAY_URL = 'http://localhost:18789'
const API_ENDPOINT = `${GATEWAY_URL}/v1/chat/completions`

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
  const [thinkingMessage, setThinkingMessage] = useState<Message | null>(null)

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]

  const updateSession = useCallback((id: string, updater: (s: Session) => Session) => {
    setSessions(prev => prev.map(s => s.id === id ? updater(s) : s))
  }, [])

  const sendMessage = async (content: string, attachments?: File[]) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      type: 'user'
    }

    updateSession(activeSessionId, s => ({
      ...s,
      messages: [...s.messages, userMessage],
      updatedAt: Date.now()
    }))

    setIsLoading(true)

    // Add a thinking/progress indicator
    const progressMsg: Message = {
      id: generateId(),
      role: 'assistant',
      content: 'Thinking…',
      timestamp: Date.now(),
      type: 'progress'
    }
    updateSession(activeSessionId, s => ({
      ...s,
      messages: [...s.messages, progressMsg]
    }))

    try {
      // Build messages for API
      const apiMessages = activeSession.messages
        .filter(m => m.role !== 'tool' && m.type !== 'tool_result')
        .map(m => ({ role: m.role, content: m.content }))
        .concat([{ role: 'user' as const, content }])

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'minimax-portal/MiniMax-M2.7',
          messages: apiMessages,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Remove progress message
      updateSession(activeSessionId, s => ({
        ...s,
        messages: s.messages.filter(m => m.id !== progressMsg.id)
      }))

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'assistant'
      }

      // Add empty assistant message
      updateSession(activeSessionId, s => ({
        ...s,
        messages: [...s.messages, assistantMessage]
      }))

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                assistantMessage.content += content
                updateSession(activeSessionId, s => ({
                  ...s,
                  messages: s.messages.map(m => 
                    m.id === assistantMessage.id ? { ...assistantMessage } : m
                  )
                }))
              }
            } catch {}
          }
        }
      }

    } catch (error) {
      // Remove progress message on error
      updateSession(activeSessionId, s => ({
        ...s,
        messages: s.messages.filter(m => m.id !== progressMsg.id)
      }))

      const errorMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now(),
        type: 'error'
      }
      updateSession(activeSessionId, s => ({
        ...s,
        messages: [...s.messages, errorMsg]
      }))
    } finally {
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
        disabled={isLoading}
      />
    </div>
  )
}