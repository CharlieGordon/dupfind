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

### Notes

- Symbolic links are **not followed** to avoid cycles or unexpected paths.
- When using `-o`/`--output`, the output file is excluded from scanning.

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
```

## How It Works

- **Directory traversal:** Recursively walks subdirectories and processes regular files only.
- **Hashing:** Uses streaming SHA-256 hashing from Node's `crypto` module.
- **Performance:** Groups by file size before hashing and limits concurrent hashing tasks.
- **Errors:** Permission/read errors are logged and processing continues.
