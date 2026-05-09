import React from 'react'
import { Message } from '../../types'

interface ErrorMessageProps {
  message: Message
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="message error-message">
      <span className="error-icon">✗</span>
      <span className="message-content">{message.content}</span>
    </div>
  )
}