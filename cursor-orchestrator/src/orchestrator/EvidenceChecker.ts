import * as fs from 'fs/promises';
import * as path from 'path';

/** Result of verifying reported files exist under the workspace. */
export type EvidenceResult = { ok: true } | { ok: false; missingFiles: string[] };

/**
 * Verifies each path in filesChanged exists under workspacePath (relative paths resolved from workspace root).
 * Uses fs.access only — existence check, not content validation.
 * @param filesChanged Paths from Dev Agent (may be relative to workspace)
 * @param workspacePath Absolute workspace root
 */
export async function checkEvidence(filesChanged: string[], workspacePath: string): Promise<EvidenceResult> {
  const missing: string[] = [];
  for (const rel of filesChanged) {
    if (typeof rel !== 'string' || !rel.trim()) continue;
    const trimmed = rel.trim();
    const full = path.isAbsolute(trimmed) ? trimmed : path.join(workspacePath, trimmed);
    try {
      await fs.access(full);
    } catch {
      missing.push(trimmed);
    }
  }
  if (missing.length > 0) {
    return { ok: false, missingFiles: missing };
  }
  return { ok: true };
}
