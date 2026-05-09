import React from 'react'
import { Message } from '../../types'

interface UserMessageProps {
  message: Message
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="message user-message">
      <div className="message-content">{message.content}</div>
    </div>
  )
}