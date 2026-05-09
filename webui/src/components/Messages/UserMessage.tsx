import React from 'react'
import { Message } from '../../types'

interface UserMessageProps {
  message: Message
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="message user-message">
      <span className="message-avatar">You</span>
      <div className="message-bubble">
        <p>{message.content}</p>
      </div>
    </div>
  )
}
