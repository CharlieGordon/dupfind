#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { Command } from "commander";

import { OUTPUT_FILE_NAME } from "./config";
import { buildDuplicatesReport } from "./report";
import { createProgressReporter } from "./progress";

const fsp = fs.promises;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function parseExtensions(value: string): string[] {
  return value
    .split(",")
    .map((ext) => {
      ext = ext.trim().toLowerCase();
      return ext.startsWith(".") ? ext : `.${ext}`;
    })
    .filter((ext) => ext.length > 1);
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
  const program = new Command();

  program
    .name('dupfind')
    .description('Find duplicate files by content hash')
    .version(require('../package.json').version)
    .argument('<directory>', 'directory to scan for duplicates')
    .option('-o, --output [path]', 'write report to file (default: duplicates.txt in scanned dir)')
    .option('-e, --ext <extensions>', 'filter files by extension (comma-separated, e.g., jpg,png)')
    .addHelpText('after', `
Examples:
  $ dupfind ./photos                          # Find all duplicates
  $ dupfind ./photos -o report.txt            # Write results to file
  $ dupfind ./photos -e jpg,png               # Only scan images
  $ dupfind ./photos --ext=jpg --output=dupes.txt

Notes:
  - Symbolic links are never followed
  - The output file is excluded from scanning
  - Statistics are shown on stderr after the scan completes`);

  program.parse();
  const options = program.opts();
  const targetDir = program.args[0];

  let extensions: string[] | undefined;
  if (options.ext) {
    const parsed = parseExtensions(options.ext);
    if (parsed.length === 0) {
      console.error('Error: Extension list is empty or invalid');
      process.exitCode = 1;
      return;
    }
    extensions = parsed;
  }

  const rootDir = path.resolve(targetDir);

  try {
    await ensureValidRoot(rootDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exitCode = 1;
    return;
  }

  let resolvedOutputPath: string | undefined;
  if (options.output !== undefined) {
    resolvedOutputPath = options.output
      ? path.resolve(options.output)
      : path.join(rootDir, OUTPUT_FILE_NAME);
  }

  try {
    const showProgress = resolvedOutputPath !== undefined || process.stdout.isTTY;
    const progress = createProgressReporter(showProgress);

    const result = await buildDuplicatesReport(rootDir, resolvedOutputPath, extensions, progress);

    // Display statistics to stderr
    console.error(`\nScan complete:`);
    console.error(`- Files scanned: ${result.stats.filesScanned}`);
    console.error(`- Files hashed: ${result.stats.filesHashed}`);
    console.error(`- Duplicate groups: ${result.stats.duplicateGroups}`);
    console.error(`- Duplicate files: ${result.stats.duplicateFiles}`);
    console.error(`- Wasted space: ${formatBytes(result.stats.wastedBytes)}`);

    if (result.errors.length > 0) {
      console.error(`- Hash errors: ${result.errors.length}`);
      console.error(`\nFiles that failed to hash:`);
      for (const err of result.errors) {
        console.error(`  ${err.filePath}: ${err.error}`);
      }
    }

    if (!result.report) {
      console.log("\nNo duplicates found.");
      return;
    }

    if (resolvedOutputPath) {
      await fsp.writeFile(resolvedOutputPath, result.report, "utf8");
      console.log(`\nDuplicate report written to: ${resolvedOutputPath}`);
    } else {
      process.stdout.write(result.report);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to build duplicate report: ${message}`);
    process.exitCode = 1;
  }
}

main();
