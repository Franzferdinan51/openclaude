import React, { useState, useEffect } from 'react';

export interface ModelOption {
  id: string;
  label: string;
  provider?: string;
}

interface ModelSelectorProps {
  currentModel?: string;
  onModelChange?: (model: string) => void;
}

const DEFAULT_MODELS: ModelOption[] = [
  { id: 'minimax/minimax-m2.7', label: 'MiniMax M2.7', provider: 'MiniMax' },
  { id: 'kimi/kimi-k2.5', label: 'Kimi K2.5', provider: 'Moonshot' },
  { id: 'openai/gpt-5.4', label: 'GPT-5.4', provider: 'OpenAI' },
  { id: 'qwen/qwen3.6-plus', label: 'Qwen 3.6+', provider: 'Qwen' },
  { id: 'google/gemma-4-31b', label: 'Gemma 4 31B', provider: 'Google' },
  { id: 'lmstudio/local', label: 'Local (LM Studio)', provider: 'Local' },
];

export function ModelSelector({ currentModel, onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelOption[]>(DEFAULT_MODELS);
  const [selected, setSelected] = useState(currentModel ?? DEFAULT_MODELS[0].id);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Try to load from OpenClaw gateway
    fetch('http://localhost:18789/v1/models')
      .then(r => r.json())
      .then(data => {
        if (data?.data && Array.isArray(data.data)) {
          const fetched: ModelOption[] = data.data.map((m: { id: string; name?: string; provider?: string }) => ({
            id: m.id,
            label: m.name ?? m.id,
            provider: m.provider,
          }));
          if (fetched.length > 0) setModels(fetched);
        }
      })
      .catch(() => { /* use defaults */ });
  }, []);

  const handleSelect = (modelId: string) => {
    setSelected(modelId);
    setOpen(false);
    onModelChange?.(modelId);
  };

  const currentLabel = models.find(m => m.id === selected)?.label ?? selected;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,215,0,0.2)',
          borderRadius: '6px',
          padding: '4px 10px',
          cursor: 'pointer',
          color: '#e0e0e0',
          fontSize: '12px',
          fontWeight: 500,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => {
          (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,215,0,0.5)';
          (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
        }}
        onMouseLeave={e => {
          (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,215,0,0.2)';
          (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {currentLabel}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          right: 0,
          background: '#1a1a2e',
          border: '1px solid rgba(255,215,0,0.2)',
          borderRadius: '8px',
          padding: '4px',
          minWidth: '180px',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {models.map(model => (
            <div
              key={model.id}
              onClick={() => handleSelect(model.id)}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '12px',
                color: model.id === selected ? '#FFD700' : '#e0e0e0',
                background: model.id === selected ? 'rgba(255,215,0,0.1)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={e => {
                if (model.id !== selected) {
                  (e.target as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)';
                }
              }}
              onMouseLeave={e => {
                if (model.id !== selected) {
                  (e.target as HTMLDivElement).style.background = 'transparent';
                }
              }}
            >
              <span>{model.label}</span>
              {model.provider && (
                <span style={{ fontSize: '10px', opacity: 0.5 }}>{model.provider}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
