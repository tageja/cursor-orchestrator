import React, { useState, useCallback, useEffect } from 'react';
import { MessageBubble } from '../components/MessageBubble';
import type { HostMessage } from '../types/messages';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => { postMessage: (msg: unknown) => void };
  }
}

export function PMChat(): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [vscode, setVscode] = useState<{ postMessage: (msg: unknown) => void } | null>(null);

  useEffect(() => {
    const api = window.acquireVsCodeApi?.();
    setVscode(api ?? null);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      const data = event.data as HostMessage;
      if (data?.type === 'AGENT_REPLY') {
        setLoading(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `agent-${Date.now()}`,
            role: 'agent',
            content: data.error ? `Error: ${data.error}\n\nRaw: ${data.body}` : data.body,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'TASKS_CREATED') {
        setMessages((prev) => [
          ...prev,
          {
            id: `tasks-${Date.now()}`,
            role: 'agent',
            content: `Product Lead created ${data.count} task(s) for feature ${data.featureId}.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'DEV_TASK_STARTED') {
        setMessages((prev) => [
          ...prev,
          {
            id: `dev-start-${Date.now()}`,
            role: 'agent',
            content: `Dev Lead assigned task: "${data.taskTitle}" (${data.taskId}). Dev Agent is implementing.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'DEV_TASK_COMPLETE') {
        const files = data.filesChanged?.length ? data.filesChanged.join(', ') : 'none';
        setMessages((prev) => [
          ...prev,
          {
            id: `dev-done-${Date.now()}`,
            role: 'agent',
            content: `Task "${data.taskTitle}" complete. Files changed: ${files}.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'DEV_CYCLE_COMPLETE') {
        setMessages((prev) => [
          ...prev,
          {
            id: `dev-cycle-${Date.now()}`,
            role: 'agent',
            content: `Dev cycle complete for feature ${data.featureId}. ${data.taskCount} task(s) completed.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'TEST_CASES_WRITTEN') {
        setMessages((prev) => [
          ...prev,
          {
            id: `test-cases-${Date.now()}`,
            role: 'agent',
            content: `Test Manager wrote ${data.count} test case(s) for feature ${data.featureId}.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'TESTING_STARTED') {
        setMessages((prev) => [
          ...prev,
          {
            id: `testing-${Date.now()}`,
            role: 'agent',
            content: `Test Agent is running tests for feature ${data.featureId}.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'TEST_CYCLE_COMPLETE') {
        const outcome = data.passed ? 'All tests passed.' : `${data.bugCount} bug(s) reported; sent back to dev.`;
        setMessages((prev) => [
          ...prev,
          {
            id: `test-cycle-${Date.now()}`,
            role: 'agent',
            content: `Test cycle complete for feature ${data.featureId}. ${outcome}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'PM_REVIEW_STARTED') {
        setMessages((prev) => [
          ...prev,
          {
            id: `pm-review-${Date.now()}`,
            role: 'agent',
            content: `[60-min PM Review]\n\n${data.summary}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'PAUSED') {
        setMessages((prev) => [
          ...prev,
          {
            id: `paused-${Date.now()}`,
            role: 'agent',
            content: `Project paused for review. Reason: ${data.reason}. Reply with RESUME to continue.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'RESUMED') {
        setMessages((prev) => [
          ...prev,
          {
            id: `resumed-${Date.now()}`,
            role: 'agent',
            content: `Project resumed. Feature: ${data.featureId}.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'EVIDENCE_MISSING') {
        const missing = data.missingFiles?.length ? data.missingFiles.join(', ') : 'unknown';
        setMessages((prev) => [
          ...prev,
          {
            id: `evidence-${Date.now()}`,
            role: 'agent',
            content: `Evidence check failed for task ${data.taskId} (feature ${data.featureId}). Missing on disk: ${missing}. Task marked blocked.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'CONFIDENCE_WARNING') {
        const ids = data.lowConfidenceTasks?.length ? data.lowConfidenceTasks.join(', ') : 'unknown';
        setMessages((prev) => [
          ...prev,
          {
            id: `confidence-${Date.now()}`,
            role: 'agent',
            content: `Low confidence on completed task(s) for feature ${data.featureId}: ${ids}. Integration paused until PM addresses this.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'FEATURE_APPROVED') {
        setMessages((prev) => [
          ...prev,
          {
            id: `approved-${Date.now()}`,
            role: 'agent',
            content: `Feature ${data.featureId} approved and marked done.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (data?.type === 'FEATURE_REJECTED') {
        setMessages((prev) => [
          ...prev,
          {
            id: `rejected-${Date.now()}`,
            role: 'agent',
            content: `Feature ${data.featureId} rejected: ${data.reason}. Returned to dev_planned for another iteration.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || !vscode) return;
    setInput('');
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    setLoading(true);
    vscode.postMessage({ type: 'USER_MESSAGE', body: text });
  }, [input, vscode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8 }}>
      <div style={{ flex: 1, overflow: 'auto', marginBottom: 8 }}>
        {messages.length === 0 && (
          <p style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>
            Run &quot;Orchestrator: Initialize AI Workspace&quot; first. Then describe what you want to build.
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} timestamp={m.timestamp} />
        ))}
        {loading && (
          <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>PM is thinking…</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Message PM..."
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            fontFamily: 'var(--vscode-font-family)',
            fontSize: 13,
            padding: 8,
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: 4,
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 16px',
            fontFamily: 'var(--vscode-font-family)',
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: 4,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
