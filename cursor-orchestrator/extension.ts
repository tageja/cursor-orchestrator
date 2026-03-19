import * as vscode from 'vscode';
import { DashboardProvider } from './src/ui/DashboardProvider';
import { stop as schedulerStop } from './src/orchestrator/ReviewScheduler';

/**
 * Extension entry point. Registers the Orchestrator dashboard webview and initWorkspace command.
 * @param context Extension context from VS Code
 */
export function activate(context: vscode.ExtensionContext): void {
  const provider = new DashboardProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('orchestrator.dashboard', provider)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('orchestrator.initWorkspace', () => initWorkspace())
  );
}

/**
 * Creates .ai-workspace/ in the first workspace folder with project.json, features.json, tasks.json, audit-log.jsonl.
 * @returns Promise that resolves when the workspace is initialized or rejects if no folder is open
 */
async function initWorkspace(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage('Orchestrator: Open a folder first.');
    return;
  }
  const { ProjectStore } = await import('./src/state/ProjectStore');
  const { FeatureStore } = await import('./src/state/FeatureStore');
  const { TaskStore } = await import('./src/state/TaskStore');
  const { AuditLog } = await import('./src/state/AuditLog');
  const workspacePath = folder.uri.fsPath;
  await ProjectStore.init(workspacePath);
  await FeatureStore.init(workspacePath);
  await TaskStore.init(workspacePath);
  await AuditLog.init(workspacePath);
  void vscode.window.showInformationMessage('Orchestrator: AI workspace initialized.');
}

export function deactivate(): void {
  schedulerStop();
}
