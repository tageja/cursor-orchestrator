import React, { useState, useEffect } from 'react';
import type { HostMessage, FeatureListItem } from '../types/messages';
import { getVsCodeApi } from '../vscodeApi';

export function FeatureBoard(): React.ReactElement {
  const [features, setFeatures] = useState<FeatureListItem[]>([]);
  const vscode = getVsCodeApi();

  useEffect(() => {
    vscode?.postMessage({ type: 'REQUEST_STATE' });
  }, [vscode]);

  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      const data = event.data as HostMessage;
      if (data?.type === 'FEATURES_LIST') {
        setFeatures(data.features);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>Features</h3>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {features.length === 0 && (
          <p style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>
            No features yet. Request state or create a feature via PM Chat.
          </p>
        )}
        {features.map((f) => (
          <div
            key={f.featureId}
            style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--vscode-widget-border)',
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 4 }}>{f.title}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: 'var(--vscode-badge-background)',
                  color: 'var(--vscode-badge-foreground)',
                }}
              >
                {f.status}
              </span>
              <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {f.taskCount} task(s) · {new Date(f.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
