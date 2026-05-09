import React, { useState, useEffect } from 'react';

interface StatusBadgeProps {
  connected?: boolean;
  label?: string;
}

export function StatusBadge({ connected = false, label }: StatusBadgeProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: connected ? '#22c55e' : '#ef4444',
        boxShadow: connected ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
        animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
      }} />
      <span style={{
        fontSize: '11px',
        color: connected ? '#22c55e' : '#ef4444',
        fontWeight: 500,
        letterSpacing: '0.5px',
      }}>
        {label ?? (connected ? 'CONNECTED' : 'OFFLINE')}
      </span>
    </div>
  );
}
