import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { StatusBadge } from './StatusBadge';
import { ModelSelector } from './ModelSelector';
import { ThemePicker } from './ThemePicker';
import { DUCKHIVE_API_BASE } from '../../api/gateway';

type Theme = 'claw' | 'knot' | 'dash';

interface HeaderProps {
  gatewayUrl?: string;
  initialTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  onModelChange?: (model: string) => void;
}

export function Header({
  gatewayUrl = DUCKHIVE_API_BASE,
  initialTheme = 'claw',
  onThemeChange,
  onModelChange,
}: HeaderProps) {
  const [connected, setConnected] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>('');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(3000) });
        setConnected(res.ok);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.model) setCurrentModel(data.model);
        }
      } catch {
        setConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, [gatewayUrl]);

  return (
    <header style={{
      height: '52px',
      background: 'linear-gradient(180deg, #16162a 0%, #0f0f1e 100%)',
      borderBottom: '1px solid rgba(255,215,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(12px)',
    }}>
      {/* Left: Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Logo />
      </div>

      {/* Center: Status */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <StatusBadge connected={connected} />
      </div>

      {/* Right: Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ModelSelector currentModel={currentModel} onModelChange={onModelChange} />
        <ThemePicker currentTheme={initialTheme} onThemeChange={onThemeChange} />
      </div>
    </header>
  );
}
