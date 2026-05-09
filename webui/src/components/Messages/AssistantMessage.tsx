import React from 'react'
import { Message } from '../../types'
import { MarkdownRenderer } from './MarkdownRenderer'

interface AssistantMessageProps {
  message: Message
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  return (
    <div className="message assistant-message">
      <div className="message-content">
        <MarkdownRenderer content={message.content} />
      </div>
    </div>
  )
}