import React from 'react';

interface SidebarItemProps {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string | number;
  onClick?: () => void;
}

export function SidebarItem({ icon, label, active = false, badge, onClick }: SidebarItemProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: '8px',
        background: active ? 'rgba(255,215,0,0.1)' : 'transparent',
        borderLeft: active ? '2px solid #FFD700' : '2px solid transparent',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        color: active ? '#FFD700' : '#a0a0b0',
        fontSize: '13px',
        fontWeight: active ? 500 : 400,
      }}
      onMouseEnter={e => {
        if (!active && onClick) {
          (e.target as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.target as HTMLDivElement).style.background = 'transparent';
        }
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center', opacity: active ? 1 : 0.7 }}>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && (
        <span style={{
          background: 'rgba(255,215,0,0.2)',
          color: '#FFD700',
          fontSize: '10px',
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: '10px',
          minWidth: '18px',
          textAlign: 'center',
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}
