import React, { useState, useEffect } from 'react';
import type { HostMessage, AuditEntryMessage } from '../types/messages';
import { getVsCodeApi } from '../vscodeApi';

function formatEntry(e: AuditEntryMessage): string {
  const parts = [e.role, e.action];
  if (e.featureId) parts.push(e.featureId);
  if (e.taskId) parts.push(e.taskId);
  return parts.join(' · ');
}

export function AuditTrail(): React.ReactElement {
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

  const reverseChronological = [...entries].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>Audit Trail</h3>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          fontSize: 12,
          fontFamily: 'var(--vscode-editor-font-family)',
        }}
      >
        {reverseChronological.length === 0 && (
          <p style={{ color: 'var(--vscode-descriptionForeground)' }}>
            No audit entries yet. Request state or run the orchestrator.
          </p>
        )}
        {reverseChronological.map((e, i) => (
          <div
            key={`${e.timestamp}-${i}`}
            style={{
              padding: '4px 0',
              borderBottom: '1px solid var(--vscode-widget-border)',
            }}
          >
            <span style={{ color: 'var(--vscode-descriptionForeground)', marginRight: 8 }}>
              {new Date(e.timestamp).toISOString()}
            </span>
            {formatEntry(e)}
          </div>
        ))}
      </div>
    </div>
  );
}
