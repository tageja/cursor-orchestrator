import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Writes data to filePath atomically: write temp file in same directory, then rename.
 * On Windows, rename does not replace an existing file; we unlink the target first if present.
 * @param filePath Absolute or relative path to final file
 * @param data UTF-8 string content
 */
export async function atomicWrite(filePath: string, data: string): Promise<void> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmpPath, data, 'utf-8');
  try {
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : '';
    if (code === 'EPERM' || code === 'EEXIST') {
      await fs.unlink(filePath).catch(() => {});
      await fs.rename(tmpPath, filePath);
    } else {
      await fs.unlink(tmpPath).catch(() => {});
      throw err;
    }
  }
}
