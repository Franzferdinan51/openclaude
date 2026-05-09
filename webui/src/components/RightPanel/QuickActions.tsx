import React from 'react';
import { Command, MessageSquarePlus, RotateCcw, Trash2 } from 'lucide-react';
import { useGateway } from '../../context/GatewayContext';

interface QuickActionsProps {
  onClearChat?: () => void;
  onNewChat?: () => void;
  onOpenCommands?: () => void;
}

const QUICK_ACTIONS = [
  { label: 'New Chat', action: 'new-chat', color: '#f0b429', icon: MessageSquarePlus },
  { label: 'Refresh', action: 'refresh', color: '#06b6d4', icon: RotateCcw },
  { label: 'Commands', action: 'commands', color: '#8b5cf6', icon: Command },
  { label: 'Clear', action: 'clear', color: '#ef4444', icon: Trash2 },
];

export function QuickActions({ onClearChat, onNewChat, onOpenCommands }: QuickActionsProps) {
  const { refresh } = useGateway();
  const handleClick = (action: string) => {
    if (action === 'new-chat') {
      onNewChat?.();
    }
    if (action === 'clear' && onClearChat) {
      onClearChat();
    }
    if (action === 'refresh') {
      refresh();
    }
    if (action === 'commands') {
      onOpenCommands?.();
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
            <act.icon size={14} />
            {act.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SystemStatus() {
  const { connected, status } = useGateway();

  if (!connected) return null;

  return (
    <div className="system-status-bar">
      <div className="status-item">
        <span className="status-dot" style={{ background: '#22c55e' }} />
        <span>{status?.desktopControl?.configured ? 'Desktop ready' : 'Gateway'}</span>
      </div>
    </div>
  );
}
