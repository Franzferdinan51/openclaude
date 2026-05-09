import React from 'react'
import { Message } from '../../types'

interface SystemMessageProps {
  message: Message
}

export function SystemMessage({ message }: SystemMessageProps) {
  const level = (message as any).level || 'info'
  const levelClass = level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info'
  
  return (
    <div className={`message system-message ${levelClass}`}>
      <span className="system-icon">●</span>
      <span className="message-content">{message.content}</span>
    </div>
  )
}