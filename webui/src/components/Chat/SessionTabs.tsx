import React from 'react'
import { Session } from '../../types'

interface SessionTabsProps {
  sessions: Session[]
  activeSessionId: string
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onCloseSession: (id: string) => void
}

export function SessionTabs({ 
  sessions, 
  activeSessionId, 
  onSelectSession, 
  onNewSession, 
  onCloseSession 
}: SessionTabsProps) {
  return (
    <div className="session-tabs">
      <div className="tabs-list">
        {sessions.map(session => (
          <div 
            key={session.id}
            className={`tab ${session.id === activeSessionId ? 'active' : ''}`}
            onClick={() => onSelectSession(session.id)}
          >
            <span className="tab-title">{session.title || 'New Chat'}</span>
            <button 
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onCloseSession(session.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="new-tab-btn" onClick={onNewSession}>
        + New
      </button>
    </div>
  )
}