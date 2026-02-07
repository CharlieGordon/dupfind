#!/usr/bin/env node
import fs from "fs";
import path from "path";

import { buildDuplicatesReport } from "./report";

const fsp = fs.promises;

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
