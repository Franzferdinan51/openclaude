import React, { useState } from 'react';

type Theme = 'claw' | 'knot' | 'dash';

interface ThemePickerProps {
  currentTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

const THEMES: { id: Theme; label: string; preview: string }[] = [
  { id: 'claw', label: 'Claw', preview: '#FFD700' },
  { id: 'knot', label: 'Knot', preview: '#8b5cf6' },
  { id: 'dash', label: 'Dash', preview: '#06b6d4' },
];

export function ThemePicker({ currentTheme = 'claw', onThemeChange }: ThemePickerProps) {
  const [selected, setSelected] = useState<Theme>(currentTheme);

  const handleSelect = (theme: Theme) => {
    setSelected(theme);
    onThemeChange?.(theme);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '8px',
      padding: '3px',
    }}>
      {THEMES.map(theme => (
        <button
          key={theme.id}
          onClick={() => handleSelect(theme.id)}
          title={theme.label}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '5px',
            border: 'none',
            cursor: 'pointer',
            background: selected === theme.id ? 'rgba(255,255,255,0.1)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            boxShadow: selected === theme.id ? `0 0 8px ${theme.preview}40` : 'none',
          }}
          onMouseEnter={e => {
            if (selected !== theme.id) {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
            }
          }}
          onMouseLeave={e => {
            if (selected !== theme.id) {
              (e.target as HTMLButtonElement).style.background = 'transparent';
            }
          }}
        >
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '3px',
            background: theme.preview,
            boxShadow: selected === theme.id ? `0 0 6px ${theme.preview}` : 'none',
          }} />
        </button>
      ))}
    </div>
  );
}
