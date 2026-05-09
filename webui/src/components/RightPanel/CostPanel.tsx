import React, { useState, useEffect } from 'react';
import { getCostStats, type CostStats } from '../../api/gateway';

export function CostPanel() {
  const [stats, setStats] = useState<CostStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCostStats().then(data => {
      setStats(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <PanelLoading />;

  const tok = stats?.totalTokens ?? 0;
  const prompt = stats?.promptTokens ?? 0;
  const completion = stats?.completionTokens ?? 0;

  return (
    <div className="rp-section">
      <div className="rp-section-title">Usage Stats</div>
      {tok === 0 ? (
        <div className="rp-empty">No usage data yet</div>
      ) : (
        <>
          <div className="cost-row">
            <span className="cost-label">Total Tokens</span>
            <span className="cost-value">{tok.toLocaleString()}</span>
          </div>
          <div className="cost-row">
            <span className="cost-label">Prompt</span>
            <span className="cost-value">{prompt.toLocaleString()}</span>
          </div>
          <div className="cost-row">
            <span className="cost-label">Completion</span>
            <span className="cost-value">{completion.toLocaleString()}</span>
          </div>
          <div className="cost-row">
            <span className="cost-label">Ratio</span>
            <span className="cost-value">
              {prompt > 0 ? `${(completion / prompt).toFixed(2)}x` : '—'}
            </span>
          </div>
          {stats?.estimatedCost != null && (
            <div className="cost-row highlight">
              <span className="cost-label">Est. Cost</span>
              <span className="cost-value highlight">${stats.estimatedCost.toFixed(4)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PanelLoading() {
  return <div className="rp-loading">Loading...</div>;
}