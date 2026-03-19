import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { buildPMPrompt } from '../agents/prompts/pm';
import { runAgent } from '../agents/AgentRunner';
import { FeatureStore } from '../state/FeatureStore';
import { ProjectStore } from '../state/ProjectStore';
import { TaskStore } from '../state/TaskStore';
import { AuditLog } from '../state/AuditLog';
import { handlePMCommand } from '../orchestrator/AgentRouter';
import { start as schedulerStart, updatePostMessage as schedulerUpdatePostMessage } from '../orchestrator/ReviewScheduler';
import type { Feature } from '../state/types';

/**
 * Full Phase 2 implementation: loads webview from dist/webview, wires USER_MESSAGE to AgentRunner,
 * applies CREATE_FEATURE to FeatureStore, sends AGENT_REPLY back to webview.
 */
export class DashboardProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  /**
   * Resolves the webview: loads HTML from dist/webview or falls back to stub if not built.
   * @param webviewView The webview view to populate
   * @param _context Resolve context
   * @param _token Cancellation token
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist')],
    };
    void this._getWebviewHtml(webviewView.webview).then((html) => {
      webviewView.webview.html = html;
    }).catch(() => {
      webviewView.webview.html = this._getStubHtml();
    });

    const postMessageToWebview = (type: string, payload: object) => {
      void webviewView.webview.postMessage({ type, ...payload });
    };
    const folder = vscode.workspace.workspaceFolders?.[0];
    schedulerUpdatePostMessage(postMessageToWebview);
    if (folder) {
      schedulerStart(folder.uri.fsPath, postMessageToWebview);
    }

    webviewView.webview.onDidReceiveMessage((message: { type: string; body?: string }) => {
      void (async () => {
        if (message.type === 'REQUEST_STATE') {
          const folderReq = vscode.workspace.workspaceFolders?.[0];
          if (!folderReq) return;
          const workspacePath = folderReq.uri.fsPath;
          try {
            await ProjectStore.init(workspacePath);
            await FeatureStore.init(workspacePath);
            await TaskStore.init(workspacePath);
            await AuditLog.init(workspacePath);
          } catch {
            return;
          }
          try {
            const features = await FeatureStore.read();
            const auditEntries = await AuditLog.readLast(50);
            const featuresPayload = features.map((f) => ({
              featureId: f.featureId,
              title: f.title,
              status: f.status,
              taskCount: f.tasks.length,
              updatedAt: f.updatedAt,
            }));
            void webviewView.webview.postMessage({ type: 'FEATURES_LIST', features: featuresPayload });
            void webviewView.webview.postMessage({ type: 'AUDIT_ENTRIES', entries: auditEntries });
          } catch {
            // ignore
          }
          return;
        }

        if (message.type !== 'USER_MESSAGE' || typeof message.body !== 'string') return;
        const userMessage = message.body;
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
          void webviewView.webview.postMessage({
            type: 'AGENT_REPLY',
            body: '',
            error: 'Open a workspace folder first, then run "Orchestrator: Initialize AI Workspace".',
          });
          return;
        }
        const workspacePath = folder.uri.fsPath;
        try {
          await ProjectStore.init(workspacePath);
          await FeatureStore.init(workspacePath);
          await TaskStore.init(workspacePath);
          await AuditLog.init(workspacePath);
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          void webviewView.webview.postMessage({ type: 'AGENT_REPLY', body: '', error: err });
          return;
        }
        let project = null;
        let features: Feature[] = [];
        let lastAudit: Awaited<ReturnType<typeof AuditLog.readLast>> = [];
        try {
          project = await ProjectStore.read();
          features = await FeatureStore.read();
          lastAudit = await AuditLog.readLast(5);
        } catch {
          // Fresh workspace; use defaults
        }
        const context = {
          project,
          features,
          lastAuditEntries: lastAudit,
          userMessage,
        };
        const messages = buildPMPrompt(context);
        try {
          const result = await runAgent('project-manager', messages);
          if (result.command?.type === 'CREATE_FEATURE') {
            const now = new Date().toISOString();
            const feature: Feature = {
              featureId: `FEAT-${Date.now()}`,
              title: result.command.title,
              description: result.command.description,
              status: 'draft_scope',
              priority: result.command.priority,
              approvedBy: null,
              approvedAt: null,
              tasks: [],
              allowedFiles: [],
              blockedFiles: [],
              testCaseFile: null,
              testResultFile: null,
              bugs: [],
              devLeadSignoff: null,
              pmSignoff: null,
              createdAt: now,
              updatedAt: now,
            };
            await FeatureStore.add(feature);
            void webviewView.webview.postMessage({ type: 'FEATURES_UPDATED', count: features.length + 1 });
          }
          if (result.command?.type === 'APPROVE_SCOPE') {
            const routerResult = await handlePMCommand(result.command, workspacePath, postMessageToWebview);
            if (routerResult.action === 'product_lead_invoked' && routerResult.featureId != null && routerResult.taskCount != null) {
              void webviewView.webview.postMessage({
                type: 'TASKS_CREATED',
                featureId: routerResult.featureId,
                count: routerResult.taskCount,
              });
            }
          }
          if (
            result.command?.type === 'PAUSE' ||
            result.command?.type === 'RESUME' ||
            result.command?.type === 'APPROVE_DONE' ||
            result.command?.type === 'REJECT'
          ) {
            await handlePMCommand(result.command, workspacePath, postMessageToWebview);
          }
          const replyBody = result.parseError ? `[Parse error: ${result.parseError}]\n\n${result.raw}` : result.raw;
          void webviewView.webview.postMessage({
            type: 'AGENT_REPLY',
            body: replyBody,
            error: result.parseError ?? undefined,
          });
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          void webviewView.webview.postMessage({ type: 'AGENT_REPLY', body: '', error: err });
        }
      })();
    });
  }

  /**
   * Loads index.html from dist/webview and rewrites asset URIs for the webview.
   * @param webview The webview instance
   * @returns HTML string for the webview
   */
  private async _getWebviewHtml(webview: vscode.Webview): Promise<string> {
    const baseDir = path.join(this._extensionUri.fsPath, 'dist', 'webview');
    const indexPath = path.join(baseDir, 'index.html');
    const raw = await fs.readFile(indexPath, 'utf-8');
    const baseUri = webview.asWebviewUri(vscode.Uri.file(baseDir));
    const baseStr = baseUri.toString().replace(/\/?$/, '/');
    return raw.replace(/(href|src)="([^"]+)"/g, (_match: string, attr: string, value: string) => {
      if (value.startsWith('http') || value.startsWith('data:')) return `${attr}="${value}"`;
      const normalized: string = value.startsWith('./') ? value.slice(1) : value.startsWith('/') ? value : `/${value}`;
      return `${attr}="${baseStr}${normalized.replace(/^\//, '')}"`;
    });
  }

  private _getStubHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orchestrator</title>
</head>
<body>
  <p style="padding: 1rem; font-family: var(--vscode-font-family); color: var(--vscode-foreground);">Loading...</p>
  <p style="padding: 0 1rem; font-size: 12px; color: var(--vscode-descriptionForeground);">Run <strong>Orchestrator: Initialize AI Workspace</strong>, then run <strong>npm run build</strong> in webview/ and build the extension.</p>
</body>
</html>`;
  }
}
