import crypto from "crypto";
import fs from "fs";
import { MappedResult } from "./types";

/**
 * Computes SHA-256 hash of a file using streaming to avoid loading into memory.
 *
 * The file is read in chunks and streamed through the hash algorithm,
 * making this safe for files of any size without memory concerns.
 *
 * @param filePath - Absolute path to the file to hash
 * @returns Promise resolving to hex-encoded SHA-256 hash (64 characters)
 * @throws Error if file cannot be read or does not exist
 *
 * @example
 * const hash = await hashFile('/path/to/file.txt');
 * console.log(hash); // "3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b"
 */
export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Maps items through an async function with controlled concurrency.
 *
 * This function processes items in parallel with a configurable concurrency limit,
 * preventing resource exhaustion while maintaining good throughput. All errors are
 * captured and returned rather than thrown, allowing partial results.
 *
 * @template T - Type of input items
 * @template R - Type of output results
 * @param items - Array of items to process
 * @param limit - Maximum number of concurrent operations (must be > 0)
 * @param mapper - Async function to transform each item (may return null or throw)
 * @param onProgress - Optional callback invoked after each item completes (completed count, current item)
 * @returns Promise resolving to results and errors
 *   - results: Array of transformed items (null for failed items, order preserved)
 *   - errors: Array of errors with index, item, and error details
 *
 * @example
 * const { results, errors } = await mapWithConcurrency(
 *   files,
 *   4,
 *   async (file) => hashFile(file),
 *   (completed, file) => console.log(`Progress: ${completed}`)
 * );
 * console.log(`Processed ${results.length}, ${errors.length} failures`);
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R | null>,
  onProgress?: (completed: number, item: T) => void
): Promise<MappedResult<R>> {
  const results: (R | null)[] = new Array(items.length);
  const errors: Array<{ index: number; item: T; error: Error }> = [];
  let index = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) {
        return;
      }

      try {
        results[current] = await mapper(items[current]);
      } catch (err) {
        results[current] = null;
        errors.push({
          index: current,
          item: items[current],
          error: err instanceof Error ? err : new Error(String(err))
        });
      }

      completed++;
      onProgress?.(completed, items[current]);
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return { results, errors };
}
