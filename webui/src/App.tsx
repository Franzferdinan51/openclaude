import './styles/globals.css'
import './styles/theme.css'
import React from 'react';
import { GatewayProvider } from './context/GatewayContext';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { RightPanel } from './components/RightPanel/RightPanel';
import { MessageList } from './components/Chat/MessageList';
import { InputBar } from './components/Chat/InputBar';
import { useChat } from './context/ChatContext';

const WELCOME_CARDS = [
  { icon: '💻', title: 'Code Review', desc: 'Review and refactor code' },
  { icon: '🔍', title: 'Research', desc: 'Deep dive any topic' },
  { icon: '🎮', title: 'Gaming', desc: 'Stardew, RuneScape, more' },
  { icon: '🌿', title: 'Grow Tips', desc: 'Plant health & environment' },
  { icon: '📊', title: 'Data Analysis', desc: 'Charts, stats, insights' },
  { icon: '🔧', title: 'Automation', desc: 'Build tools & workflows' },
];

const EXAMPLE_PROMPTS = [
  'Review my recent git commits',
  'Help me optimize this database query',
  'What is the weather in Huber Heights?',
  'Analyze my RuneScape portfolio',
  'Fix this bug in my React component',
];

function AppInner() {
  const { theme, setTheme } = useTheme();
  const { messages, sendMessage, isLoading, cancelLoading, clearMessages } = useChat();

  return (
    <div className="app-shell" data-theme={theme}>
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">🦆</span>
          <span className="header-title">DuckHive</span>
        </div>
        <div className="header-center">
          <span className="header-status">Connected</span>
          <span className="header-model">MiniMax-M2.7</span>
        </div>
        <div className="header-right">
          <select
            className="theme-picker"
            value={theme}
            onChange={e => setTheme(e.target.value as 'claw' | 'knot' | 'dash')}
          >
            <option value="claw">🦆 Claw</option>
            <option value="knot">🟣 Knot</option>
            <option value="dash">🔵 Dash</option>
          </select>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <button className="sidebar-item active">
              <span className="sidebar-icon">💬</span>
              <span>Chat</span>
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
          <div className="session-tabs">
            <button className="tab active">Session 1</button>
            <button className="tab">+ New</button>
          </div>

          {/* Messages with welcome content if empty */}
          <div className="messages-area">
            {messages.length === 0 ? (
              <div className="welcome-screen">
                <div className="welcome-icon">🦆</div>
                <div className="welcome-title">Welcome to DuckHive</div>
                <div className="welcome-subtitle">
                  Your AI coding agent with MiniMax-M2.7. Pick a prompt or type anything.
                </div>
                <div className="welcome-examples">
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      className="example-chip"
                      onClick={() => sendMessage(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="welcome-cards">
                  {WELCOME_CARDS.map((card, i) => (
                    <button
                      key={i}
                      className="welcome-card"
                      onClick={() => sendMessage(`Help me with ${card.title.toLowerCase()}: ${card.desc}`)}
                    >
                      <div className="welcome-card-icon">{card.icon}</div>
                      <div className="welcome-card-title">{card.title}</div>
                      <div className="welcome-card-desc">{card.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <MessageList messages={messages} />
            )}
          </div>

          <InputBar
            onSendMessage={sendMessage}
            isLoading={isLoading}
            onCancel={isLoading ? cancelLoading : undefined}
          />
        </main>

        <RightPanel onClearChat={clearMessages} />
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