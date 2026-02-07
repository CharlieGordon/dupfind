#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const fsp = fs.promises;

const OUTPUT_FILE_NAME = "duplicates.txt";
const HASH_CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length || 2));

function printUsage(): void {
  console.error("Usage: node dist/index.js <directory>");
}

async function ensureValidRoot(dirPath: string): Promise<void> {
  let stats: fs.Stats;
  try {
    stats = await fsp.lstat(dirPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot access directory: ${message}`);
  }

  if (stats.isSymbolicLink()) {
    throw new Error("Refusing to follow a symbolic link as the root directory.");
  }

  if (!stats.isDirectory()) {
    throw new Error("Provided path is not a directory.");
  }
}

// Recursively traverse directories and invoke onFile for regular files only.
async function walkDirectory(
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

async function collectSizeGroups(
  rootDir: string,
  outputPath: string
): Promise<Map<number, string[]>> {
  const sizeGroups = new Map<number, string[]>();

  await walkDirectory(rootDir, async (filePath) => {
    if (filePath === outputPath) {
      return;
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

    const size = stats.size;
    const group = sizeGroups.get(size);
    if (group) {
      group.push(filePath);
    } else {
      sizeGroups.set(size, [filePath]);
    }
  });

  return sizeGroups;
}

// Stream file contents into a SHA-256 hash without loading the file into memory.
function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

// Run async work with a fixed concurrency limit to reduce resource pressure.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R | null>
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) {
        return;
      }

      try {
        results[current] = await mapper(items[current]);
      } catch {
        results[current] = null;
      }
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return results;
}

async function buildDuplicatesReport(rootDir: string): Promise<string> {
  const outputPath = path.join(rootDir, OUTPUT_FILE_NAME);
  const sizeGroups = await collectSizeGroups(rootDir, outputPath);

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

  await fsp.writeFile(outputPath, report, "utf8");
  return outputPath;
}

async function main(): Promise<void> {
  const targetDir = process.argv[2];
  if (!targetDir) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const rootDir = path.resolve(targetDir);

  try {
    await ensureValidRoot(rootDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    const reportPath = await buildDuplicatesReport(rootDir);
    console.log(`Duplicate report written to: ${reportPath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to build duplicate report: ${message}`);
    process.exitCode = 1;
  }
}

main();
