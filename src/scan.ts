import fs from "fs";
import path from "path";
import { ProgressReporter } from "./progress";

const fsp = fs.promises;

/**
 * Recursively walks a directory tree and invokes a callback for each regular file.
 *
 * Symbolic links are never followed to prevent cycles and unexpected behavior.
 * Permission errors are logged to stderr but do not stop the traversal.
 *
 * @param rootDir - Absolute path to directory to walk
 * @param onFile - Async callback invoked with absolute path of each file found
 *
 * @example
 * await walkDirectory('/path/to/dir', async (filePath) => {
 *   console.log(`Found: ${filePath}`);
 * });
 */
export async function walkDirectory(
  rootDir: string,
  onFile: (filePath: string) => Promise<void>
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(rootDir, { withFileTypes: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error reading directory: ${rootDir}: ${message}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    // Do not follow symbolic links to avoid cycles or unexpected paths.
    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkDirectory(fullPath, onFile);
      continue;
    }

    if (entry.isFile()) {
      await onFile(fullPath);
    }
  }
}

/**
 * Scans a directory and groups files by size (optimization for duplicate detection).
 *
 * Files are grouped by their byte size. This allows duplicate detection to only
 * hash files with matching sizes, significantly improving performance by avoiding
 * unnecessary hashing of unique files.
 *
 * @param rootDir - Absolute path to directory to scan
 * @param excludePath - Optional absolute path to exclude from results (e.g., output file)
 * @param extensions - Optional array of extensions to filter (e.g., ['.jpg', '.png'])
 *   Extensions are case-insensitive and must include the leading dot
 * @param progress - Optional progress reporter for UI feedback
 * @returns Promise resolving to Map from file size to array of file paths with that size
 *
 * @example
 * const groups = await collectSizeGroups('/path/to/dir', undefined, ['.jpg', '.png']);
 * for (const [size, files] of groups) {
 *   if (files.length > 1) {
 *     console.log(`${files.length} files of size ${size} bytes`);
 *   }
 * }
 */
export async function collectSizeGroups(
  rootDir: string,
  excludePath?: string,
  extensions?: string[],
  progress?: ProgressReporter
): Promise<Map<number, string[]>> {
  const sizeGroups = new Map<number, string[]>();
  const extSet = extensions ? new Set(extensions) : undefined;
  let fileCount = 0;

  progress?.startScanning();

  await walkDirectory(rootDir, async (filePath) => {
    if (excludePath && filePath === excludePath) {
      return;
    }

    if (extSet) {
      const ext = path.extname(filePath).toLowerCase();
      if (!extSet.has(ext)) {
        return;
      }
    }

    let stats: fs.Stats;
    try {
      stats = await fsp.stat(filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error stating file: ${filePath}: ${message}`);
      return;
    }

    if (!stats.isFile()) {
      return;
    }

    fileCount++;
    progress?.updateScanning(fileCount);

    const size = stats.size;
    const group = sizeGroups.get(size);
    if (group) {
      group.push(filePath);
    } else {
      sizeGroups.set(size, [filePath]);
    }
  });

  progress?.endScanning(fileCount);

  return sizeGroups;
}
