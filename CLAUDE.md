# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript/Node.js CLI tool that finds duplicate files by computing SHA-256 content hashes. The tool recursively scans directories, groups files by size (optimization to avoid hashing all files), then hashes only files with matching sizes to identify duplicates.

## Build and Run Commands

```bash
# Install dependencies
npm install

# Compile TypeScript to JavaScript
npm run build

# Run the CLI (after building)
npm start <directory> [options]
# or
node dist/index.js <directory> [options]
# or via npx
npx . <directory> [options]
```

## CLI Usage

```bash
node dist/index.js <directory> [options]
```

Options:
- `-o [path]` / `--output [path]`: Write report to file (defaults to `duplicates.txt` in scanned directory if no path given). Without this flag, output goes to stdout.
- `-e ext1,ext2` / `--ext ext1,ext2`: Filter scanned files by extension (comma-separated, case-insensitive, dot optional).
- `-h` / `--help`: Display help message with usage examples.
- `-v` / `--version`: Display version number.

The tool excludes the output file from scanning to prevent scanning the report file itself.

## Testing

```bash
# Run test suite
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Test suite includes comprehensive unit and integration tests with >90% code coverage.

## Architecture

The codebase is organized into focused modules in `src/`:

### Core Modules

- **`index.ts`**: Entry point with enhanced argument parsing, validation, statistics display, and main orchestration
  - `printHelp()`: Displays comprehensive help message
  - `printVersion()`: Shows version from package.json
  - `parseArgs()`: Robust argument parser with error collection
  - `main()`: Orchestrates scanning, hashing, reporting, and statistics display
- **`config.ts`**: Configuration constants (output filename, hash concurrency based on CPU count)
- **`types.ts`**: TypeScript interfaces for error tracking and statistics
  - `HashResult`: File path and hash pair
  - `HashError`: File path and error message for failed hashes
  - `ScanStats`: Comprehensive scan statistics
  - `ReportResult`: Complete report with statistics and errors
  - `MappedResult<R>`: Results and errors from concurrent mapping

### Scanning & Hashing

- **`scan.ts`**: Directory traversal logic
  - `walkDirectory()`: Recursive directory walker (ignores symlinks)
  - `collectSizeGroups()`: Groups files by size, applies extension filtering, reports progress
- **`hash.ts`**: Hashing utilities with error tracking
  - `hashFile()`: Streams file through SHA-256 hash without loading into memory
  - `mapWithConcurrency()`: Generic concurrent task executor with error tracking and progress callbacks

### Reporting & Progress

- **`report.ts`**: Report building with statistics collection
  - `buildDuplicatesReport()`: Orchestrates size grouping, concurrent hashing, statistics collection, and report formatting
  - Returns `ReportResult` with report text, errors, and comprehensive statistics
- **`progress.ts`**: Progress reporting infrastructure
  - `ProgressReporter`: Interface for progress lifecycle events
  - `StderrProgressReporter`: Throttled progress updates to stderr (100ms intervals)
  - `NoOpProgressReporter`: Silent mode for piped output
  - `createProgressReporter()`: Factory based on output mode

### Testing

- **`test/`**: Comprehensive test suite (45+ tests, >90% coverage)
  - `setup.ts`: Test utilities and fixture management
  - `hash.test.ts`: Hashing and concurrency tests
  - `scan.test.ts`: Directory traversal and grouping tests
  - `report.test.ts`: Report generation tests
  - `integration.test.ts`: End-to-end workflow tests

### Key Design Decisions

- **Size-based pre-filtering**: Files are grouped by size before hashing. Only files with matching sizes are hashed, avoiding expensive hash operations on unique files.
- **Streaming hashes**: Files are hashed using streams to avoid loading large files into memory.
- **Controlled concurrency**: Hashing runs with limited concurrency (2-8 workers based on CPU count) to balance performance and resource usage.
- **Symlink handling**: Symbolic links are never followed to prevent cycles and unexpected behavior.
- **Error tracking**: Files that fail to hash are captured with full error details and reported separately. The `mapWithConcurrency` function returns both results and errors for complete transparency.
- **Statistics collection**: Comprehensive metrics tracked including files scanned, files hashed, duplicate groups, duplicate files, wasted disk space, and hash failures.
- **Progress reporting**: Real-time feedback on scanning and hashing progress, throttled to 100ms intervals to minimize performance impact. Automatically disabled when piping output.

### Error Handling Strategy

The tool implements comprehensive error tracking:

1. **Hash failures are tracked**: When `hashFile()` throws an error, `mapWithConcurrency()` captures it in the `errors` array with full context (index, item, error message).

2. **Partial results returned**: Even if some files fail to hash, successfully hashed files are still processed and reported.

3. **Error summary displayed**: At the end of the scan, users see:
   - Total hash errors count
   - List of failed files with specific error messages
   - This allows users to identify permission issues or corrupted files

4. **No silent failures**: Previous implementation silently dropped failed files. Current implementation ensures users are aware of incomplete scans.

### Statistics Collection

The tool collects and displays comprehensive statistics:

- **filesScanned**: Total files discovered during directory walk
- **filesHashed**: Number of files actually hashed (only files with matching sizes)
- **hashErrors**: Number of files that failed to hash
- **duplicateGroups**: Number of distinct groups of duplicates found
- **duplicateFiles**: Total number of duplicate files (sum across all groups)
- **wastedBytes**: Total disk space wasted by duplicates (calculated as size × (count - 1) for each group)

Statistics are displayed on stderr after scan completion, making them visible even when piping report to stdout.

## TypeScript Configuration

- Target: ES2020, CommonJS modules
- Strict mode enabled
- Input: `src/`
- Output: `dist/`
