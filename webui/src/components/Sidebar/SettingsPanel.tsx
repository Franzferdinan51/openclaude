import React, { useState, useEffect } from 'react';
import { SidebarItem } from './SidebarItem';
import { getSearchProvider, setSearchProvider, type SearchProviderStatus } from '../../api/gateway';

const SEARCH_PROVIDERS = [
  { value: 'auto', label: 'Auto' },
  { value: 'minimax', label: 'MiniMax CLI' },
  { value: 'native', label: 'Native' },
  { value: 'searxng', label: 'SearXNG' },
  { value: 'firecrawl', label: 'Firecrawl' },
  { value: 'ddg', label: 'DuckDuckGo' },
  { value: 'tavily', label: 'Tavily' },
  { value: 'exa', label: 'Exa' },
  { value: 'you', label: 'You.com' },
  { value: 'jina', label: 'Jina' },
  { value: 'custom', label: 'Custom' },
];

export function SettingsPanel() {
  const [settings, setSettings] = useState({
    theme: 'claw',
    notifications: true,
    autoUpdate: true,
  });

  const [searchStatus, setSearchStatus] = useState<SearchProviderStatus>({ configured: false });
  const [searxngUrl, setSearxngUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSearchProvider().then(setSearchStatus).catch(() => {});
  }, []);

  const handleSearchProviderChange = async (provider: string) => {
    setSaving(true)
    try {
      const result = await setSearchProvider(provider, provider === 'searxng' ? searxngUrl : undefined)
      setSearchStatus(result)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  };

  const currentProvider = searchStatus.configured ? searchStatus.provider ?? 'auto' : null;

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

      {/* Search Provider Section */}
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        color: '#6b7280',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        padding: '8px 12px 4px',
        marginTop: '8px',
      }}>
        Search Provider
      </div>

      <div style={{ padding: '0 12px 8px' }}>
        <select
          value={currentProvider ?? ''}
          onChange={e => handleSearchProviderChange(e.target.value)}
          disabled={saving}
          style={{
            width: '100%',
            padding: '4px 6px',
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          {!currentProvider && <option value="">Select a provider...</option>}
          {SEARCH_PROVIDERS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {currentProvider === 'searxng' && (
          <input
            type="text"
            placeholder="SearXNG URL (e.g. http://localhost:8080)"
            value={searxngUrl}
            onChange={e => setSearxngUrl(e.target.value)}
            onBlur={() => searxngUrl && handleSearchProviderChange('searxng')}
            style={{
              width: '100%',
              padding: '4px 6px',
              background: '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: '4px',
              fontSize: '12px',
              marginTop: '4px',
            }}
          />
        )}

        {currentProvider && (
          <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>
            ✓ {currentProvider === 'searxng' && searchStatus.searxngUrl ? `${searchStatus.searxngUrl}` : currentProvider}
          </div>
        )}
      </div>
    </div>
  );
}
