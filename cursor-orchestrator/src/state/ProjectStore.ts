import * as fs from 'fs/promises';
import * as path from 'path';
import type { Project, ProjectStatus } from './types';
import { atomicWrite } from '../util/atomicWrite';

const DIR = '.ai-workspace';
const FILE = 'project.json';

let workspacePath: string | null = null;

/**
 * Initialize the project store for a workspace. Creates .ai-workspace/ and project.json if missing.
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
    const project: Project = {
      projectId: `proj-${Date.now()}`,
      name: path.basename(wsPath),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    };
    await atomicWrite(filePath, JSON.stringify(project, null, 2));
  }
}

/**
 * Get the current workspace path. Throws if init() was never called.
 * @returns Current workspace path
 */
function getPath(): string {
  if (!workspacePath) throw new Error('ProjectStore not initialized; call init(workspacePath) first.');
  return workspacePath;
}

/**
 * Read project.json from .ai-workspace/
 * @returns The project object
 */
export async function read(): Promise<Project> {
  const filePath = path.join(getPath(), DIR, FILE);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Project;
}

/**
 * Write project to project.json. Updates updatedAt.
 * @param project Project to write
 * @returns Promise that resolves when write is done
 */
export async function write(project: Project): Promise<void> {
  const updated = { ...project, updatedAt: new Date().toISOString() };
  const filePath = path.join(getPath(), DIR, FILE);
  await atomicWrite(filePath, JSON.stringify(updated, null, 2));
}

/**
 * Update only the status field of the project.
 * @param status New status
 * @returns Promise that resolves when write is done
 */
export async function setStatus(status: ProjectStatus): Promise<void> {
  const project = await read();
  await write({ ...project, status });
}

export const ProjectStore = { init, read, write, setStatus };
