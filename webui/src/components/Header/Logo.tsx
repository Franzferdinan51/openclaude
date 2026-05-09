import React from 'react';

export function Logo() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      userSelect: 'none',
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"
          fill="#FFD700"
        />
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
          stroke="#FFD700"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="8" cy="10" r="1.5" fill="#FFD700" />
        <circle cx="16" cy="10" r="1.5" fill="#FFD700" />
        <path d="M8 15 Q12 18 16 15" stroke="#FFD700" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <span style={{
        fontSize: '16px',
        fontWeight: 700,
        color: '#FFD700',
        letterSpacing: '1px',
      }}>
        DuckHive
      </span>
    </div>
  );
}
