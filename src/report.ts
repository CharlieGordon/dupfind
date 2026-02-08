import { HASH_CONCURRENCY } from "./config";
import { hashFile, mapWithConcurrency } from "./hash";
import { collectSizeGroups } from "./scan";

export async function buildDuplicatesReport(
  rootDir: string,
  excludePath?: string,
  extensions?: string[]
): Promise<string> {
  const sizeGroups = await collectSizeGroups(rootDir, excludePath, extensions);

  const candidates: string[] = [];
  for (const files of sizeGroups.values()) {
    if (files.length >= 2) {
      candidates.push(...files);
    }
  }

  const hashResults = await mapWithConcurrency(
    candidates,
    HASH_CONCURRENCY,
    async (filePath) => {
      try {
        const hash = await hashFile(filePath);
        return { filePath, hash };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error hashing file: ${filePath}: ${message}`);
        return null;
      }
    }
  );

  const hashGroups = new Map<string, string[]>();
  for (const result of hashResults) {
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

    report += `Hash: ${hash}\n`;
    for (const filePath of files) {
      report += `- ${filePath}\n`;
    }
    report += "\n";
  }

  return report;
}
