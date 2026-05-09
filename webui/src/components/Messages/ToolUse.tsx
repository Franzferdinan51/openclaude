import React from 'react'
import { Message } from '../../types'

interface ToolUseProps {
  message: Message
}

export function ToolUse({ message }: ToolUseProps) {
  return (
    <div className="message tool-use-message">
      <div className="tool-use-header">
        <span className="tool-name">{message.toolName || 'Tool'}</span>
        {message.toolInput && (
          <span className="tool-args">
            ({JSON.stringify(message.toolInput, null, 2)})
          </span>
        )}
      </div>
    </div>
  )
}