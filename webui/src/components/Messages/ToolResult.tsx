import React from 'react'
import { Message } from '../../types'

interface ToolResultProps {
  message: Message
}

export function ToolResult({ message }: ToolResultProps) {
  return (
    <div className="message tool-result-message">
      <div className="tool-result-header">Result</div>
      <pre className="tool-result-content">{message.toolResult || message.content}</pre>
    </div>
  )
}