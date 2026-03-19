import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import * as vscode from 'vscode';
import * as os from 'os';

const RUN_TIMEOUT_MS = 120_000;

/** Result item shape matching Test Agent output (id, title, passed, notes). */
export interface ResultItem {
  id: string;
  title: string;
  passed: boolean;
  notes: string;
}

/** Bug item shape matching Test Agent output (description, severity, files). */
export interface BugItem {
  description: string;
  severity: 'high' | 'medium' | 'low';
  files: string[];
}

export type RealRunnerResult =
  | { available: false }
  | { available: true; passed: boolean; results: ResultItem[]; bugs: BugItem[] };

type RunnerKind = 'jest' | 'vitest';

/**
 * Reads orchestrator.testRunner config: "auto" | "jest" | "vitest" | "none".
 */
function getTestRunnerConfig(): string {
  const config = vscode.workspace.getConfiguration('orchestrator').get<string>('testRunner', 'auto');
  return typeof config === 'string' ? config : 'auto';
}

/**
 * Probes workspace for Jest or Vitest config. Returns runner kind or null.
 */
async function detectRunner(workspacePath: string): Promise<RunnerKind | null> {
  const names = [
    'jest.config.js',
    'jest.config.ts',
    'jest.config.mjs',
    'jest.config.cjs',
    'vitest.config.js',
    'vitest.config.ts',
    'vitest.config.mjs',
  ];
  for (const name of names) {
    const p = path.join(workspacePath, name);
    try {
      await fs.access(p);
      if (name.startsWith('jest')) return 'jest';
      if (name.startsWith('vitest')) return 'vitest';
    } catch {
      // file not found, continue
    }
  }
  return null;
}

/**
 * Resolves which runner to use from config and optional workspace probe.
 */
async function resolveRunner(workspacePath: string): Promise<RunnerKind | null> {
  const config = getTestRunnerConfig();
  if (config === 'none') return null;
  if (config === 'jest') return 'jest';
  if (config === 'vitest') return 'vitest';
  return detectRunner(workspacePath);
}

/** Jest JSON output (subset we use). */
interface JestTestResult {
  testResults?: Array<{
    assertionResults?: Array<{
      fullName?: string;
      title?: string;
      status?: string;
      failureMessages?: string[];
    }>;
    name?: string;
  }>;
  numFailedTests?: number;
}

function parseJestOutput(json: JestTestResult): { passed: boolean; results: ResultItem[]; bugs: BugItem[] } {
  const results: ResultItem[] = [];
  const bugs: BugItem[] = [];
  const testResults = json.testResults ?? [];
  let index = 0;
  for (const fileResult of testResults) {
    const filePath = fileResult.name ?? '';
    const assertions = fileResult.assertionResults ?? [];
    for (const a of assertions) {
      const id = `jest-${index}`;
      index += 1;
      const title = a.title ?? a.fullName ?? id;
      const passed = a.status === 'passed';
      const notes = passed ? 'OK' : (a.failureMessages?.join(' ') ?? 'Failed');
      results.push({ id, title, passed, notes });
      if (!passed) {
        bugs.push({
          description: a.failureMessages?.join('\n') ?? title,
          severity: 'high',
          files: filePath ? [filePath] : [],
        });
      }
    }
  }
  const passed = (json.numFailedTests ?? 0) === 0;
  return { passed, results, bugs };
}

/** Vitest JSON output (subset we use; structure may vary by version). */
interface VitestResult {
  testResults?: Array<{
    name?: string;
    result?: { state?: string };
    errors?: Array<{ message?: string }>;
  }>;
  numFailedTests?: number;
  success?: boolean;
}

function parseVitestOutput(json: VitestResult): { passed: boolean; results: ResultItem[]; bugs: BugItem[] } {
  const results: ResultItem[] = [];
  const bugs: BugItem[] = [];
  const testResults = json.testResults ?? [];
  let index = 0;
  for (const t of testResults) {
    const id = `vitest-${index}`;
    index += 1;
    const title = t.name ?? id;
    const state = t.result?.state ?? 'fail';
    const passed = state === 'pass';
    const errMsg = t.errors?.map((e) => e.message).filter(Boolean).join('\n') ?? '';
    results.push({
      id,
      title,
      passed,
      notes: passed ? 'OK' : errMsg || 'Failed',
    });
    if (!passed) {
      bugs.push({
        description: errMsg || title,
        severity: 'high',
        files: [],
      });
    }
  }
  const passed = json.success === true || (json.numFailedTests ?? 0) === 0;
  return { passed, results, bugs };
}

/**
 * Runs Jest with --json --outputFile and parses the result.
 */
async function runJest(workspacePath: string): Promise<RealRunnerResult> {
  const tmpDir = os.tmpdir();
  const outPath = path.join(tmpDir, `jest-orchestrator-${Date.now()}.json`);
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        'npx',
        ['jest', '--json', '--outputFile', outPath, '--no-cache', '--passWithNoTests'],
        { cwd: workspacePath, shell: true }
      );
      const t = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Jest timeout'));
      }, RUN_TIMEOUT_MS);
      proc.on('close', (_code) => {
        clearTimeout(t);
        resolve();
      });
      proc.on('error', reject);
    });
  } catch {
    try {
      await fs.access(outPath);
    } catch {
      return { available: false };
    }
  }
  try {
    const raw = await fs.readFile(outPath, 'utf-8');
    await fs.unlink(outPath).catch(() => {});
    const json = JSON.parse(raw) as JestTestResult;
    const { passed, results, bugs } = parseJestOutput(json);
    return { available: true, passed, results, bugs };
  } catch {
    return { available: false };
  }
}

/**
 * Runs Vitest with --reporter=json and captures stdout (Vitest writes JSON to stdout when reporter is json).
 */
async function runVitest(workspacePath: string): Promise<RealRunnerResult> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['vitest', 'run', '--reporter=json'], {
      cwd: workspacePath,
      shell: true,
    });
    let stdout = '';
    proc.stdout?.on('data', (ch: Buffer) => {
      stdout += ch.toString();
    });
    const t = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({ available: false });
    }, RUN_TIMEOUT_MS);
    proc.on('close', (_code: number) => {
      clearTimeout(t);
      try {
        const trimmed = stdout.trim();
        const lastBrace = trimmed.lastIndexOf('}');
        const firstBrace = trimmed.indexOf('{');
        const jsonStr = lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
        const json = JSON.parse(jsonStr) as VitestResult;
        const { passed, results, bugs } = parseVitestOutput(json);
        resolve({ available: true, passed, results, bugs });
      } catch {
        resolve({ available: false });
      }
    });
    proc.on('error', () => {
      clearTimeout(t);
      resolve({ available: false });
    });
  });
}

/**
 * When a real test runner (Jest or Vitest) is configured and detected, runs it and returns
 * results in the same shape as the Test Agent (results + bugs). Otherwise returns { available: false }
 * so the caller can fall back to the LLM path.
 */
export async function runRealTests(
  _filesChanged: string[],
  workspacePath: string
): Promise<RealRunnerResult> {
  const runner = await resolveRunner(workspacePath);
  if (!runner) return { available: false };
  try {
    if (runner === 'jest') return await runJest(workspacePath);
    return await runVitest(workspacePath);
  } catch {
    return { available: false };
  }
}
