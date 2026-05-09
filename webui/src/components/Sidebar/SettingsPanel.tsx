import React, { useState } from 'react';
import { SidebarItem } from './SidebarItem';

export function SettingsPanel() {
  const [settings, setSettings] = useState({
    theme: 'claw',
    notifications: true,
    autoUpdate: true,
  });

  return (
    <div>
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        color: '#6b7280',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        padding: '8px 12px 4px',
      }}>
        Settings
      </div>
      <SidebarItem
        label="Theme"
        onClick={() => {}}
        icon={<span>🎨</span>}
      />
      <SidebarItem
        label="Notifications"
        onClick={() => setSettings(s => ({ ...s, notifications: !s.notifications }))}
        icon={<span>🔔</span>}
      />
      <SidebarItem
        label="Auto Update"
        onClick={() => setSettings(s => ({ ...s, autoUpdate: !s.autoUpdate }))}
        icon={<span>🔄</span>}
      />
    </div>
  );
}
