# Duplicate File Finder (Node.js + TypeScript)

CLI tool that recursively scans a directory, hashes file contents, and reports duplicates.

## Setup

Requires Node.js. Install dev dependencies for TypeScript compilation.

```bash
npm install
npm run build
```

## Usage

```bash
node dist/index.js <directory> [-o [path] | --output [path]] [-e ext1,ext2 | --ext ext1,ext2]
```

Run via npx (after building):

```bash
npm run build
npx . <directory>
```

If the directory is missing or invalid, the tool prints usage and exits with a non-zero status code.

### Options

| Flag | Description |
|------|-------------|
| `-o [path]`, `--output [path]` | Write report to a file. If no path is given, defaults to `duplicates.txt` in the scanned directory. When omitted, output goes to stdout. |
| `-e ext1,ext2`, `--ext ext1,ext2` | Only scan files with the specified extensions (comma-separated). Extensions can be given with or without a leading dot (e.g. `jpg` or `.jpg`). When omitted, all files are scanned. |
| `-h`, `--help` | Display help message with usage examples and exit. |
| `-v`, `--version` | Display version number and exit. |

### Notes

- Symbolic links are **not followed** to avoid cycles or unexpected paths.
- When using `-o`/`--output`, the output file is excluded from scanning.
- **Progress reporting** is shown on stderr when outputting to a file or when stdout is a TTY. It's automatically disabled when piping output.
- **Statistics** are always displayed on stderr after scanning completes, showing files scanned, duplicates found, and wasted space.

## Examples

```bash
# Scan a directory and print duplicates to stdout
node dist/index.js ./sample-data

# Write the report to a file
node dist/index.js ./sample-data -o report.txt

# Only scan image files
node dist/index.js ./sample-data -e jpg,png,gif

# Combine both flags
node dist/index.js ./photos --ext=jpg,png --output=dupes.txt
```

Sample output:

```
Hash: 3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b
- /absolute/path/to/sample-data/file-a.txt
- /absolute/path/to/sample-data/copy-of-file-a.txt

Hash: 9e107d9d372bb6826bd81d3542a419d6d7e1c0fd7d3b1a94a7b2e23f147c4b18
- /absolute/path/to/sample-data/image-1.png
- /absolute/path/to/sample-data/backup/image-1.png

Scan complete:
- Files scanned: 47
- Files hashed: 12
- Duplicate groups: 2
- Duplicate files: 4
- Wasted space: 1.24 MB
```

If any files fail to hash (due to permission errors or I/O issues), they'll be reported separately:

```
Scan complete:
- Files scanned: 50
- Files hashed: 15
- Duplicate groups: 2
- Duplicate files: 4
- Wasted space: 1.24 MB
- Hash errors: 3

Files that failed to hash:
  /path/to/locked-file.txt: EACCES: permission denied
  /path/to/corrupted.dat: ENOENT: no such file or directory
```

## How It Works

- **Directory traversal:** Recursively walks subdirectories and processes regular files only.
- **Hashing:** Uses streaming SHA-256 hashing from Node's `crypto` module.
- **Performance:** Groups by file size before hashing and limits concurrent hashing tasks (2-8 workers based on CPU count).
- **Progress reporting:** Real-time updates shown on stderr during scanning and hashing phases.
- **Error tracking:** Files that fail to hash are tracked separately and reported with error details.
- **Statistics:** Comprehensive metrics collected including files scanned, duplicates found, and wasted disk space.

## Testing

The project includes a comprehensive test suite with >90% code coverage:

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

Test coverage includes:
- **Unit tests** for all core functions (hashing, scanning, grouping)
- **Integration tests** for end-to-end duplicate detection workflows
- **Edge cases** including empty directories, symlinks, permission errors, large files, and binary content

## Troubleshooting

### Permission Errors
If you encounter permission errors, the tool will log them to stderr and continue scanning. Check the error summary at the end to see which files couldn't be processed.

### Large Directories
For very large directories (millions of files), consider:
- Filtering by extension (`-e`) to reduce the scan scope
- Running on a subset first to estimate performance
- Ensuring adequate disk space for the output file

### Performance
The tool uses controlled concurrency (2-8 workers) based on CPU count. Progress updates are throttled to ~10/second to avoid I/O overhead.
