import React from 'react';
import { useGateway } from '../../context/GatewayContext';

interface QuickActionsProps {
  onClearChat?: () => void;
}

const QUICK_ACTIONS = [
  { label: '💬 New Chat', action: 'new-chat', color: '#f0b429' },
  { label: '🧠 Memory', action: 'memory', color: '#06b6d4' },
  { label: '⚡ Commands', action: 'commands', color: '#8b5cf6' },
  { label: '🗑️ Clear', action: 'clear', color: '#ef4444' },
];

export function QuickActions({ onClearChat }: QuickActionsProps) {
  const handleClick = (action: string) => {
    if (action === 'clear' && onClearChat) {
      onClearChat();
    }
  };

  return (
    <div className="rp-section" style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: 8 }}>
      <div className="rp-section-title">Quick Actions</div>
      <div className="quick-actions">
        {QUICK_ACTIONS.map(act => (
          <button
            key={act.action}
            className="quick-action-btn"
            onClick={() => handleClick(act.action)}
            style={{ '--accent': act.color } as React.CSSProperties}
          >
            {act.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SystemStatus() {
  const { connected } = useGateway();

  if (!connected) return null;

  return (
    <div className="system-status-bar">
      <div className="status-item">
        <span className="status-dot" style={{ background: '#22c55e' }} />
        <span>Gateway</span>
      </div>
    </div>
  );
}