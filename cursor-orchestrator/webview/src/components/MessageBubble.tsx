import React from 'react';

export interface MessageBubbleProps {
  role: 'user' | 'agent';
  content: string;
  timestamp?: string;
}

/**
 * Renders a single chat message with role label and optional timestamp.
 */
export function MessageBubble({ role, content, timestamp }: MessageBubbleProps): React.ReactElement {
  const isUser = role === 'user';
  return (
    <div
      style={{
        marginBottom: 8,
        padding: 8,
        borderRadius: 8,
        backgroundColor: isUser ? 'var(--vscode-input-background)' : 'var(--vscode-editor-inactiveSelectionBackground)',
        color: 'var(--vscode-foreground)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>
        {isUser ? 'You' : 'PM'} {timestamp ? ` · ${timestamp}` : ''}
      </div>
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>
    </div>
  );
}
