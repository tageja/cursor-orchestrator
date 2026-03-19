import React, { useState, useEffect } from 'react';
import type { HostMessage, AuditEntryMessage } from '../types/messages';
import { getVsCodeApi } from '../vscodeApi';

export function AgentStatus(): React.ReactElement {
  const [entries, setEntries] = useState<AuditEntryMessage[]>([]);
  const vscode = getVsCodeApi();

  useEffect(() => {
    vscode?.postMessage({ type: 'REQUEST_STATE' });
  }, [vscode]);

  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      const data = event.data as HostMessage;
      if (data?.type === 'AUDIT_ENTRIES') {
        setEntries(data.entries);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const recent = [...entries].reverse().slice(0, 30);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>Agent Status</h3>
      <div style={{ flex: 1, overflow: 'auto', fontSize: 12 }}>
        {recent.length === 0 && (
          <p style={{ color: 'var(--vscode-descriptionForeground)' }}>
            No agent activity yet. Request state or run the orchestrator.
          </p>
        )}
        {recent.map((e, i) => (
          <div
            key={`${e.timestamp}-${i}`}
            style={{
              padding: '6px 0',
              borderBottom: '1px solid var(--vscode-widget-border)',
            }}
          >
            <span style={{ color: 'var(--vscode-descriptionForeground)', marginRight: 8 }}>
              {new Date(e.timestamp).toLocaleTimeString()}
            </span>
            <span style={{ fontWeight: 500 }}>{e.role}</span>
            <span style={{ marginLeft: 4 }}>{e.action}</span>
            {(e.featureId || e.taskId) && (
              <span style={{ color: 'var(--vscode-descriptionForeground)', marginLeft: 4 }}>
                {e.featureId ?? ''} {e.taskId ?? ''}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
