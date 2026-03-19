import * as fs from 'fs/promises';
import * as path from 'path';
import type { Task } from './types';
import { atomicWrite } from '../util/atomicWrite';

const DIR = '.ai-workspace';
const FILE = 'tasks.json';

let workspacePath: string | null = null;

/**
 * Initialize the task store for a workspace. Creates .ai-workspace/ and tasks.json if missing.
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
    await atomicWrite(filePath, JSON.stringify([], null, 2));
  }
}

function getPath(): string {
  if (!workspacePath) throw new Error('TaskStore not initialized; call init(workspacePath) first.');
  return workspacePath;
}

/**
 * Read tasks.json from .ai-workspace/
 * @returns Array of tasks
 */
export async function read(): Promise<Task[]> {
  const filePath = path.join(getPath(), DIR, FILE);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Task[];
}

/**
 * Write the full tasks array to tasks.json.
 * @param tasks Array of tasks
 * @returns Promise that resolves when write is done
 */
export async function write(tasks: Task[]): Promise<void> {
  const filePath = path.join(getPath(), DIR, FILE);
  await atomicWrite(filePath, JSON.stringify(tasks, null, 2));
}

/**
 * Append one task and persist.
 * @param task Task to add
 * @returns Promise that resolves when write is done
 */
export async function add(task: Task): Promise<void> {
  const now = new Date().toISOString();
  const withTimestamps = {
    ...task,
    createdAt: task.createdAt ?? now,
    updatedAt: now,
  };
  const tasks = await read();
  tasks.push(withTimestamps);
  await write(tasks);
}

/**
 * Update a task by taskId.
 * @param taskId Id of the task to update
 * @param patch Partial task to merge
 * @returns Promise that resolves when write is done
 */
export async function update(taskId: string, patch: Partial<Task>): Promise<void> {
  const tasks = await read();
  const index = tasks.findIndex((t) => t.taskId === taskId);
  if (index === -1) return;
  tasks[index] = { ...tasks[index], ...patch, updatedAt: new Date().toISOString() };
  await write(tasks);
}

/**
 * Find a task by id.
 * @param taskId Task id
 * @returns The task or undefined
 */
export async function getById(taskId: string): Promise<Task | undefined> {
  const tasks = await read();
  return tasks.find((t) => t.taskId === taskId);
}

/**
 * Find all tasks for a feature.
 * @param featureId Feature id
 * @returns Array of tasks
 */
export async function getByFeatureId(featureId: string): Promise<Task[]> {
  const tasks = await read();
  return tasks.filter((t) => t.featureId === featureId);
}

export const TaskStore = { init, read, write, add, update, getById, getByFeatureId };
