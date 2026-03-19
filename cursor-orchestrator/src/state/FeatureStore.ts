import * as fs from 'fs/promises';
import * as path from 'path';
import type { Feature } from './types';
import { atomicWrite } from '../util/atomicWrite';

const DIR = '.ai-workspace';
const FILE = 'features.json';

let workspacePath: string | null = null;

/**
 * Initialize the feature store for a workspace. Creates .ai-workspace/ and features.json if missing.
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
  if (!workspacePath) throw new Error('FeatureStore not initialized; call init(workspacePath) first.');
  return workspacePath;
}

/**
 * Read features.json from .ai-workspace/
 * @returns Array of features
 */
export async function read(): Promise<Feature[]> {
  const filePath = path.join(getPath(), DIR, FILE);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Feature[];
}

/**
 * Write the full features array to features.json.
 * @param features Array of features
 * @returns Promise that resolves when write is done
 */
export async function write(features: Feature[]): Promise<void> {
  const filePath = path.join(getPath(), DIR, FILE);
  await atomicWrite(filePath, JSON.stringify(features, null, 2));
}

/**
 * Append one feature and persist. Sets createdAt/updatedAt.
 * @param feature Feature to add
 * @returns Promise that resolves when write is done
 */
export async function add(feature: Feature): Promise<void> {
  const now = new Date().toISOString();
  const withTimestamps = {
    ...feature,
    createdAt: feature.createdAt ?? now,
    updatedAt: now,
  };
  const features = await read();
  features.push(withTimestamps);
  await write(features);
}

/**
 * Update a feature by featureId. Merges with existing; updatedAt is set.
 * @param featureId Id of the feature to update
 * @param patch Partial feature to merge
 * @returns Promise that resolves when write is done
 */
export async function update(featureId: string, patch: Partial<Feature>): Promise<void> {
  const features = await read();
  const index = features.findIndex((f) => f.featureId === featureId);
  if (index === -1) return;
  features[index] = { ...features[index], ...patch, updatedAt: new Date().toISOString() };
  await write(features);
}

/**
 * Find a feature by id.
 * @param featureId Feature id
 * @returns The feature or undefined
 */
export async function getById(featureId: string): Promise<Feature | undefined> {
  const features = await read();
  return features.find((f) => f.featureId === featureId);
}

export const FeatureStore = { init, read, write, add, update, getById };
