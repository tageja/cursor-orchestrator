import React, { useState } from 'react';
import { PMChat } from './panels/PMChat';
import { FeatureBoard } from './panels/FeatureBoard';
import { AgentStatus } from './panels/AgentStatus';
import { AuditTrail } from './panels/AuditTrail';

type TabId = 'chat' | 'features' | 'agents' | 'audit';

const TABS: { id: TabId; label: string }[] = [
  { id: 'chat', label: 'PM Chat' },
  { id: 'features', label: 'Features' },
  { id: 'agents', label: 'Agent Status' },
  { id: 'audit', label: 'Audit Trail' },
];

export function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('chat');

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--vscode-font-family)',
        fontSize: 'var(--vscode-font-size)',
        color: 'var(--vscode-foreground)',
      }}
    >
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--vscode-widget-border)',
          flexShrink: 0,
        }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            style={{
              padding: '8px 12px',
              fontFamily: 'var(--vscode-font-family)',
              fontSize: 12,
              border: 'none',
              borderBottom: activeTab === id ? '2px solid var(--vscode-focusBorder)' : '2px solid transparent',
              background: activeTab === id ? 'var(--vscode-tab-activeBackground)' : 'transparent',
              color: activeTab === id ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'chat' && <PMChat />}
        {activeTab === 'features' && <FeatureBoard />}
        {activeTab === 'agents' && <AgentStatus />}
        {activeTab === 'audit' && <AuditTrail />}
      </div>
    </div>
  );
}
