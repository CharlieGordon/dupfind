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
node dist/index.js <directory>
```

Run via npx (after building):

```bash
npm run build
npx . <directory>
```

If the directory is missing or invalid, the tool prints usage and exits with a non-zero status code.

### Notes

- Symbolic links are **not followed** to avoid cycles or unexpected paths.
- The output file `duplicates.txt` is created in the root of the scanned directory.
- If `duplicates.txt` already exists, it is ignored during scanning.

## Example

```bash
node dist/index.js ./sample-data
```

Sample output (written to `duplicates.txt`):

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
