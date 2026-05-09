import React, { useRef, useEffect } from 'react'
import { Message } from '../../types'
import { UserMessage } from '../Messages/UserMessage'
import { AssistantMessage } from '../Messages/AssistantMessage'
import { AssistantThinking } from '../Messages/AssistantThinking'
import { ToolUse } from '../Messages/ToolUse'
import { ToolResult } from '../Messages/ToolResult'
import { SystemMessage } from '../Messages/SystemMessage'
import { ProgressMessage } from '../Messages/ProgressMessage'
import { ErrorMessage } from '../Messages/ErrorMessage'

// Accept both Message (with id/timestamp) and ChatMessage-like objects (from API)
interface AnyMessage {
  id?: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp?: number
  type?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
  isLoading?: boolean
}

interface MessageListProps {
  messages: AnyMessage[]
}

function ensureId(msg: AnyMessage): string {
  return msg.id || `${msg.role}-${msg.timestamp || Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function MessageList({ messages }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="welcome-message">
        <div className="welcome-icon">🦆</div>
        <div className="welcome-title">Welcome to DuckHive</div>
        <div className="welcome-subtitle">
          Your AI coding agent with MiniMax-M2.7. Type a message to get started.
        </div>
      </div>
    )
  }

  const renderMessage = (msg: AnyMessage) => {
    const msgWithId = { ...msg, id: ensureId(msg) } as Message
    const displayType = msg.type || (msg.role === 'user' ? 'user' : 'assistant')
    
    switch (displayType) {
      case 'thinking':
        return <AssistantThinking key={msgWithId.id} message={msgWithId} />
      case 'tool_use':
        return <ToolUse key={msgWithId.id} message={msgWithId} />
      case 'tool_result':
        return <ToolResult key={msgWithId.id} message={msgWithId} />
      case 'progress':
        return <ProgressMessage key={msgWithId.id} message={msgWithId} />
      case 'error':
        return <ErrorMessage key={msgWithId.id} message={msgWithId} />
      case 'system':
        return <SystemMessage key={msgWithId.id} message={msgWithId} />
      case 'user':
        return <UserMessage key={msgWithId.id} message={msgWithId} />
      case 'assistant':
      default:
        return <AssistantMessage key={msgWithId.id} message={msgWithId} />
    }
  }

  return (
    <div className="message-list">
      {messages.map(renderMessage)}
      <div ref={endRef} />
    </div>
  )
}