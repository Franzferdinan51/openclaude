import './styles/theme.css'
import React from 'react';
import { GatewayProvider } from './context/GatewayContext';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { RightPanel } from './components/RightPanel/RightPanel';

function AppInner() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">🦆</span>
          <span className="header-title">DuckHive</span>
        </div>
        <div className="header-center">
          <span className="header-status">● Connected</span>
          <span className="header-model">MiniMax-M2.7</span>
        </div>
        <div className="header-right">
          <select
            className="theme-picker"
            value={theme}
            onChange={e => setTheme(e.target.value as 'claw' | 'knot' | 'dash')}
          >
            <option value="claw">Claw Theme</option>
            <option value="knot">Knot Theme</option>
            <option value="dash">Dash Theme</option>
          </select>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <button className="sidebar-item active">
              <span className="sidebar-icon">💬</span>
              <span>Agents</span>
            </button>
            <button className="sidebar-item">
              <span className="sidebar-icon">📋</span>
              <span>Tasks</span>
            </button>
            <button className="sidebar-item">
              <span className="sidebar-icon">👥</span>
              <span>Teams</span>
            </button>
            <button className="sidebar-item">
              <span className="sidebar-icon">📁</span>
              <span>Files</span>
            </button>
            <button className="sidebar-item">
              <span className="sidebar-icon">🔌</span>
              <span>MCP</span>
            </button>
            <button className="sidebar-item">
              <span className="sidebar-icon">🕐</span>
              <span>History</span>
            </button>
            <button className="sidebar-item">
              <span className="sidebar-icon">⚙️</span>
              <span>Settings</span>
            </button>
          </nav>
        </aside>

        {/* Main chat area */}
        <main className="main-area">
          {/* Session tabs */}
          <div className="session-tabs">
            <button className="tab active">Session 1</button>
            <button className="tab">+ New</button>
          </div>

          {/* Messages */}
          <div className="messages-area">
            <div className="message bot">
              <span className="message-avatar">🦆</span>
              <div className="message-content">
                <p>Welcome to DuckHive! How can I help you today?</p>
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div className="input-bar">
            <textarea
              className="input-field"
              placeholder="Type your message..."
              rows={1}
            />
            <button className="send-btn">Send</button>
          </div>
        </main>

        {/* Right panel — real data from gateway */}
        <RightPanel />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <GatewayProvider>
        <ChatProvider>
          <AppInner />
        </ChatProvider>
      </GatewayProvider>
    </ThemeProvider>
  );
}