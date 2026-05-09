import React, { useState, useRef } from 'react'

interface InputBarProps {
  onSendMessage: (message: string, attachments?: File[]) => void
  disabled?: boolean
}

export function InputBar({ onSendMessage, disabled = false }: InputBarProps) {
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSendMessage(message, attachments)
      setMessage('')
      setAttachments([])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  return (
    <form className="input-bar" onSubmit={handleSubmit}>
      {attachments.length > 0 && (
        <div className="attachments-preview">
          {attachments.map((file, index) => (
            <div key={index} className="attachment">
              <span>{file.name}</span>
              <button type="button" onClick={() => removeAttachment(index)}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="input-row">
        <input
          type="file"
          id="attachment-input"
          multiple
          onChange={handleAttachment}
          style={{ display: 'none' }}
        />
        <label htmlFor="attachment-input" className="attach-btn">
          📎
        </label>
        <textarea
          ref={textareaRef}
          className="message-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          disabled={disabled}
          rows={1}
        />
        <button 
          type="submit" 
          className="send-btn"
          disabled={!message.trim() || disabled}
        >
          Send
        </button>
      </div>
    </form>
  )
}