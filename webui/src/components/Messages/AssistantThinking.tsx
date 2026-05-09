import React, { useState, useEffect } from 'react'
import { Message } from '../../types'

interface AssistantThinkingProps {
  message: Message
  showFull?: boolean
}

export function AssistantThinking({ message, showFull = false }: AssistantThinkingProps) {
  const [expanded, setExpanded] = useState(showFull)

  return (
    <div className="message thinking-message">
      <div className="thinking-header" onClick={() => setExpanded(!expanded)}>
        <span className="thinking-icon">∻</span>
        <span className="thinking-label">
          {expanded ? 'Thinking…' : 'Thinking'}
        </span>
        {!expanded && <span className="expand-hint">[Ctrl+O to expand]</span>}
      </div>
      {expanded && (
        <div className="thinking-content">
          {message.content}
        </div>
      )}
    </div>
  )
}