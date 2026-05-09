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

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const renderMessage = (msg: Message) => {
    switch (msg.type) {
      case 'thinking':
        return <AssistantThinking key={msg.id} message={msg} />
      case 'tool_use':
        return <ToolUse key={msg.id} message={msg} />
      case 'tool_result':
        return <ToolResult key={msg.id} message={msg} />
      case 'progress':
        return <ProgressMessage key={msg.id} message={msg} />
      case 'error':
        return <ErrorMessage key={msg.id} message={msg} />
      case 'system':
        return <SystemMessage key={msg.id} message={msg} />
      case 'assistant':
        return <AssistantMessage key={msg.id} message={msg} />
      case 'user':
      default:
        return <UserMessage key={msg.id} message={msg} />
    }
  }

  return (
    <div className="message-list">
      {messages.map(renderMessage)}
      <div ref={endRef} />
    </div>
  )
}