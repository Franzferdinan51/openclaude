import React from 'react'
import { Message } from '../../types'

interface ProgressMessageProps {
  message: Message
}

export function ProgressMessage({ message }: ProgressMessageProps) {
  return (
    <div className="message progress-message">
      <div className="progress-indicator">
        <span className="spinner">◐</span>
        <span className="progress-text">{message.content}</span>
      </div>
    </div>
  )
}