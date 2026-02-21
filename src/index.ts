#!/usr/bin/env node
import fs from "fs";
import path from "path";

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

function printUsage(): void {
  console.error(
    "Usage: dupfind <directory> [-o [path] | --output [path]] [-e ext1,ext2 | --ext ext1,ext2]"
  );
}

function printHelp(): void {
  const pkg = require('../package.json');
  console.log(`dupfind v${pkg.version} - Find duplicate files by content hash\n`);
  console.log('Usage: dupfind <directory> [options]\n');
  console.log('Options:');
  console.log('  -o, --output [path]     Write report to file (default: duplicates.txt in scanned dir)');
  console.log('                          Without this flag, output goes to stdout');
  console.log('  -e, --ext <extensions>  Filter files by extension (comma-separated, e.g., jpg,png)');
  console.log('  -h, --help              Show this help message');
  console.log('  -v, --version           Show version number\n');
  console.log('Examples:');
  console.log('  dupfind ./photos                          # Find all duplicates');
  console.log('  dupfind ./photos -o report.txt            # Write results to file');
  console.log('  dupfind ./photos -e jpg,png               # Only scan images');
  console.log('  dupfind ./photos --ext=jpg --output=dupes.txt\n');
  console.log('Notes:');
  console.log('  - Symbolic links are never followed');
  console.log('  - The output file is excluded from scanning');
  console.log('  - Statistics are shown on stderr after the scan completes');
}

function printVersion(): void {
  const pkg = require('../package.json');
  console.log(pkg.version);
}

interface ParsedArgs {
  targetDir: string | undefined;
  outputFile: string | undefined;
  extensions: string[] | undefined;
  errors: string[];
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

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);

  // Check for help/version flags first
  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('-v') || args.includes('--version')) {
    printVersion();
    process.exit(0);
  }

  let targetDir: string | undefined;
  let outputFile: string | undefined;
  let extensions: string[] | undefined;
  const errors: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    // Handle known flags
    if (arg === '-o' || arg === '--output') {
      if (outputFile !== undefined) {
        errors.push('Output flag (-o/--output) specified multiple times');
      }
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        outputFile = next;
        i += 2;
      } else {
        outputFile = '';
        i++;
      }
      continue;
    }

    if (arg.startsWith('--output=')) {
      if (outputFile !== undefined) {
        errors.push('Output flag (--output=) specified multiple times');
      }
      outputFile = arg.slice('--output='.length) || '';
      i++;
      continue;
    }

    if (arg === '-e' || arg === '--ext') {
      if (extensions !== undefined) {
        errors.push('Extension flag (-e/--ext) specified multiple times');
      }
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        const parsed = parseExtensions(next);
        if (parsed.length === 0) {
          errors.push('Extension list is empty or invalid');
        } else {
          extensions = parsed;
        }
        i += 2;
      } else {
        errors.push('-e/--ext requires a comma-separated list of extensions');
        i++;
      }
      continue;
    }

    if (arg.startsWith('--ext=')) {
      if (extensions !== undefined) {
        errors.push('Extension flag (--ext=) specified multiple times');
      }
      const value = arg.slice('--ext='.length);
      if (value) {
        const parsed = parseExtensions(value);
        if (parsed.length === 0) {
          errors.push('Extension list is empty or invalid');
        } else {
          extensions = parsed;
        }
      } else {
        errors.push('--ext= requires a comma-separated list of extensions');
      }
      i++;
      continue;
    }

    // Unknown flag
    if (arg.startsWith('-')) {
      errors.push(`Unknown flag: ${arg}`);
      i++;
      continue;
    }

    // Positional argument (directory)
    if (!targetDir) {
      targetDir = arg;
    } else {
      errors.push(`Unexpected argument: ${arg}`);
    }
    i++;
  }

  return { targetDir, outputFile, extensions, errors };
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
  const parsed = parseArgs(process.argv);

  if (parsed.errors.length > 0) {
    for (const error of parsed.errors) {
      console.error(`Error: ${error}`);
    }
    console.error('');
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!parsed.targetDir) {
    console.error('Error: No directory specified');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const { targetDir, outputFile, extensions } = parsed;

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
    // Progress enabled when outputting to file or when stdout is a TTY
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
