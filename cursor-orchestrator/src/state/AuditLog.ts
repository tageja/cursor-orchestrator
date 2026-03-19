import * as fs from 'fs/promises';
import * as path from 'path';
import type { AuditEntry } from './types';

const DIR = '.ai-workspace';
const FILE = 'audit-log.jsonl';

let workspacePath: string | null = null;

/**
 * Initialize the audit log for a workspace. Creates .ai-workspace/ and audit-log.jsonl if missing.
 * @param wsPath Absolute path to the workspace folder
 * @returns Promise that resolves when init is done
 */
export async function init(wsPath: string): Promise<void> {
  workspacePath = wsPath;
  const dir = path.join(wsPath, DIR);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, FILE);
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '', 'utf-8');
  }
}

function getPath(): string {
  if (!workspacePath) throw new Error('AuditLog not initialized; call init(workspacePath) first.');
  return workspacePath;
}

/**
 * Append one audit entry. Never truncates; append-only.
 * @param entry Audit entry to append
 * @returns Promise that resolves when append is done
 */
export async function append(entry: AuditEntry): Promise<void> {
  const filePath = path.join(getPath(), DIR, FILE);
  const line = JSON.stringify(entry) + '\n';
  await fs.appendFile(filePath, line, 'utf-8');
}

/**
 * Read the last N lines from the audit log. Does not load entire file into memory for large logs.
 * @param n Number of lines from the end
 * @returns Array of audit entries (oldest first in the returned slice)
 */
export async function readLast(n: number): Promise<AuditEntry[]> {
  const filePath = path.join(getPath(), DIR, FILE);
  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.trim().split('\n').filter(Boolean);
  const slice = lines.slice(-n);
  return slice.map((line) => JSON.parse(line) as AuditEntry);
}

export const AuditLog = { init, append, readLast };
