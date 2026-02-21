import fs from "fs";
import { HASH_CONCURRENCY } from "./config";
import { hashFile, mapWithConcurrency } from "./hash";
import { collectSizeGroups } from "./scan";
import { ReportResult, HashResult, HashError, ScanStats } from "./types";
import { ProgressReporter } from "./progress";

const fsp = fs.promises;

/**
 * Builds a duplicate file report by scanning, hashing, and grouping files.
 *
 * Process:
 * 1. Scan directory and group files by size (optimization)
 * 2. Hash only files with matching sizes (candidates for duplicates)
 * 3. Group files by hash to identify duplicates
 * 4. Format results and collect comprehensive statistics
 *
 * Files that fail to hash are tracked separately and reported as errors.
 *
 * @param rootDir - Absolute path to directory to scan
 * @param excludePath - Optional absolute path to exclude (typically output file)
 * @param extensions - Optional array of extensions to filter (e.g., ['.txt', '.jpg'])
 * @param progress - Optional progress reporter for real-time feedback
 * @returns Promise resolving to ReportResult containing:
 *   - report: Formatted text report (empty string if no duplicates found)
 *   - errors: List of files that failed to hash with error messages
 *   - stats: Detailed statistics (files scanned, hashed, errors, duplicates, wasted space)
 *
 * @example
 * const result = await buildDuplicatesReport('/path/to/scan');
 * console.log(result.report);
 * console.log(`Found ${result.stats.duplicateGroups} duplicate groups`);
 * console.log(`Failed to hash ${result.errors.length} files`);
 */
export async function buildDuplicatesReport(
  rootDir: string,
  excludePath?: string,
  extensions?: string[],
  progress?: ProgressReporter
): Promise<ReportResult> {
  const sizeGroups = await collectSizeGroups(rootDir, excludePath, extensions, progress);

  // Calculate total files scanned
  let totalFiles = 0;
  for (const files of sizeGroups.values()) {
    totalFiles += files.length;
  }

  const candidates: string[] = [];
  for (const files of sizeGroups.values()) {
    if (files.length >= 2) {
      candidates.push(...files);
    }
  }

  const stats: ScanStats = {
    filesScanned: totalFiles,
    filesHashed: candidates.length,
    hashErrors: 0,
    duplicateGroups: 0,
    duplicateFiles: 0,
    wastedBytes: 0
  };

  progress?.startHashing(candidates.length);

  const hashingResult = await mapWithConcurrency(
    candidates,
    HASH_CONCURRENCY,
    async (filePath) => {
      try {
        const hash = await hashFile(filePath);
        return { filePath, hash } as HashResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error hashing file: ${filePath}: ${message}`);
        return null;
      }
    },
    (completed, filePath) => progress?.updateHashing(completed, candidates.length, filePath)
  );

  progress?.endHashing();

  const errors: HashError[] = hashingResult.errors.map(e => ({
    filePath: e.item as string,
    error: e.error.message
  }));

  stats.hashErrors = errors.length;

  const hashGroups = new Map<string, string[]>();
  for (const result of hashingResult.results) {
    if (!result) {
      continue;
    }

    const group = hashGroups.get(result.hash);
    if (group) {
      group.push(result.filePath);
    } else {
      hashGroups.set(result.hash, [result.filePath]);
    }
  }

  let report = "";
  for (const [hash, files] of hashGroups.entries()) {
    if (files.length < 2) {
      continue;
    }

    stats.duplicateGroups++;
    stats.duplicateFiles += files.length;

    // Calculate wasted space (all copies except one)
    // Get size from first file
    try {
      const stat = await fsp.stat(files[0]);
      stats.wastedBytes += stat.size * (files.length - 1);
    } catch (err) {
      // Ignore stat errors for waste calculation
    }

    report += `Hash: ${hash}\n`;
    for (const filePath of files) {
      report += `- ${filePath}\n`;
    }
    report += "\n";
  }

  return { report, errors, stats };
}
