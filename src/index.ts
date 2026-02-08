#!/usr/bin/env node
import fs from "fs";
import path from "path";

import { OUTPUT_FILE_NAME } from "./config";
import { buildDuplicatesReport } from "./report";

const fsp = fs.promises;

function printUsage(): void {
  console.error(
    "Usage: dupfind <directory> [-o [path] | --output [path]]"
  );
}

interface ParsedArgs {
  targetDir: string | undefined;
  outputFile: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let targetDir: string | undefined;
  let outputFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-o" || arg === "--output") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        outputFile = next;
        i++;
      } else {
        // Flag present but no path — will use default later
        outputFile = "";
      }
      continue;
    }

    if (arg.startsWith("--output=")) {
      outputFile = arg.slice("--output=".length) || "";
      continue;
    }

    if (!targetDir) {
      targetDir = arg;
    }
  }

  return { targetDir, outputFile };
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
  const { targetDir, outputFile } = parseArgs(process.argv);

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

  // Resolve the output path if -o/--output was provided, so we can
  // exclude it from scanning (in case it already exists).
  let resolvedOutputPath: string | undefined;
  if (outputFile !== undefined) {
    resolvedOutputPath = outputFile
      ? path.resolve(outputFile)
      : path.join(rootDir, OUTPUT_FILE_NAME);
  }

  try {
    const report = await buildDuplicatesReport(rootDir, resolvedOutputPath);

    if (!report) {
      console.log("No duplicates found.");
      return;
    }

    if (resolvedOutputPath) {
      await fsp.writeFile(resolvedOutputPath, report, "utf8");
      console.log(`Duplicate report written to: ${resolvedOutputPath}`);
    } else {
      process.stdout.write(report);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to build duplicate report: ${message}`);
    process.exitCode = 1;
  }
}

main();
